import { useState, type ReactNode } from 'react'
import { Plus, Trash2, Printer, Download } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Segmented } from '../../components/ui'
import { GST_RATES, fyLabel, fyStartOf, lineTotals, type Period } from '../../lib/finance'
import { formatMoney, toISODate } from '../../lib/utils'
import { useNow } from '../../lib/useNow'
import type { LineItem } from '../../types'

/** Month / financial-year selector shared by every accounts screen. */
export function usePeriod(initial: 'month' | 'fy' = 'month') {
  const now = new Date(useNow())
  const [kind, setKind] = useState<'month' | 'fy'>(initial)
  const [month, setMonth] = useState(toISODate(now).slice(0, 7))
  const [fy, setFy] = useState(fyStartOf(now))
  const period: Period = kind === 'month' ? { kind: 'month', key: month } : { kind: 'fy', start: fy }
  const picker = (
    <div className="period-picker">
      <Segmented label="Period type" value={kind} onChange={setKind} options={[{ id: 'month', label: 'Month' }, { id: 'fy', label: 'Year' }]} />
      {kind === 'month' ? (
        <input type="month" className="input sm" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
      ) : (
        <select className="input sm" value={fy} onChange={(e) => setFy(+e.target.value)} aria-label="Financial year">
          {[0, 1, 2, 3].map((i) => {
            const y = fyStartOf(now) - i
            return <option key={y} value={y}>{fyLabel(y)}</option>
          })}
        </select>
      )}
    </div>
  )
  return { period, picker }
}

export function Money({ v, strong }: { v: number; strong?: boolean }) {
  const { db } = useStore()
  const s = formatMoney(v, db.branding.currency)
  return strong ? <strong>{s}</strong> : <>{s}</>
}

/** Rupees with paise — for tax documents. */
export function money2(v: number, cur = 'INR') {
  return new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : undefined, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

export function ReportActions({ onCsv, printLabel = 'Print / PDF' }: { onCsv: () => void; printLabel?: string }) {
  return (
    <>
      <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={onCsv}>CSV</Button>
      <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>{printLabel}</Button>
    </>
  )
}

/** Editable invoice/bill lines with per-line GST rate and live totals. */
export function LineItemsEditor({ items, onChange, interState, totals = true }: { items: LineItem[]; onChange: (i: LineItem[]) => void; interState: boolean; totals?: boolean }) {
  const { db } = useStore()
  const cur = db.branding.currency
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const t = lineTotals(items, interState)
  return (
    <div className="stack-s">
      <div className="table-wrap">
        <table className="table lines">
          <thead><tr><th>Description</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 120 }}>Rate</th><th style={{ width: 90 }}>GST %</th><th className="right" style={{ width: 120 }}>Amount</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><input className="input sm" style={{ width: '100%' }} value={it.description} onChange={(e) => set(i, { description: e.target.value })} aria-label={`Line ${i + 1} description`} /></td>
                <td><input className="input sm" style={{ width: '100%' }} type="number" min={0} value={it.qty} onChange={(e) => set(i, { qty: Math.max(0, +e.target.value) })} aria-label={`Line ${i + 1} quantity`} /></td>
                <td><input className="input sm" style={{ width: '100%' }} type="number" min={0} step="0.01" value={it.rate || ''} onChange={(e) => set(i, { rate: Math.max(0, +e.target.value) })} aria-label={`Line ${i + 1} rate`} /></td>
                <td>
                  <select className="input sm" style={{ width: '100%' }} value={it.gstRate} onChange={(e) => set(i, { gstRate: +e.target.value })} aria-label={`Line ${i + 1} GST`}>
                    {GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}
                  </select>
                </td>
                <td className="right nowrap">{formatMoney(it.qty * it.rate, cur)}</td>
                <td>{items.length > 1 && <button className="icon-btn sm danger" aria-label="Remove line" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row gap-s">
        <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => onChange([...items, { description: '', qty: 1, rate: 0, gstRate: 18 }])}>Add line</Button>
        <span className="spacer" />
        {totals && <TotalsBlock t={t} interState={interState} />}
      </div>
    </div>
  )
}

export function TotalsBlock({ t, interState, extra }: { t: ReturnType<typeof lineTotals>; interState: boolean; extra?: ReactNode }) {
  const { db } = useStore()
  const cur = db.branding.currency
  return (
    <dl className="mini-dl totals">
      <dt>Taxable value</dt><dd>{money2(t.taxable, cur)}</dd>
      {interState ? (<><dt>IGST</dt><dd>{money2(t.igst, cur)}</dd></>) : (<><dt>CGST</dt><dd>{money2(t.cgst, cur)}</dd><dt>SGST</dt><dd>{money2(t.sgst, cur)}</dd></>)}
      <dt>Total</dt><dd><strong>{money2(t.total, cur)}</strong></dd>
      {extra}
    </dl>
  )
}

/** "Rupees One Lakh Twenty Thousand Only" — required on Indian tax invoices. */
export function amountInWords(n: number) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ' ' + a[x % 10] : ''}`)
  const three = (x: number) => `${x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : ''}${x % 100 ? two(x % 100) : ''}`
  const totalPaise = Math.round(Math.abs(n) * 100) // whole paise first: 99.999 must not yield "100 paise"
  let r = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100
  if (r === 0 && !paise) return 'Zero Only'
  const parts: string[] = []
  const crore = Math.floor(r / 1e7); r %= 1e7
  const lakh = Math.floor(r / 1e5); r %= 1e5
  const thousand = Math.floor(r / 1e3); r %= 1e3
  if (crore) parts.push(`${three(crore)} Crore`)
  if (lakh) parts.push(`${two(lakh)} Lakh`)
  if (thousand) parts.push(`${two(thousand)} Thousand`)
  if (r) parts.push(three(r))
  if (!parts.length) return `${two(paise)} Paise Only`
  return `Rupees ${parts.join(' ')}${paise ? ` and ${two(paise)} Paise` : ''} Only`
}
