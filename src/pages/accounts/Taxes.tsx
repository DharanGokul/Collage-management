import { useMemo, useState } from 'react'
import { Percent, Receipt, Landmark, Settings2, Plus, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Field, Modal, PageHeader, Stat, Tabs } from '../../components/ui'
import { ReportActions, money2, usePeriod } from './common'
import { TDS_SECTIONS, billTotals, lineTotals, fyMonths, fyStartOf, gstSummary, inPeriod, periodLabel, tdsBySection, tdsDueDate, type Period } from '../../lib/finance'
import { downloadCSV, formatDate, toISODate, uid } from '../../lib/utils'
import type { FeeItem, TaxSettings } from '../../types'

type Tab = 'gst' | 'tds' | 'settings'

export default function Taxes() {
  const { db } = useStore()
  const [tab, setTab] = useState<Tab>('gst')
  const { period, picker } = usePeriod('month')
  return (
    <>
      <PageHeader title="Taxes" subtitle={`GST and TDS · ${periodLabel(period)}`} actions={picker} />
      <div className="alert alert-info tiny">
        <AlertTriangle size={14} />
        <span>Education services to students are exempt from GST, so input GST on purchases is usually a cost, not a credit. TDS is deducted on the value before GST and deposited by the 7th of the next month (30 April for March). Check rates with your auditor — this is a working register, not tax advice.</span>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'gst', label: 'GST', icon: <Percent size={16} /> }, { id: 'tds', label: 'TDS', icon: <Receipt size={16} /> }, { id: 'settings', label: 'Tax settings', icon: <Settings2 size={16} /> }]} />
      {tab === 'gst' && <Gst period={period} />}
      {tab === 'tds' && <Tds period={period} />}
      {tab === 'settings' && <TaxSettingsForm key={JSON.stringify(db.tax)} />}
    </>
  )
}

