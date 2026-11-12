import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Card, PageHeader, Stat } from '../../components/ui'
import { BarChart } from '../../components/charts'
import { ReportActions, money2, usePeriod } from './common'
import { accountBalance, billTotals, collections, fyMonths, fyStartOf, inPeriod, lineTotals, periodLabel, periodRange, type Period } from '../../lib/finance'
import { downloadCSV, studentFeeStatus } from '../../lib/utils'
import type { Database } from '../../types'

type Report = 'collections' | 'expenses' | 'ie' | 'dues' | 'bank'
const REPORTS: { id: Report; label: string }[] = [
  { id: 'collections', label: 'Fee collections' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'ie', label: 'Income & expenditure' },
  { id: 'dues', label: 'Outstanding dues' },
  { id: 'bank', label: 'Bank summary' },
]

const short = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(Math.round(n)))
const monthsOf = (p: Period) => (p.kind === 'fy' ? fyMonths(p.start) : fyMonths(fyStartOf(new Date(p.key + '-01T00:00:00'))))
const mLabel = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' })

function income(db: Database, p: Period) {
  const fees = collections(db, p).reduce((a, x) => a + x.amount + x.lateFee, 0)
  const other = db.invoices.filter((i) => i.kind === 'other' && i.status === 'paid' && inPeriod(i.paidOn ?? i.date, p)).reduce((a, i) => a + lineTotals(i.items, i.interState).total, 0)
  return { fees, other, total: fees + other }
}
function expense(db: Database, p: Period) {
  // Expense recognised when paid; includes GST (not creditable) and TDS withheld (paid to govt).
  return db.bills.filter((b) => b.status === 'paid' && inPeriod(b.paidOn ?? b.date, p)).reduce((a, b) => a + billTotals(b).total, 0)
}

export default function Reports() {
  const { db, session } = useStore()
  const [report, setReport] = useState<Report>('collections')
  const { period, picker } = usePeriod('fy')
  const title = `${REPORTS.find((r) => r.id === report)?.label} · ${periodLabel(period)}`
  return (
    <>
      <PageHeader title={session?.role === 'admin' ? 'Finance reports' : 'Reports'} subtitle="Month-wise and year-wise (April–March) · export CSV or print to PDF" actions={picker} />
      <div className="chip-scroll" role="tablist" aria-label="Report">
        {REPORTS.map((r) => <button key={r.id} role="tab" aria-selected={report === r.id} className={`chip ${report === r.id ? 'active' : ''}`} onClick={() => setReport(r.id)}><BarChart3 size={14} /> {r.label}</button>)}
      </div>
      <div className="print-area stack-l">
        <h2 className="print-only">{db.tax.legalName} — {title}</h2>
        {report === 'collections' && <Collections period={period} />}
        {report === 'expenses' && <Expenses period={period} />}
        {report === 'ie' && <IncomeExpenditure period={period} />}
        {report === 'dues' && <Dues />}
        {report === 'bank' && <BankSummary period={period} />}
      </div>
    </>
  )
}

