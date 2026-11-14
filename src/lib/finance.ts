import type { Bill, Database, FeeItem, Invoice, LineItem, Payment } from '../types'
import { toISODate } from './utils'

/* ------------------------------------------------------------------ */
/* Periods: calendar month or Indian financial year (Apr–Mar)          */
/* ------------------------------------------------------------------ */

export type Period = { kind: 'month'; key: string } | { kind: 'fy'; start: number }

export const monthKey = (iso: string) => iso.slice(0, 7)
export const fyStartOf = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1)
export const fyLabel = (start: number) => `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`

export function periodRange(p: Period): [string, string] {
  if (p.kind === 'month') {
    const [y, m] = p.key.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return [`${p.key}-01`, `${p.key}-${String(last).padStart(2, '0')}`]
  }
  return [`${p.start}-04-01`, `${p.start + 1}-03-31`]
}
export const inPeriod = (iso: string, p: Period) => {
  const d = iso.slice(0, 10)
  const [a, b] = periodRange(p)
  return d >= a && d <= b
}
export const periodLabel = (p: Period) =>
  p.kind === 'fy' ? fyLabel(p.start) : new Date(p.key + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

/** Month keys of a financial year, Apr → Mar */
export const fyMonths = (start: number) => Array.from({ length: 12 }, (_, i) => { const d = new Date(start, 3 + i, 1); return toISODate(d).slice(0, 7) })

/* ------------------------------------------------------------------ */
/* GST / TDS                                                          */
/* ------------------------------------------------------------------ */

export interface Totals {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  gst: number
  total: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Exclusive line items (rate before GST). Intra-state splits GST into CGST + SGST. */
export function lineTotals(items: LineItem[], interState: boolean): Totals {
  let taxable = 0
  let gst = 0
  for (const it of items) {
    const base = it.qty * it.rate
    taxable += base
    gst += it.gstAmount ?? (base * it.gstRate) / 100
  }
  taxable = r2(taxable)
  gst = r2(gst)
  const half = r2(gst / 2)
  return { taxable, gst, cgst: interState ? 0 : half, sgst: interState ? 0 : r2(gst - half), igst: interState ? gst : 0, total: r2(taxable + gst) }
}

/** Split a GST-inclusive amount (fees are quoted inclusive). */
export function splitInclusive(amount: number, rate: number) {
  const taxable = r2(amount / (1 + rate / 100))
  return { taxable, gst: r2(amount - taxable) }
}

export function billTotals(b: Bill) {
  const t = lineTotals(b.items, b.interState)
  // TDS is computed on the value excluding GST (CBDT Circular 23/2017).
  const tds = b.tdsSection ? r2((t.taxable * b.tdsRate) / 100) : 0
  return { ...t, tds, payable: r2(t.total - tds) }
}

export const TDS_SECTIONS: { id: string; label: string; hint: string }[] = [
  { id: '194C', label: '194C · Contractors', hint: 'Housekeeping, security, events, repairs (1% individual / 2% others)' },
  { id: '194J', label: '194J · Professional / technical', hint: 'Guest faculty, consultants, audit (10%; 2% technical)' },
  { id: '194I', label: '194I · Rent', hint: 'Building 10%, plant & machinery 2%' },
  { id: '194H', label: '194H · Commission', hint: '2%' },
  { id: '194Q', label: '194Q · Purchase of goods', hint: '0.1% above ₹50 lakh per vendor per year' },
]
export const GST_RATES = [0, 5, 12, 18, 28]

/* ------------------------------------------------------------------ */
/* Fee invoices (derived status)                                      */
/* ------------------------------------------------------------------ */

export function feeInvoiceItems(fee: FeeItem, gstRate: number): LineItem[] {
  // Fee amounts are GST-inclusive, so the invoice total must equal the fee exactly. Taxable value and GST are both
  // rounded to the paisa, and for some amounts no taxable value satisfies `taxable + round(taxable × rate) = fee`
  // (at 18%, 4718 is only reachable as 4717.99 or 4718.01). So the tax is derived from the total and the taxable
  // value is the remainder; the line carries the GST explicitly.
  const gst = r2((fee.amount * gstRate) / (100 + gstRate))
  return [{ description: `${fee.name} (${fee.term})`, qty: 1, rate: r2(fee.amount - gst), gstRate, gstAmount: gst }]
}

export function invoicePayment(db: Database, inv: Invoice): Payment | undefined {
  if (inv.kind !== 'fee') return undefined
  return db.payments.find((p) => p.studentId === inv.studentId && p.feeId === inv.feeId && p.status === 'success')
}

export function invoiceStatus(db: Database, inv: Invoice): 'issued' | 'paid' | 'void' | 'overdue' {
  if (inv.status === 'void') return 'void'
  const paid = inv.kind === 'fee' ? !!invoicePayment(db, inv) : inv.status === 'paid'
  if (paid) return 'paid'
  return inv.dueDate < toISODate(new Date()) ? 'overdue' : 'issued'
}

export function invoiceTotals(db: Database, inv: Invoice) {
  const t = lineTotals(inv.items, inv.interState)
  const pay = invoicePayment(db, inv)
  return { ...t, lateFee: pay?.lateFee ?? 0 }
}

/* ------------------------------------------------------------------ */
/* Bank                                                               */
/* ------------------------------------------------------------------ */

export function accountBalance(db: Database, accountId: string, upTo?: string) {
  const acc = db.bankAccounts.find((a) => a.id === accountId)
  if (!acc) return 0
  let bal = acc.openingBalance
  for (const t of db.bankTxns) if (t.accountId === accountId && (!upTo || t.date <= upTo)) bal += t.credit - t.debit
  return r2(bal)
}

/**
 * Suggest a match for an unmatched statement line:
 *  credit → a fee payment with the same reference, or same amount within ±3 days
 *  debit  → a paid bill with the same reference, or same net payable within ±3 days
 */
export function suggestMatch(db: Database, t: { date: string; ref: string; debit: number; credit: number }) {
  const near = (a: string, b: string) => Math.abs(new Date(a.slice(0, 10)).getTime() - new Date(b.slice(0, 10)).getTime()) <= 3 * 86400000
  const taken = new Set(db.bankTxns.filter((x) => x.match).map((x) => `${x.match!.type}:${x.match!.id}`))
  if (t.credit > 0) {
    const byRef = db.payments.find((p) => p.status === 'success' && t.ref && p.txnRef === t.ref && !taken.has(`payment:${p.id}`))
    if (byRef) return { type: 'payment' as const, id: byRef.id }
    const byAmt = db.payments.find((p) => p.status === 'success' && Math.abs(p.amount + p.lateFee - t.credit) < 0.5 && near(p.paidAt, t.date) && !taken.has(`payment:${p.id}`))
    if (byAmt) return { type: 'payment' as const, id: byAmt.id }
    const inv = db.invoices.find((i) => i.kind === 'other' && i.status === 'paid' && Math.abs(lineTotals(i.items, i.interState).total - t.credit) < 0.5 && !taken.has(`invoice:${i.id}`))
    if (inv) return { type: 'invoice' as const, id: inv.id }
  }
  if (t.debit > 0) {
    const bill = db.bills.find((b) => b.status === 'paid' && !taken.has(`bill:${b.id}`) && ((t.ref && b.paymentRef === t.ref) || (Math.abs(billTotals(b).payable - t.debit) < 0.5 && b.paidOn && near(b.paidOn, t.date))))
    if (bill) return { type: 'bill' as const, id: bill.id }
  }
  return undefined
}

/** Parse a bank statement CSV: Date, Description, Ref, Debit, Credit (header row optional). */
export function parseStatementCsv(text: string, skipped?: { n: number }): { date: string; description: string; ref: string; debit: number; credit: number }[] {
  const rows: string[][] = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = ''
    let q = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q
      } else if (ch === ',' && !q) { cells.push(cur); cur = '' } else cur += ch
    }
    cells.push(cur)
    rows.push(cells.map((c) => c.trim()))
  }
  const num = (v: string) => Math.abs(Number((v || '0').replace(/[₹,\s]|\b(Dr|Cr)\b\.?/gi, '')) || 0)
  const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const rawIso = (v: string) => {
    const mn = v.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ ,-]*(\d{2,4})$/)
    if (mn && MON.includes(mn[2].toLowerCase())) return `${mn[3].length === 2 ? '20' + mn[3] : mn[3]}-${String(MON.indexOf(mn[2].toLowerCase()) + 1).padStart(2, '0')}-${mn[1].padStart(2, '0')}`
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ''
  }
  const toIso = (v: string) => { const i = rawIso(v); const d = new Date(i + 'T00:00:00Z'); return i && !isNaN(+d) && d.toISOString().slice(0, 10) === i ? i : '' } // rejects 31/02 etc.
  const dated = rows.filter((r) => toIso(r[0]))
  if (skipped) skipped.n = rows.length - dated.length - (rows.length && !toIso(rows[0][0]) ? 1 : 0) // first non-date row is the header
  return dated
    .map((r) => ({ date: toIso(r[0]), description: r[1] ?? '', ref: r[2] ?? '', debit: num(r[3]), credit: num(r[4]) }))
    .filter((r) => r.debit > 0 || r.credit > 0)
}