function Gst({ period }: { period: Period }) {
  const { db } = useStore()
  const g = gstSummary(db, period)
  const fy = period.kind === 'fy' ? period.start : fyStartOf(new Date(period.key + '-01T00:00:00'))
  const months = fyMonths(fy).map((m) => ({ m, ...gstSummary(db, { kind: 'month', key: m }) }))
  const taxableInvoices = db.invoices.filter((i) => i.kind === 'other' && i.status !== 'void' && inPeriod(i.date, period))
  return (
    <>
      <div className="grid stats-grid">
        <Stat label="Output GST" value={money2(g.outGst)} icon={<Percent size={20} />} tone="red" hint={`on ${money2(g.outTaxable)} taxable`} />
        <Stat label="Exempt supplies" value={money2(g.exempt)} icon={<Percent size={20} />} tone="green" hint="Fees (education services)" />
        <Stat label="GST paid on purchases" value={money2(g.inGst)} icon={<Receipt size={20} />} tone="blue" hint={`on ${money2(g.inTaxable)}`} />
        <Stat label="Net GST payable" value={money2(g.outGst)} icon={<Landmark size={20} />} tone="amber" hint="ITC not claimed (exempt-heavy)" />
      </div>
      <Card title={`Month-wise · FY ${fy}-${String((fy + 1) % 100).padStart(2, '0')}`} pad={false} actions={<ReportActions onCsv={() => downloadCSV(`gst-summary-FY${fy}.csv`, [['Month', 'Taxable outward', 'Output GST', 'Exempt', 'Inward taxable', 'Input GST'], ...months.map((r) => [r.m, r.outTaxable, r.outGst, r.exempt, r.inTaxable, r.inGst])])} />}>
        <div className="table-wrap print-area">
          <h3 className="print-only">{db.tax.legalName} · GSTIN {db.tax.gstin} · GST summary FY {fy}</h3>
          <table className="table">
            <thead><tr><th>Month</th><th className="right">Taxable outward</th><th className="right">Output GST</th><th className="right hide-sm">Exempt</th><th className="right">Input GST</th><th className="hide-sm">GSTR-3B due</th></tr></thead>
            <tbody>
              {months.map((r) => {
                const [y, mm] = r.m.split('-').map(Number)
                const due = toISODate(new Date(y, mm, 20))
                return (
                  <tr key={r.m} style={period.kind === 'month' && period.key === r.m ? { background: 'var(--accent-soft)' } : undefined}>
                    <td>{new Date(r.m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</td>
                    <td className="right">{money2(r.outTaxable)}</td>
                    <td className="right">{money2(r.outGst)}</td>
                    <td className="right hide-sm">{money2(r.exempt)}</td>
                    <td className="right">{money2(r.inGst)}</td>
                    <td className="hide-sm tiny">{formatDate(due, { day: 'numeric', month: 'short' })}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot><tr><td><strong>Total</strong></td><td className="right">{money2(months.reduce((a, r) => a + r.outTaxable, 0))}</td><td className="right"><strong>{money2(months.reduce((a, r) => a + r.outGst, 0))}</strong></td><td className="right hide-sm">{money2(months.reduce((a, r) => a + r.exempt, 0))}</td><td className="right">{money2(months.reduce((a, r) => a + r.inGst, 0))}</td><td className="hide-sm" /></tr></tfoot>
          </table>
        </div>
      </Card>
      <Card title="Taxable invoices (GSTR-1 view)" pad={false} actions={<ReportActions onCsv={() => downloadCSV('gstr1-b2b.csv', [['Invoice', 'Date', 'Customer', 'GSTIN', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'], ...taxableInvoices.map((i) => { const t = lineTotals(i.items, i.interState); return [i.invoiceNo, i.date, i.customer?.name ?? '', i.customer?.gstin ?? '', t.taxable, t.cgst, t.sgst, t.igst, t.total] })])} />}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice</th><th>Customer</th><th className="right">Taxable</th><th className="right">GST</th><th>Type</th></tr></thead>
            <tbody>
              {taxableInvoices.map((i) => { const t = lineTotals(i.items, i.interState); return <tr key={i.id}><td className="mono tiny">{i.invoiceNo}<div className="muted">{formatDate(i.date)}</div></td><td>{i.customer?.name}<div className="muted tiny mono">{i.customer?.gstin || 'B2C'}</div></td><td className="right">{money2(t.taxable)}</td><td className="right">{money2(t.gst)}</td><td><Badge tone="gray">{i.customer?.gstin ? 'B2B' : 'B2C'}</Badge></td></tr> })}
              {taxableInvoices.length === 0 && <tr><td colSpan={5} className="center muted">No taxable invoices in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function Tds({ period }: { period: Period }) {
  const { db, update, toast } = useStore()
  const [recording, setRecording] = useState(false)
  const rows = tdsBySection(db, period)
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const deposited = rows.reduce((a, r) => a + r.deposited, 0)
  const deductions = useMemo(() => db.bills.filter((b) => b.tdsSection && b.status !== 'cancelled' && inPeriod(b.date, period)).sort((a, b) => b.date.localeCompare(a.date)), [db.bills, period])
  const today = toISODate(new Date())
  const overdue = deductions.filter((b) => tdsDueDate(b.date.slice(0, 7)) < today && !db.tdsDeposits.some((d) => d.month === b.date.slice(0, 7) && d.section === b.tdsSection)).length
  return (
    <>
      <div className="grid stats-grid">
        <Stat label="TDS deducted" value={money2(total)} icon={<Receipt size={20} />} />
        <Stat label="Deposited" value={money2(deposited)} icon={<Landmark size={20} />} tone="green" />
        <Stat label="To deposit" value={money2(Math.max(0, total - deposited))} icon={<Landmark size={20} />} tone="amber" />
        <Stat label="Overdue deductions" value={overdue} icon={<AlertTriangle size={20} />} tone={overdue ? 'red' : 'green'} hint="Past the 7th of next month" />
      </div>
      <Card title="By section" pad={false} actions={<><Button size="sm" icon={<Plus size={14} />} onClick={() => setRecording(true)}>Record challan</Button><ReportActions onCsv={() => downloadCSV(`tds-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Bill', 'Date', 'Vendor', 'PAN', 'Section', 'Rate', 'Base', 'TDS', 'Due date'], ...deductions.map((b) => { const t = billTotals(b); const v = db.vendors.find((x) => x.id === b.vendorId); return [b.billNo, b.date, v?.name ?? '', v?.pan ?? '', b.tdsSection ?? '', b.tdsRate, t.taxable, t.tds, tdsDueDate(b.date.slice(0, 7))] })])} /></>}>
        <div className="table-wrap print-area">
          <h3 className="print-only">{db.tax.legalName} · TAN {db.tax.tan} · TDS · {periodLabel(period)}</h3>
          <table className="table">
            <thead><tr><th>Section</th><th className="right">Bills</th><th className="right">Deducted</th><th className="right">Deposited</th><th className="right">Balance</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.section}><td><strong>{r.section}</strong><div className="muted tiny">{TDS_SECTIONS.find((s) => s.id === r.section)?.label.split('· ')[1]}</div></td><td className="right">{r.bills}</td><td className="right">{money2(r.amount)}</td><td className="right">{money2(r.deposited)}</td><td className="right"><strong>{money2(Math.max(0, r.amount - r.deposited))}</strong></td></tr>)}
              {rows.length === 0 && <tr><td colSpan={5} className="center muted">No TDS deducted in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Deductions" pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Bill</th><th>Deductee</th><th>Section</th><th className="right">TDS</th><th>Deposit due</th></tr></thead>
            <tbody>
              {deductions.map((b) => {
                const t = billTotals(b)
                const v = db.vendors.find((x) => x.id === b.vendorId)
                const due = tdsDueDate(b.date.slice(0, 7))
                const done = db.tdsDeposits.some((d) => d.month === b.date.slice(0, 7) && d.section === b.tdsSection)
                return <tr key={b.id}><td className="mono tiny">{b.billNo}<div className="muted">{formatDate(b.date)}</div></td><td>{v?.name}<div className="muted tiny mono">PAN {v?.pan}</div></td><td>{b.tdsSection} @ {b.tdsRate}%</td><td className="right">{money2(t.tds)}</td><td>{done ? <Badge tone="green">deposited</Badge> : <Badge tone={due < today ? 'red' : 'amber'}>{formatDate(due, { day: 'numeric', month: 'short' })}</Badge>}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Challans" pad={false}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Month</th><th>Section</th><th>Challan</th><th>Deposited</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {db.tdsDeposits.slice().reverse().map((d) => <tr key={d.id}><td>{d.month}</td><td>{d.section}</td><td className="mono tiny">{d.challanNo}</td><td>{formatDate(d.depositedOn)}</td><td className="right">{money2(d.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>
      {recording && <ChallanForm onClose={() => setRecording(false)} onSave={(c) => { update((d) => { d.tdsDeposits.push(c) }); toast('Challan recorded'); setRecording(false) }} />}
    </>
  )
}

function ChallanForm({ onClose, onSave }: { onClose: () => void; onSave: (c: { id: string; month: string; section: string; amount: number; challanNo: string; depositedOn: string }) => void }) {
  const { db } = useStore()
  const prev = new Date()
  prev.setMonth(prev.getMonth() - 1)
  const [month, setMonth] = useState(toISODate(prev).slice(0, 7))
  const [section, setSection] = useState('194C')
  const owed = tdsBySection(db, { kind: 'month', key: month }).find((r) => r.section === section)
  const [amount, setAmount] = useState(0)
  const [challanNo, setChallanNo] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  return (
    <Modal open title="Record TDS challan (ITNS 281)" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!amount || !challanNo.trim()} onClick={() => onSave({ id: uid('tds'), month, section, amount, challanNo: challanNo.trim(), depositedOn: date })}>Save</Button></>}>
      <div className="form-grid">
        <Field label="Deducted in month">{(id) => <input id={id} type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />}</Field>
        <Field label="Section">{(id) => <select id={id} className="input" value={section} onChange={(e) => setSection(e.target.value)}>{TDS_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}</select>}</Field>
        <Field label="Amount" hint={owed ? `Deducted: ${money2(owed.amount)} · already deposited ${money2(owed.deposited)}` : 'Nothing deducted under this section'}>{(id) => <input id={id} type="number" min={0} className="input" value={amount || ''} onChange={(e) => setAmount(Math.max(0, +e.target.value))} />}</Field>
        <Field label="Deposited on">{(id) => <input id={id} type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Challan / CIN" span={2}>{(id) => <input id={id} className="input mono" value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}

function TaxSettingsForm() {
  const { db, update, toast } = useStore()
  const [t, setT] = useState<TaxSettings>(db.tax)
  const gstOk = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(t.gstin)
  const panOk = /^[A-Z]{5}\d{4}[A-Z]$/.test(t.pan)
  const tanOk = /^[A-Z]{4}\d{5}[A-Z]$/.test(t.tan)
  return (
    <div className="grid two">
      <Card title="Registrations">
        <div className="form-grid">
          <Field label="Legal name" span={2}>{(id) => <input id={id} className="input" value={t.legalName} onChange={(e) => setT({ ...t, legalName: e.target.value })} />}</Field>
          <Field label="GSTIN" error={gstOk ? null : '15-character GSTIN'}>{(id) => <input id={id} className="input mono" value={t.gstin} onChange={(e) => { const g = e.target.value.toUpperCase(); setT({ ...t, gstin: g, stateCode: /^\d{2}/.test(g) ? g.slice(0, 2) : t.stateCode }) }} />}</Field>
          <Field label="State code">{(id) => <input id={id} className="input mono" value={t.stateCode} onChange={(e) => setT({ ...t, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })} />}</Field>
          <Field label="PAN" error={panOk ? null : 'Format ABCDE1234F'}>{(id) => <input id={id} className="input mono" value={t.pan} onChange={(e) => setT({ ...t, pan: e.target.value.toUpperCase() })} />}</Field>
          <Field label="TAN" error={tanOk ? null : 'Format ABCD12345E'}>{(id) => <input id={id} className="input mono" value={t.tan} onChange={(e) => setT({ ...t, tan: e.target.value.toUpperCase() })} />}</Field>
          <Field label="Purchase approval limit" span={2} hint="Purchases and bills above this need management approval">{(id) => <input id={id} type="number" min={0} className="input" value={t.procurementApprovalLimit} onChange={(e) => setT({ ...t, procurementApprovalLimit: Math.max(0, +e.target.value) })} />}</Field>
        </div>
      </Card>
      <Card title="Rates">
        <span className="spec">GST on fees (fee amounts are GST-inclusive)</span>
        <div className="form-grid mt-s">
          {(Object.keys(t.feeGst) as FeeItem['category'][]).map((c) => (
            <Field key={c} label={c}>{(id) => <select id={id} className="input" value={t.feeGst[c]} onChange={(e) => setT({ ...t, feeGst: { ...t.feeGst, [c]: +e.target.value } })}>{[0, 5, 12, 18].map((r) => <option key={r} value={r}>{r}%</option>)}</select>}</Field>
          ))}
        </div>
        <span className="spec mt" style={{ display: 'block' }}>Default TDS rates</span>
        <div className="form-grid mt-s">
          {TDS_SECTIONS.map((s) => <Field key={s.id} label={s.id} hint={s.hint}>{(id) => <input id={id} type="number" min={0} max={30} step="0.1" className="input" value={t.tdsRates[s.id] ?? 0} onChange={(e) => setT({ ...t, tdsRates: { ...t.tdsRates, [s.id]: Math.max(0, +e.target.value) } })} />}</Field>)}
        </div>
        <div className="row mt"><span className="spacer" /><Button disabled={!gstOk || !panOk || !tanOk || JSON.stringify(t) === JSON.stringify(db.tax)} onClick={() => { update((d) => { d.tax = t }); toast('Tax settings saved') }}>Save</Button></div>
      </Card>
    </div>
  )
}