function Breakdown({ title, rows, total, csvName }: { title: string; rows: [string, number, number?][]; total: number; csvName: string }) {
  return (
    <Card title={title} pad={false} actions={<ReportActions onCsv={() => downloadCSV(csvName, [['Item', 'Amount', 'Count', '% of total'], ...rows.map(([k, v, c]) => [k, v, c ?? '', total ? ((v / total) * 100).toFixed(1) : '0'])])} />}>
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {rows.map(([k, v, c]) => (
              <tr key={k}>
                <td>{k}{c !== undefined && <span className="muted tiny"> · {c}</span>}</td>
                <td style={{ width: '40%' }}><div className="progress"><div className="progress-bar tone-bg-ink" style={{ width: `${total ? (v / total) * 100 : 0}%` }} /></div></td>
                <td className="right nowrap"><strong>{money2(v)}</strong></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="center muted">Nothing in this period.</td></tr>}
          </tbody>
          {rows.length > 0 && <tfoot><tr><td><strong>Total</strong></td><td /><td className="right"><strong>{money2(total)}</strong></td></tr></tfoot>}
        </table>
      </div>
    </Card>
  )
}

function group<T>(items: T[], key: (t: T) => string, val: (t: T) => number) {
  const m = new Map<string, [number, number]>()
  for (const it of items) {
    const k = key(it)
    const cur = m.get(k) ?? [0, 0]
    m.set(k, [cur[0] + val(it), cur[1] + 1])
  }
  return [...m.entries()].map(([k, [v, c]]) => [k, v, c] as [string, number, number]).sort((a, b) => b[1] - a[1])
}

function Collections({ period }: { period: Period }) {
  const { db } = useStore()
  const pays = collections(db, period)
  const total = pays.reduce((a, p) => a + p.amount + p.lateFee, 0)
  const late = pays.reduce((a, p) => a + p.lateFee, 0)
  const byFee = group(pays, (p) => db.fees.find((f) => f.id === p.feeId)?.name ?? 'Other', (p) => p.amount + p.lateFee)
  const byMode = group(pays, (p) => p.method.toUpperCase(), (p) => p.amount + p.lateFee)
  const byDept = group(pays, (p) => db.students.find((s) => s.id === p.studentId)?.department ?? '—', (p) => p.amount + p.lateFee)
  const months = monthsOf(period).map((m) => ({ label: mLabel(m), value: collections(db, { kind: 'month', key: m }).reduce((a, p) => a + p.amount + p.lateFee, 0) }))
  return (
    <>
      <div className="grid stats-grid">
        <Stat label="Collected" value={money2(total)} icon={<BarChart3 size={20} />} tone="green" />
        <Stat label="Receipts" value={pays.length} icon={<BarChart3 size={20} />} />
        <Stat label="Late fees" value={money2(late)} icon={<BarChart3 size={20} />} tone="amber" />
        <Stat label="Average receipt" value={money2(pays.length ? total / pays.length : 0)} icon={<BarChart3 size={20} />} tone="blue" />
      </div>
      <Card title="Month-wise collections"><BarChart data={months} format={short} /></Card>
      <div className="grid three-col">
        <Breakdown title="By fee item" rows={byFee} total={total} csvName="collections-by-fee.csv" />
        <Breakdown title="By payment mode" rows={byMode} total={total} csvName="collections-by-mode.csv" />
        <Breakdown title="By department" rows={byDept} total={total} csvName="collections-by-department.csv" />
      </div>
    </>
  )
}

function Expenses({ period }: { period: Period }) {
  const { db } = useStore()
  const bills = db.bills.filter((b) => b.status === 'paid' && inPeriod(b.paidOn ?? b.date, period))
  const total = bills.reduce((a, b) => a + billTotals(b).total, 0)
  const byCat = group(bills, (b) => b.category[0].toUpperCase() + b.category.slice(1), (b) => billTotals(b).total)
  const byVendor = group(bills, (b) => db.vendors.find((v) => v.id === b.vendorId)?.name ?? '—', (b) => billTotals(b).total)
  const months = monthsOf(period).map((m) => ({ label: mLabel(m), value: expense(db, { kind: 'month', key: m }) }))
  const gst = bills.reduce((a, b) => a + billTotals(b).gst, 0)
  const tds = bills.reduce((a, b) => a + billTotals(b).tds, 0)
  return (
    <>
      <div className="grid stats-grid">
        <Stat label="Spent" value={money2(total)} icon={<BarChart3 size={20} />} tone="red" />
        <Stat label="Bills paid" value={bills.length} icon={<BarChart3 size={20} />} />
        <Stat label="GST paid" value={money2(gst)} icon={<BarChart3 size={20} />} tone="blue" />
        <Stat label="TDS withheld" value={money2(tds)} icon={<BarChart3 size={20} />} tone="amber" />
      </div>
      <Card title="Month-wise expenses"><BarChart data={months} format={short} /></Card>
      <div className="grid two">
        <Breakdown title="By category" rows={byCat} total={total} csvName="expenses-by-category.csv" />
        <Breakdown title="By vendor" rows={byVendor} total={total} csvName="expenses-by-vendor.csv" />
      </div>
    </>
  )
}

function IncomeExpenditure({ period }: { period: Period }) {
  const { db } = useStore()
  const rows = monthsOf(period)
    .filter((m) => period.kind === 'fy' || m === period.key)
    .map((m) => {
      const p: Period = { kind: 'month', key: m }
      const inc = income(db, p)
      const exp = expense(db, p)
      return { m, ...inc, exp, net: inc.total - exp }
    })
  const t = rows.reduce((a, r) => ({ fees: a.fees + r.fees, other: a.other + r.other, total: a.total + r.total, exp: a.exp + r.exp, net: a.net + r.net }), { fees: 0, other: 0, total: 0, exp: 0, net: 0 })
  return (
    <>
      <div className="grid stats-grid three">
        <Stat label="Income" value={money2(t.total)} icon={<BarChart3 size={20} />} tone="green" hint={`Fees ${money2(t.fees)} · other ${money2(t.other)}`} />
        <Stat label="Expenditure" value={money2(t.exp)} icon={<BarChart3 size={20} />} tone="red" />
        <Stat label={t.net >= 0 ? 'Surplus' : 'Deficit'} value={money2(Math.abs(t.net))} icon={<BarChart3 size={20} />} tone={t.net >= 0 ? 'green' : 'red'} />
      </div>
      <Card title="Income & expenditure statement" pad={false} actions={<ReportActions onCsv={() => downloadCSV(`income-expenditure-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Month', 'Fee income', 'Other income', 'Total income', 'Expenditure', 'Surplus/(deficit)'], ...rows.map((r) => [r.m, r.fees, r.other, r.total, r.exp, r.net]), ['Total', t.fees, t.other, t.total, t.exp, t.net]])} />}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Month</th><th className="right">Fee income</th><th className="right hide-sm">Other income</th><th className="right">Expenditure</th><th className="right">Surplus / (deficit)</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.m}><td>{new Date(r.m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td><td className="right">{money2(r.fees)}</td><td className="right hide-sm">{money2(r.other)}</td><td className="right">{money2(r.exp)}</td><td className={`right ${r.net < 0 ? 'text-red' : ''}`}><strong>{r.net < 0 ? `(${money2(-r.net)})` : money2(r.net)}</strong></td></tr>)}</tbody>
            <tfoot><tr><td><strong>Total</strong></td><td className="right">{money2(t.fees)}</td><td className="right hide-sm">{money2(t.other)}</td><td className="right">{money2(t.exp)}</td><td className="right"><strong>{t.net < 0 ? `(${money2(-t.net)})` : money2(t.net)}</strong></td></tr></tfoot>
          </table>
        </div>
      </Card>
    </>
  )
}

function Dues() {
  const { db } = useStore()
  const today = new Date()
  const rows = useMemo(() => {
    const out: { roll: string; name: string; dept: string; fee: string; due: string; amount: number; bucket: string }[] = []
    for (const s of db.students.filter((x) => x.status === 'active'))
      for (const f of studentFeeStatus(db, s).filter((x) => x.status !== 'paid')) {
        const days = Math.floor((today.getTime() - new Date(f.fee.dueDate + 'T23:59:59').getTime()) / 86400000)
        out.push({ roll: s.rollNo, name: s.name, dept: s.department, fee: f.fee.name, due: f.fee.dueDate, amount: f.total, bucket: days < 0 ? 'Not yet due' : days <= 30 ? '0–30 days' : days <= 60 ? '31–60 days' : '60+ days' })
      }
    return out.sort((a, b) => a.due.localeCompare(b.due))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const buckets = ['Not yet due', '0–30 days', '31–60 days', '60+ days'].map((b) => [b, rows.filter((r) => r.bucket === b).reduce((a, r) => a + r.amount, 0), rows.filter((r) => r.bucket === b).length] as [string, number, number])
  const byDept = group(rows, (r) => r.dept, (r) => r.amount)
  return (
    <>
      <div className="grid stats-grid">
        {buckets.map(([b, v, c]) => <Stat key={b} label={b} value={money2(v)} hint={`${c} dues`} icon={<BarChart3 size={20} />} tone={b === '60+ days' ? 'red' : b === 'Not yet due' ? 'blue' : 'amber'} />)}
      </div>
      <div className="grid two">
        <Breakdown title="Ageing" rows={buckets} total={total} csvName="dues-ageing.csv" />
        <Breakdown title="By department" rows={byDept} total={total} csvName="dues-by-department.csv" />
      </div>
      <Card title={`Student-wise dues (${rows.length})`} pad={false} actions={<ReportActions onCsv={() => downloadCSV('outstanding-dues.csv', [['Roll no', 'Student', 'Dept', 'Fee', 'Due date', 'Amount (incl. late fee)', 'Ageing'], ...rows.map((r) => [r.roll, r.name, r.dept, r.fee, r.due, r.amount, r.bucket])])} />}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th className="hide-sm">Fee</th><th>Ageing</th><th className="right">Amount</th></tr></thead>
            <tbody>{rows.slice(0, 100).map((r, i) => <tr key={i}><td><strong>{r.name}</strong><div className="muted tiny mono">{r.roll} · {r.dept}</div></td><td className="hide-sm tiny">{r.fee}</td><td className="tiny">{r.bucket}</td><td className="right">{money2(r.amount)}</td></tr>)}</tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

function BankSummary({ period }: { period: Period }) {
  const { db } = useStore()
  const [from, to] = periodRange(period)
  const prev = new Date(from + 'T00:00:00')
  prev.setDate(prev.getDate() - 1)
  const rows = db.bankAccounts.map((a) => {
    const lines = db.bankTxns.filter((t) => t.accountId === a.id && t.date >= from && t.date <= to)
    return { a, opening: accountBalance(db, a.id, prev.toISOString().slice(0, 10)), credits: lines.reduce((x, l) => x + l.credit, 0), debits: lines.reduce((x, l) => x + l.debit, 0), closing: accountBalance(db, a.id, to), unmatched: lines.filter((l) => !l.match).length }
  })
  return (
    <Card title="Bank summary" pad={false} actions={<ReportActions onCsv={() => downloadCSV(`bank-summary-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Bank', 'Account', 'Opening', 'Credits', 'Debits', 'Closing', 'Unreconciled'], ...rows.map((r) => [r.a.bank, r.a.accountNo, r.opening, r.credits, r.debits, r.closing, r.unmatched])])} />}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Account</th><th className="right">Opening</th><th className="right">Credits</th><th className="right">Debits</th><th className="right">Closing</th><th className="right">Unreconciled</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.a.id}><td><strong>{r.a.bank}</strong><div className="muted tiny">•••• {r.a.accountNo.slice(-4)}</div></td><td className="right">{money2(r.opening)}</td><td className="right text-green">{money2(r.credits)}</td><td className="right text-red">{money2(r.debits)}</td><td className="right"><strong>{money2(r.closing)}</strong></td><td className="right">{r.unmatched}</td></tr>)}</tbody>
          <tfoot><tr><td><strong>Total</strong></td><td className="right">{money2(rows.reduce((a, r) => a + r.opening, 0))}</td><td className="right">{money2(rows.reduce((a, r) => a + r.credits, 0))}</td><td className="right">{money2(rows.reduce((a, r) => a + r.debits, 0))}</td><td className="right"><strong>{money2(rows.reduce((a, r) => a + r.closing, 0))}</strong></td><td className="right">{rows.reduce((a, r) => a + r.unmatched, 0)}</td></tr></tfoot>
        </table>
      </div>
    </Card>
  )
}