/* ------------------------------------------------------------------ */
/* Report aggregates                                                  */
/* ------------------------------------------------------------------ */

export function collections(db: Database, p: Period) {
  return db.payments.filter((x) => x.status === 'success' && inPeriod(x.paidAt, p))
}

export function gstSummary(db: Database, p: Period) {
  // Output tax: fee invoices (by payment date) + other invoices issued in the period
  let outTaxable = 0, outGst = 0, exempt = 0
  for (const inv of db.invoices) {
    if (inv.status === 'void') continue
    if (inv.kind === 'fee') {
      const pay = invoicePayment(db, inv)
      if (!pay || !inPeriod(pay.paidAt, p)) continue
    } else if (!inPeriod(inv.date, p)) continue
    const t = lineTotals(inv.items, inv.interState)
    if (t.gst === 0) exempt += t.taxable
    else { outTaxable += t.taxable; outGst += t.gst }
  }
  let inTaxable = 0, inGst = 0
  for (const b of db.bills) {
    if (b.status === 'cancelled' || !inPeriod(b.date, p)) continue
    const t = lineTotals(b.items, b.interState)
    inTaxable += t.taxable
    inGst += t.gst
  }
  return { outTaxable: r2(outTaxable), outGst: r2(outGst), exempt: r2(exempt), inTaxable: r2(inTaxable), inGst: r2(inGst) }
}

export function tdsBySection(db: Database, p: Period) {
  const out: Record<string, { section: string; amount: number; bills: number; deposited: number }> = {}
  for (const b of db.bills) {
    if (b.status === 'cancelled' || !b.tdsSection || !inPeriod(b.date, p)) continue
    const t = billTotals(b)
    const row = (out[b.tdsSection] ??= { section: b.tdsSection, amount: 0, bills: 0, deposited: 0 })
    row.amount = r2(row.amount + t.tds)
    row.bills++
  }
  for (const d of db.tdsDeposits) if (inPeriod(d.month + '-01', p) && out[d.section]) out[d.section].deposited = r2(out[d.section].deposited + d.amount)
  return Object.values(out).sort((a, b) => a.section.localeCompare(b.section))
}

/** TDS for deductions in month M is due on the 7th of M+1 (March: 30 April). */
export function tdsDueDate(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (m === 3) return `${y}-04-30`
  const d = new Date(y, m, 7)
  return toISODate(d)
}

export const r = r2
