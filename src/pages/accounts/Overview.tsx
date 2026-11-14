import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Receipt, Landmark, Percent, FileText, Banknote, AlertTriangle, ShoppingCart, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Empty } from '../../components/ui'
import { BarChart } from '../../components/charts'
import { Greeting, NeedsYou, type Need } from '../../components/dash'
import { money2 } from './common'
import { accountBalance, billTotals, collections, fyMonths, fyStartOf, gstSummary, lineTotals, tdsBySection, tdsDueDate } from '../../lib/finance'
import { formatDate, formatMoney, studentFeeStatus, toISODate } from '../../lib/utils'

const short = (n: number) => (n >= 1e7 ? `${(n / 1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(Math.round(n)))

export default function AccountsOverview() {
  const { db, session } = useStore()
  const go = useNavigate()
  const today = toISODate(new Date())
  const month = today.slice(0, 7)
  const p = { kind: 'month' as const, key: month }

  const k = useMemo(() => {
    const coll = collections(db, p).reduce((a, x) => a + x.amount + x.lateFee, 0)
    const spent = db.bills.filter((b) => b.status === 'paid' && (b.paidOn ?? '').startsWith(month)).reduce((a, b) => a + billTotals(b).total, 0)
    const bank = db.bankAccounts.reduce((a, acc) => a + accountBalance(db, acc.id), 0)
    let dues = 0
    for (const s of db.students.filter((x) => x.status === 'active')) for (const f of studentFeeStatus(db, s)) if (f.status !== 'paid') dues += f.total
    const tds = tdsBySection(db, p).reduce((a, r) => a + Math.max(0, r.amount - r.deposited), 0)
    return { coll, spent, bank, dues, gst: gstSummary(db, p).outGst, tds }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, month])

  const fy = fyStartOf(new Date())
  const trend = fyMonths(fy).filter((m) => m <= month).slice(-6)
  const chartIn = trend.map((m) => ({ label: new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' }), value: collections(db, { kind: 'month', key: m }).reduce((a, x) => a + x.amount + x.lateFee, 0) }))
  const chartOut = trend.map((m) => ({ label: new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short' }), value: db.bills.filter((b) => b.status === 'paid' && (b.paidOn ?? '').startsWith(m)).reduce((a, b) => a + billTotals(b).total, 0) }))

  const toPay = db.bills.filter((b) => b.status === 'approved')
  const overdueBills = db.bills.filter((b) => b.status !== 'paid' && b.status !== 'cancelled' && b.dueDate < today)
  const unmatched = db.bankTxns.filter((t) => !t.match).length
  const awaitingBill = db.requests.filter((r) => r.kind === 'purchase' && r.status === 'approved' && !r.billId)
  const prevMonth = (() => { const n = new Date(); return toISODate(new Date(n.getFullYear(), n.getMonth() - 1, 1)).slice(0, 7) })()
  const tdsPrev = tdsBySection(db, { kind: 'month', key: prevMonth }).reduce((a, r) => a + Math.max(0, r.amount - r.deposited), 0)

  const needs: Need[] = [
    ...(toPay.length ? [{ id: 'pay', icon: <Banknote size={18} />, title: `${toPay.length} approved bill${toPay.length > 1 ? 's' : ''} to pay`, sub: money2(toPay.reduce((a, b) => a + billTotals(b).payable, 0)), actions: <Button size="sm" variant="ink" onClick={() => go('/accountant/bills')}>Pay bills</Button> }] : []),
    ...(overdueBills.length ? [{ id: 'od', icon: <AlertTriangle size={18} />, alert: true, title: `${overdueBills.length} bill${overdueBills.length > 1 ? 's' : ''} past due date`, sub: overdueBills.map((b) => b.billNo).join(', '), actions: <Button size="sm" variant="secondary" onClick={() => go('/accountant/bills')}>Review</Button> }] : []),
    ...awaitingBill.map<Need>((r) => ({ id: r.id, icon: <ShoppingCart size={18} />, title: `Purchase approved · ${r.ref}`, sub: `${r.title} · est. ${money2(r.estimatedCost)}`, actions: <Button size="sm" variant="ink" onClick={() => go(`/accountant/bills?request=${r.id}`)}>Record vendor bill</Button> })),
    ...(unmatched ? [{ id: 'bank', icon: <Landmark size={18} />, title: `${unmatched} unreconciled bank line${unmatched > 1 ? 's' : ''}`, sub: 'Match them to fees, bills or invoices', actions: <Button size="sm" variant="secondary" onClick={() => go('/accountant/bank')}>Reconcile</Button> }] : []),
    ...(tdsPrev > 0 ? [{ id: 'tds', icon: <Percent size={18} />, alert: tdsDueDate(prevMonth) < today, title: `TDS ${money2(tdsPrev)} due by ${formatDate(tdsDueDate(prevMonth), { day: 'numeric', month: 'short' })}`, sub: `Deducted in ${new Date(prevMonth + '-01T00:00:00').toLocaleDateString(undefined, { month: 'long' })}`, actions: <Button size="sm" variant="secondary" onClick={() => go('/accountant/taxes')}>Record challan</Button> }] : []),
  ]

  const recent = [
    ...db.payments.filter((x) => x.status === 'success').map((x) => ({ at: x.paidAt, in: true, title: db.students.find((s) => s.id === x.studentId)?.name ?? 'Student', sub: `${db.fees.find((f) => f.id === x.feeId)?.name} · ${x.method.toUpperCase()}`, amt: x.amount + x.lateFee })),
    ...db.bills.filter((b) => b.status === 'paid').map((b) => ({ at: b.paidOn! + 'T12:00:00', in: false, title: db.vendors.find((v) => v.id === b.vendorId)?.name ?? 'Vendor', sub: `${b.billNo} · ${b.category}`, amt: billTotals(b).payable })),
    ...db.invoices.filter((i) => i.kind === 'other' && i.status === 'paid').map((i) => ({ at: (i.paidOn ?? i.date) + 'T12:00:00', in: true, title: i.customer?.name ?? '', sub: i.invoiceNo, amt: lineTotals(i.items, i.interState).total })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8)

  return (
    <>
      <Greeting
        name={session?.name ?? 'Accounts'}
        kpis={[
          { icon: <Wallet size={18} />, value: formatMoney(k.coll, db.branding.currency), label: 'Collected this month' },
          { icon: <Receipt size={18} />, value: formatMoney(k.spent, db.branding.currency), label: 'Spent this month' },
          { icon: <Landmark size={18} />, value: formatMoney(k.bank, db.branding.currency), label: 'Bank balance (all accounts)' },
          { icon: <FileText size={18} />, value: formatMoney(k.dues, db.branding.currency), label: 'Student dues outstanding' },
        ]}
        action={<Button variant="ink" icon={<Receipt size={16} />} onClick={() => go('/accountant/bills?new=1')}>Record bill</Button>}
      />
      <div className="grid dash">
        <Card title="Collections vs expenses" actions={<Link to="/accountant/reports" className="link">Reports</Link>}>
          <div className="grid two">
            <div><span className="spec">Collections</span><BarChart data={chartIn} format={short} height={170} /></div>
            <div><span className="spec">Expenses</span><BarChart data={chartOut} format={short} height={170} /></div>
          </div>
          <div className="tri mt">
            <div><strong>{money2(k.coll - k.spent)}</strong><span className="muted tiny">net this month</span></div>
            <div><strong>{money2(k.gst)}</strong><span className="muted tiny">output GST</span></div>
            <div><strong>{money2(k.tds)}</strong><span className="muted tiny">TDS to deposit</span></div>
          </div>
        </Card>
        <NeedsYou items={needs} empty="Books are up to date." />
      </div>
      <div className="grid two">
        <Card title="Bank accounts" actions={<Link to="/accountant/bank" className="link">Statements</Link>}>
          <div className="stack-s">
            {db.bankAccounts.map((a) => (
              <div key={a.id} className="coming-item" style={{ cursor: 'default' }}>
                <span className="kind-tile"><Landmark size={18} /></span>
                <span className="coming-main"><strong>{a.bank}</strong><small>{a.accountName} · •••• {a.accountNo.slice(-4)}</small></span>
                <strong>{money2(accountBalance(db, a.id))}</strong>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Recent transactions" pad={false}>
          {recent.length === 0 ? <Empty title="No transactions" /> : (
            <ul className="schedule">
              {recent.map((r, i) => (
                <li key={i}>
                  <span className={`txn-ico ${r.in ? 'in' : 'out'}`}>{r.in ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span>
                  <div><strong className="ellipsis">{r.title}</strong><small className="muted ellipsis">{r.sub} · {formatDate(r.at, { day: 'numeric', month: 'short' })}</small></div>
                  <strong className={r.in ? 'text-green' : ''}>{r.in ? '+' : '−'}{money2(r.amt)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
