import { describe, expect, it } from 'vitest'
import { feeInvoiceItems, fyMonths, fyStartOf, inPeriod, lineTotals, parseStatementCsv, periodRange, splitInclusive, tdsDueDate } from './finance'
import type { FeeItem } from '../types'

const fee = (amount: number): FeeItem => ({ id: 'f', name: 'Tuition', category: 'tuition', amount, department: 'All', year: 0, dueDate: '2026-06-30', term: 'Sem 1', lateFeePerDay: 0 })

describe('GST totals', () => {
  it('splits intra-state GST into CGST + SGST', () => {
    const t = lineTotals([{ description: 'Projector', qty: 2, rate: 38000, gstRate: 18 }], false)
    expect(t).toMatchObject({ taxable: 76000, gst: 13680, cgst: 6840, sgst: 6840, igst: 0, total: 89680 })
  })

  it('uses IGST for inter-state supplies', () => {
    const t = lineTotals([{ description: 'Projector', qty: 2, rate: 38000, gstRate: 18 }], true)
    expect(t).toMatchObject({ cgst: 0, sgst: 0, igst: 13680, total: 89680 })
  })

  it('never loses a paisa when halving an odd amount of GST', () => {
    for (let rate = 101; rate < 400; rate += 7) {
      const t = lineTotals([{ description: 'x', qty: 1, rate, gstRate: 5 }], false)
      expect(Math.round((t.cgst + t.sgst) * 100)).toBe(Math.round(t.gst * 100))
    }
  })
})

describe('GST-inclusive fee invoices', () => {
  it('backs the taxable value out of an inclusive amount', () => {
    expect(splitInclusive(1180, 18)).toEqual({ taxable: 1000, gst: 180 })
  })

  it('adds back to exactly the fee (regression: ₹922 at 5% used to total ₹922.01)', () => {
    const items = feeInvoiceItems(fee(922), 5)
    expect(lineTotals(items, false).total).toBe(922)
  })

  it('is exact for every whole-rupee fee from ₹100 to ₹5,000 at common slabs', () => {
    const drift: string[] = []
    for (const rate of [5, 12, 18]) {
      for (let a = 100; a <= 5000; a++) {
        const total = lineTotals(feeInvoiceItems(fee(a), rate), false).total
        if (total !== a) drift.push(`${a}@${rate}% → ${total}`)
      }
    }
    expect(drift).toEqual([])
  })
})

describe('financial year (April–March)', () => {
  it('starts in April', () => {
    expect(fyStartOf(new Date(2026, 2, 31))).toBe(2025)
    expect(fyStartOf(new Date(2026, 3, 1))).toBe(2026)
  })

  it('lists April to March', () => {
    const m = fyMonths(2026)
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('2026-04')
    expect(m[11]).toBe('2027-03')
  })

  it('treats both end days as inside the period', () => {
    expect(periodRange({ kind: 'fy', start: 2025 })).toEqual(['2025-04-01', '2026-03-31'])
    expect(inPeriod('2026-03-31T23:59:00', { kind: 'fy', start: 2025 })).toBe(true)
    expect(inPeriod('2026-04-01', { kind: 'fy', start: 2025 })).toBe(false)
    expect(periodRange({ kind: 'month', key: '2028-02' })).toEqual(['2028-02-01', '2028-02-29'])
  })
})

describe('TDS due date', () => {
  it('is the 7th of the next month', () => {
    expect(tdsDueDate('2026-04')).toBe('2026-05-07')
    expect(tdsDueDate('2026-12')).toBe('2027-01-07')
  })

  it('is 30 April for March deductions', () => {
    expect(tdsDueDate('2026-03')).toBe('2026-04-30')
  })
})

describe('bank statement CSV', () => {
  it('reads DD/MM/YYYY and DD-Mon-YYYY, skips the header and strips Dr/Cr', () => {
    const skipped = { n: 0 }
    const rows = parseStatementCsv('Date,Description,Ref,Debit,Credit\n05/11/2026,Fee NEFT,UTR1,,"12,500.00"\n06-Nov-2026,Vendor,CHQ2,4000 Dr,\n', skipped)
    expect(rows).toEqual([
      { date: '2026-11-05', description: 'Fee NEFT', ref: 'UTR1', debit: 0, credit: 12500 },
      { date: '2026-11-06', description: 'Vendor', ref: 'CHQ2', debit: 4000, credit: 0 },
    ])
    expect(skipped.n).toBe(0)
  })

  it('rejects impossible dates and counts them as skipped', () => {
    const skipped = { n: 0 }
    const rows = parseStatementCsv('Date,Description,Ref,Debit,Credit\n31/02/2026,Bad,X,100,\n01/13/2026,Bad,X,100,\n02/03/2026,Good,Y,,50', skipped)
    expect(rows.map((r) => r.ref)).toEqual(['Y'])
    expect(skipped.n).toBe(2)
  })

  it('returns nothing for an empty or garbage file', () => {
    expect(parseStatementCsv('')).toEqual([])
    expect(parseStatementCsv('hello\nworld')).toEqual([])
  })
})
