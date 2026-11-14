import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, Eye, Wand2, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Logo, Modal, PageHeader, Pager, Stat, Tabs, usePaged } from '../../components/ui'
import { LineItemsEditor, ReportActions, TotalsBlock, amountInWords, money2, usePeriod } from './common'
import { feeAppliesTo, downloadCSV, formatDate, toISODate, uid } from '../../lib/utils'
import { feeInvoiceItems, inPeriod, invoicePayment, invoiceStatus, invoiceTotals, lineTotals, periodLabel } from '../../lib/finance'
import type { Invoice } from '../../types'
import { useNow } from '../../lib/useNow'

const TONE = { issued: 'blue', paid: 'green', overdue: 'red', void: 'gray' } as const

export default function Invoices() {
  const { db, update, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'fee' | 'other'>('fee')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'issued' | 'paid' | 'overdue' | 'void'>('all')
  const [viewing, setViewing] = useState<Invoice | null>(null)
  const [creating, setCreating] = useState(false)
  const [genOpen, setGenOpen] = useState(false)
  const { period, picker } = usePeriod('fy')

  useEffect(() => {
    if (params.get('new')) {
      // oxlint-disable-next-line react/set-state-in-effect -- one-shot: consumes a URL query param (external router state) into local state, then clears it
      setTab('other')
      setCreating(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.invoices
      .filter((i) => i.kind === tab && inPeriod(i.date, period))
      .filter((i) => status === 'all' || invoiceStatus(db, i) === status)
      .filter((i) => {
        if (!t) return true
        const s = i.studentId ? db.students.find((x) => x.id === i.studentId) : undefined
        return i.invoiceNo.toLowerCase().includes(t) || (s?.name.toLowerCase().includes(t) ?? false) || (s?.rollNo.toLowerCase().includes(t) ?? false) || (i.customer?.name.toLowerCase().includes(t) ?? false)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.invoiceNo.localeCompare(a.invoiceNo))
  }, [db, tab, period, status, q])
  const paged = usePaged(rows, 25)
  const all = db.invoices.filter((i) => inPeriod(i.date, period))
  const billed = all.reduce((a, i) => a + (invoiceStatus(db, i) === 'void' ? 0 : lineTotals(i.items, i.interState).total), 0)
  const paid = all.filter((i) => invoiceStatus(db, i) === 'paid').reduce((a, i) => a + lineTotals(i.items, i.interState).total, 0)
  const gst = all.filter((i) => invoiceStatus(db, i) !== 'void').reduce((a, i) => a + lineTotals(i.items, i.interState).gst, 0)

  const who = (i: Invoice) => {
    if (i.customer) return { name: i.customer.name, sub: i.customer.gstin || 'Unregistered' }
    const s = db.students.find((x) => x.id === i.studentId)
    return { name: s?.name ?? '—', sub: s ? `${s.rollNo} · ${s.department} Y${s.year}` : '' }
  }

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={`Fee invoices and GST tax invoices for other income · ${periodLabel(period)}`}
        actions={<>{picker}<Button variant="secondary" icon={<Wand2 size={16} />} onClick={() => setGenOpen(true)}>Generate fee invoices</Button><Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New invoice</Button></>}
      />
      <div className="grid stats-grid">
        <Stat label="Invoiced" value={money2(billed)} icon={<FileText size={20} />} />
        <Stat label="Received" value={money2(paid)} icon={<CheckCircle2 size={20} />} tone="green" hint={billed ? `${Math.round((paid / billed) * 100)}% collected` : undefined} />
        <Stat label="Outstanding" value={money2(billed - paid)} icon={<FileText size={20} />} tone="red" />
        <Stat label="GST on invoices" value={money2(gst)} icon={<FileText size={20} />} tone="blue" hint="Output tax" />
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'fee', label: 'Fee invoices', icon: <FileText size={16} /> }, { id: 'other', label: 'Other income', icon: <FileText size={16} /> }]} />
      <Card pad={false}>
        <div className="toolbar">
          <div className="search"><Search size={16} /><input className="input" placeholder={tab === 'fee' ? 'Invoice no, student, roll no…' : 'Invoice no, customer…'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search invoices" /></div>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
            <option value="all">All</option><option value="issued">Issued</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option>
          </select>
          <span className="spacer" />
          <ReportActions onCsv={() => downloadCSV(`invoices-${tab}-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Invoice', 'Date', 'Due', 'Billed to', 'GSTIN / Roll', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Status'], ...rows.map((i) => { const t = lineTotals(i.items, i.interState); const w = who(i); return [i.invoiceNo, i.date, i.dueDate, w.name, w.sub, t.taxable, t.cgst, t.sgst, t.igst, t.total, invoiceStatus(db, i)] })])} />
        </div>
        {rows.length === 0 ? <Empty icon={<FileText />} title="No invoices">{tab === 'fee' ? 'Use “Generate fee invoices” to raise them for a fee item.' : 'Create one with “New invoice”.'}</Empty> : (
          <div className="table-wrap print-area">
            <h3 className="print-only">{db.branding.collegeName} — {tab === 'fee' ? 'Fee invoices' : 'Other income invoices'} · {periodLabel(period)}</h3>
            <table className="table">
              <thead><tr><th>Invoice</th><th>Billed to</th><th className="right hide-sm">GST</th><th className="right">Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {paged.items.map((i) => {
                  const t = lineTotals(i.items, i.interState)
                  const st = invoiceStatus(db, i)
                  const w = who(i)
                  return (
                    <tr key={i.id}>
                      <td className="nowrap-cell"><strong className="mono tiny">{i.invoiceNo}</strong><div className="muted tiny">{formatDate(i.date)} · due {formatDate(i.dueDate, { day: 'numeric', month: 'short' })}</div></td>
                      <td>{w.name}<div className="muted tiny">{w.sub}</div></td>
                      <td className="right hide-sm">{money2(t.gst)}</td>
                      <td className="right"><strong>{money2(t.total)}</strong></td>
                      <td><Badge tone={TONE[st]}>{st}</Badge></td>
                      <td className="right nowrap">
                        <button className="icon-btn" aria-label={`View ${i.invoiceNo}`} onClick={() => setViewing(i)}><Eye size={16} /></button>
                        {i.kind === 'other' && st !== 'paid' && st !== 'void' && (
                          <Button size="sm" variant="secondary" onClick={() => { const ref = prompt('Payment reference (UTR / cheque no.)'); if (ref === null) return; update((d) => { const x = d.invoices.find((y) => y.id === i.id); if (x) Object.assign(x, { status: 'paid', paidOn: toISODate(new Date()), paymentRef: ref || 'MANUAL' }) }); toast(`${i.invoiceNo} marked paid`) }}>Mark paid</Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager {...paged} />
      </Card>
      {viewing && <InvoiceView inv={viewing} onClose={() => setViewing(null)} />}
      {creating && <NewInvoice onClose={() => setCreating(false)} />}
      {genOpen && <GenerateFeeInvoices onClose={() => setGenOpen(false)} />}
    </>
  )
}

const nextNo = (invoices: Invoice[]) => {
  const yr = String(new Date().getFullYear()).slice(2)
  const max = Math.max(5000, ...invoices.map((i) => +(i.invoiceNo.split('/').pop() ?? 0) || 0))
  return { yr, n: max + 1 }
}

function GenerateFeeInvoices({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [feeId, setFeeId] = useState(db.fees[0]?.id ?? '')
  const fee = db.fees.find((f) => f.id === feeId)
  const missing = fee ? db.students.filter((s) => s.status === 'active' && feeAppliesTo(fee, s) && !db.invoices.some((i) => i.kind === 'fee' && i.feeId === fee.id && i.studentId === s.id && i.status !== 'void')) : []
  const rate = fee ? db.tax.feeGst[fee.category] ?? 0 : 0
  const go = () => {
    if (!fee || !missing.length) return
    update((d) => {
      let { yr, n } = nextNo(d.invoices)
      for (const s of missing) {
        d.invoices.push({ id: uid('inv'), invoiceNo: `INV/${yr}/${n++}`, kind: 'fee', studentId: s.id, feeId: fee.id, date: toISODate(new Date()), dueDate: fee.dueDate, items: feeInvoiceItems(fee, rate), interState: false, status: 'issued' })
      }
    })
    toast(`${missing.length} fee invoices generated`)
    onClose()
  }
  return (
    <Modal open title="Generate fee invoices" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Wand2 size={16} />} disabled={!missing.length} onClick={go}>Generate {missing.length}</Button></>}>
      <Field label="Fee item">{(id) => <select id={id} className="input" value={feeId} onChange={(e) => setFeeId(e.target.value)}>{db.fees.map((f) => <option key={f.id} value={f.id}>{f.name} · {money2(f.amount)}</option>)}</select>}</Field>
      <p className="tiny">{missing.length} applicable student{missing.length === 1 ? '' : 's'} without an invoice yet. GST on {fee?.category} fees: <strong>{rate}%</strong> {rate === 0 && <span className="muted">(education services to students are exempt)</span>}. Paid / unpaid status follows the student’s fee payments automatically.</p>
    </Modal>
  )
}

function NewInvoice({ onClose }: { onClose: () => void }) {
  const now = useNow()
  const { db, update, toast } = useStore()
  const [inv, setInv] = useState<Invoice>({ id: '', invoiceNo: '', kind: 'other', customer: { name: '', gstin: '', email: '' }, date: toISODate(new Date(now)), dueDate: toISODate(new Date(now + 15 * 86400000)), items: [{ description: '', qty: 1, rate: 0, gstRate: 18 }], interState: false, status: 'issued' })
  const c = inv.customer!
  const dateErr = !inv.date ? 'Enter the invoice date' : inv.date > toISODate(new Date(now)) ? 'Invoice date cannot be in the future' : inv.dueDate < inv.date ? 'Due date is before the invoice date' : null
  const valid = !dateErr && c.name.trim().length > 1 && inv.items.every((i) => i.description.trim() && i.qty > 0 && i.rate > 0) && (!c.gstin || /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(c.gstin))
  const save = () => {
    update((d) => {
      const { yr, n } = nextNo(d.invoices)
      d.invoices.push({ ...inv, id: uid('inv'), invoiceNo: `INV/${yr}/${n}`, customer: { ...c, name: c.name.trim() } })
    })
    toast('Invoice issued')
    onClose()
  }
  return (
    <Modal open wide title="New tax invoice" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={save}>Issue invoice</Button></>}>
      <div className="form-grid">
        <Field label="Bill to">{(id) => <input id={id} className="input" value={c.name} onChange={(e) => setInv({ ...inv, customer: { ...c, name: e.target.value } })} placeholder="Organisation or person" autoFocus />}</Field>
        <Field label="Customer GSTIN (optional)">{(id) => <input id={id} className="input mono" value={c.gstin} onChange={(e) => { const g = e.target.value.toUpperCase(); setInv({ ...inv, interState: /^\d{2}/.test(g) ? g.slice(0, 2) !== db.tax.stateCode : inv.interState, customer: { ...c, gstin: g } }) }} />}</Field>
        <Field label="Email">{(id) => <input id={id} className="input" value={c.email} onChange={(e) => setInv({ ...inv, customer: { ...c, email: e.target.value } })} />}</Field>
        <div className="form-grid inner">
          <Field label="Date" error={dateErr}>{(id) => <input id={id} type="date" className="input" max={toISODate(new Date(now))} value={inv.date} onChange={(e) => setInv({ ...inv, date: e.target.value })} />}</Field>
          <Field label="Due">{(id) => <input id={id} type="date" className="input" min={inv.date} value={inv.dueDate} onChange={(e) => setInv({ ...inv, dueDate: e.target.value })} />}</Field>
        </div>
        <label className="checkbox span-2"><input type="checkbox" checked={inv.interState} onChange={(e) => setInv({ ...inv, interState: e.target.checked })} /> Inter-state (IGST)</label>
      </div>
      <LineItemsEditor items={inv.items} onChange={(items) => setInv({ ...inv, items })} interState={inv.interState} />
    </Modal>
  )
}

function InvoiceView({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const { db } = useStore()
  const t = invoiceTotals(db, inv)
  const st = invoiceStatus(db, inv)
  const s = inv.studentId ? db.students.find((x) => x.id === inv.studentId) : undefined
  const pay = invoicePayment(db, inv)
  return (
    <Modal open wide title={inv.invoiceNo} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => window.print()}>Print / PDF</Button></>}>
      <div className="print-area invoice-doc">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div className="row gap-s"><Logo size={44} /><div><strong>{db.tax.legalName}</strong><div className="tiny muted">{db.branding.address}</div><div className="tiny">GSTIN {db.tax.gstin} · PAN {db.tax.pan}</div></div></div>
          <div className="right"><div className="spec">{t.gst > 0 ? 'Tax invoice' : 'Bill of supply'}</div><div className="mono">{inv.invoiceNo}</div><div className="tiny muted">{formatDate(inv.date)} · due {formatDate(inv.dueDate)}</div><Badge tone={TONE[st]}>{st}</Badge></div>
        </div>
        <div className="invoice-to">
          <span className="spec">Billed to</span>
          {s ? <div><strong>{s.name}</strong><div className="tiny">{s.rollNo} · {s.department} Year {s.year} Sec {s.section}</div></div> : <div><strong>{inv.customer?.name}</strong><div className="tiny">{inv.customer?.gstin ? `GSTIN ${inv.customer.gstin}` : 'Unregistered'}</div></div>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">GST</th><th className="right">Taxable</th></tr></thead>
            <tbody>{inv.items.map((i, k) => <tr key={k}><td>{k + 1}</td><td>{i.description}{t.gst === 0 && <div className="muted tiny">Exempt — education services (SAC 9992)</div>}</td><td className="right">{i.qty}</td><td className="right">{money2(i.rate)}</td><td className="right">{i.gstRate}%</td><td className="right">{money2(i.qty * i.rate)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
          <p className="tiny" style={{ flex: 1 }}><span className="spec">Amount in words</span><br />{amountInWords(t.total + t.lateFee)}</p>
          <TotalsBlock t={t} interState={inv.interState} extra={t.lateFee ? (<><dt>Late fee</dt><dd>{money2(t.lateFee)}</dd><dt>Amount received</dt><dd><strong>{money2(t.total + t.lateFee)}</strong></dd></>) : undefined} />
        </div>
        {(pay || inv.paidOn) && <p className="tiny muted">Paid {formatDate(pay?.paidAt ?? inv.paidOn!)} · {pay ? `${pay.method.toUpperCase()} · ${pay.txnRef} · receipt ${pay.receiptNo}` : inv.paymentRef}</p>}
        <p className="tiny muted">Computer-generated invoice. {db.branding.supportEmail}</p>
      </div>
    </Modal>
  )
}
