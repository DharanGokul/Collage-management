import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Receipt, Wallet, Clock, Building, Eye, Banknote } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Pager, Stat, Tabs, usePaged } from '../../components/ui'
import { LineItemsEditor, Money, ReportActions, TotalsBlock, money2, usePeriod } from './common'
import { TDS_SECTIONS, billTotals, inPeriod, lineTotals, periodLabel } from '../../lib/finance'
import { downloadCSV, formatDate, toISODate, uid } from '../../lib/utils'
import type { Bill, BillCategory, Vendor } from '../../types'

const CATS: BillCategory[] = ['equipment', 'maintenance', 'utilities', 'stationery', 'services', 'professional', 'rent', 'events', 'other']
const STATUS_TONE = { pending: 'amber', approved: 'blue', paid: 'green', cancelled: 'gray' } as const

export default function Bills() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'bills' | 'vendors'>('bills')
  const [status, setStatus] = useState<'all' | Bill['status']>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Bill | null>(null)
  const [paying, setPaying] = useState<Bill | null>(null)
  const [viewing, setViewing] = useState<Bill | null>(null)
  const { period, picker } = usePeriod('fy')
  const cur = db.branding.currency

  // Deep links: ?new=1 · ?request=<approved purchase request id>
  useEffect(() => {
    const req = params.get('request')
    if (params.get('new') || req) {
      const r = req ? db.requests.find((x) => x.id === req) : undefined
      setEditing(blankBill(r ? { requestId: r.id, category: r.category === 'computer' || r.category === 'lab' || r.category === 'av' || r.category === 'projector' ? 'equipment' : 'maintenance', items: [{ description: r.title, qty: r.quantity, rate: Math.round(r.estimatedCost / Math.max(1, r.quantity)), gstRate: 18 }] } : {}))
      params.delete('new')
      params.delete('request')
      setParams(params, { replace: true })
    }
  }, [params, setParams, db.requests])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.bills
      .filter((b) => inPeriod(b.date, period) && (status === 'all' || b.status === status))
      .filter((b) => !t || b.billNo.toLowerCase().includes(t) || (db.vendors.find((v) => v.id === b.vendorId)?.name.toLowerCase() ?? '').includes(t) || b.items.some((i) => i.description.toLowerCase().includes(t)))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [db.bills, db.vendors, period, status, q])
  const paged = usePaged(rows, 20)
  const awaitingBill = db.requests.filter((r) => r.kind === 'purchase' && r.status === 'approved' && !r.billId)

  const sum = (f: (b: Bill) => boolean, k: 'payable' | 'total' | 'tds' = 'payable') => db.bills.filter(f).reduce((a, b) => a + billTotals(b)[k], 0)
  const today = toISODate(new Date())

  return (
    <>
      <PageHeader title="Bills & expenses" subtitle={`Vendor bills with GST and TDS · ${periodLabel(period)}`} actions={<>{picker}<Button icon={<Plus size={16} />} onClick={() => setEditing(blankBill())}>Record bill</Button></>} />
      <div className="grid stats-grid">
        <Stat label="Paid in period" value={<Money v={sum((b) => b.status === 'paid' && inPeriod(b.paidOn ?? b.date, period))} />} icon={<Wallet size={20} />} tone="green" />
        <Stat label="Approved · to pay" value={<Money v={sum((b) => b.status === 'approved')} />} icon={<Banknote size={20} />} tone="blue" hint={`${db.bills.filter((b) => b.status === 'approved').length} bills`} />
        <Stat label="Awaiting management" value={db.bills.filter((b) => b.status === 'pending').length} icon={<Clock size={20} />} tone="amber" />
        <Stat label="Overdue" value={<Money v={sum((b) => b.status !== 'paid' && b.status !== 'cancelled' && b.dueDate < today)} />} icon={<Receipt size={20} />} tone="red" />
      </div>
      {awaitingBill.length > 0 && (
        <div className="alert alert-info">
          <span><strong>{awaitingBill.length} approved purchase{awaitingBill.length > 1 ? 's' : ''}</strong> waiting for a vendor bill: {awaitingBill.map((r) => <button key={r.id} className="link" style={{ background: 'none', border: 0, cursor: 'pointer', marginRight: 8 }} onClick={() => setEditing(blankBill({ requestId: r.id, category: 'equipment', items: [{ description: r.title, qty: r.quantity, rate: Math.round(r.estimatedCost / Math.max(1, r.quantity)), gstRate: 18 }] }))}>{r.ref} · {r.title}</button>)}</span>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} items={[{ id: 'bills', label: `Bills (${rows.length})`, icon: <Receipt size={16} /> }, { id: 'vendors', label: `Vendors (${db.vendors.length})`, icon: <Building size={16} /> }]} />
      {tab === 'bills' ? (
        <Card pad={false}>
          <div className="toolbar">
            <div className="search"><Search size={16} /><input className="input" placeholder="Bill no, vendor, item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bills" /></div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
              <option value="all">All statuses</option><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
            </select>
            <span className="spacer" />
            <ReportActions onCsv={() => downloadCSV(`bills-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Bill no', 'Date', 'Vendor', 'GSTIN', 'Category', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'TDS section', 'TDS', 'Net payable', 'Status', 'Paid on', 'Ref'], ...rows.map((b) => { const t = billTotals(b); const v = db.vendors.find((x) => x.id === b.vendorId); return [b.billNo, b.date, v?.name ?? '', v?.gstin ?? '', b.category, t.taxable, t.cgst, t.sgst, t.igst, t.total, b.tdsSection ?? '', t.tds, t.payable, b.status, b.paidOn ?? '', b.paymentRef ?? ''] })])} />
          </div>
          {rows.length === 0 ? <Empty icon={<Receipt />} title="No bills in this period" /> : (
            <div className="table-wrap print-area">
              <h3 className="print-only">{db.branding.collegeName} — Bills · {periodLabel(period)}</h3>
              <table className="table">
                <thead><tr><th>Bill</th><th className="hide-sm">Vendor</th><th className="hide-sm">Category</th><th className="right">GST</th><th className="right hide-sm">TDS</th><th className="right">Net payable</th><th>Status</th><th className="right" /></tr></thead>
                <tbody>
                  {paged.items.map((b) => {
                    const t = billTotals(b)
                    const v = db.vendors.find((x) => x.id === b.vendorId)
                    return (
                      <tr key={b.id}>
                        <td className="nowrap-cell"><strong className="mono">{b.billNo}</strong><div className="tiny show-sm">{v?.name}</div><div className="muted tiny">{formatDate(b.date)} · due {formatDate(b.dueDate, { day: 'numeric', month: 'short' })}</div></td>
                        <td className="hide-sm">{v?.name}<div className="muted tiny ellipsis" style={{ maxWidth: 240 }}>{b.items.map((i) => i.description).join(', ')}</div></td>
                        <td className="hide-sm"><Badge tone="gray">{b.category}</Badge></td>
                        <td className="right">{money2(t.gst, cur)}</td>
                        <td className="right hide-sm">{t.tds ? <span title={b.tdsSection ?? ''}>{money2(t.tds, cur)}</span> : '—'}</td>
                        <td className="right"><strong>{money2(t.payable, cur)}</strong></td>
                        <td><Badge tone={STATUS_TONE[b.status]}>{b.status === 'pending' ? 'awaiting mgmt' : b.status}</Badge>{b.status !== 'paid' && b.status !== 'cancelled' && b.dueDate < today && <div className="text-red tiny">overdue</div>}</td>
                        <td className="right nowrap">
                          <button className="icon-btn" aria-label={`View ${b.billNo}`} onClick={() => setViewing(b)}><Eye size={16} /></button>
                          {b.status === 'approved' && <Button size="sm" onClick={() => setPaying(b)}>Pay</Button>}
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
      ) : (
        <Vendors />
      )}
      {editing && <BillForm initial={editing} onClose={() => setEditing(null)} />}
      {paying && <PayBill bill={paying} onClose={() => setPaying(null)} />}
      {viewing && <BillView bill={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}

function blankBill(p: Partial<Bill> = {}): Bill {
  const today = toISODate(new Date())
  const due = toISODate(new Date(Date.now() + 15 * 86400000))
  return { id: '', billNo: '', vendorId: '', category: 'services', date: today, dueDate: due, items: [{ description: '', qty: 1, rate: 0, gstRate: 18 }], interState: false, tdsSection: null, tdsRate: 0, status: 'pending', notes: '', createdBy: '', ...p }
}

function BillForm({ initial, onClose }: { initial: Bill; onClose: () => void }) {
  const { db, session, update, toast } = useStore()
  const [b, setB] = useState<Bill>(initial)
  const [touched, setTouched] = useState(false)
  const [newVendor, setNewVendor] = useState<Vendor | null>(null)
  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setB((p) => ({ ...p, [k]: v }))
  const t = billTotals(b)
  const limit = db.tax.procurementApprovalLimit
  const errors = {
    vendor: !b.vendorId && !newVendor?.name.trim() ? 'Choose or add a vendor' : null,
    billNo: !b.billNo.trim() ? 'Vendor’s bill / invoice number' : db.bills.some((x) => x.id !== b.id && x.vendorId === b.vendorId && x.billNo.toLowerCase() === b.billNo.trim().toLowerCase()) ? 'This bill number is already recorded for the vendor' : null,
    items: b.items.some((i) => !i.description.trim() || i.qty <= 0 || i.rate <= 0) ? 'Every line needs a description, quantity and rate' : null,
    date: b.date > toISODate(new Date()) ? 'Bill date cannot be in the future' : !b.date ? 'Enter the bill date' : null,
    due: b.dueDate && b.dueDate < b.date ? 'Due date is before the bill date' : null,
    gstin: newVendor && newVendor.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(newVendor.gstin) ? 'GSTIN format looks wrong' : null,
  }
  const pickVendor = (id: string) => {
    if (id === '__new') return setNewVendor({ id: uid('ven'), name: '', gstin: '', pan: '', state: db.tax.stateCode, email: '', phone: '' })
    setNewVendor(null)
    const v = db.vendors.find((x) => x.id === id)
    setB((p) => ({ ...p, vendorId: id, interState: !!v && v.state !== db.tax.stateCode }))
  }
  const save = () => {
    setTouched(true)
    if (Object.values(errors).some(Boolean)) return
    const isNew = !b.id
    const needsMgmt = t.total > limit
    const saved: Bill = { ...b, id: b.id || uid('bill'), billNo: b.billNo.trim(), vendorId: newVendor?.id ?? b.vendorId, status: isNew ? (needsMgmt ? 'pending' : 'approved') : b.status, createdBy: b.createdBy || session?.userId || '' }
    update((d) => {
      if (newVendor) d.vendors.push({ ...newVendor, name: newVendor.name.trim(), gstin: newVendor.gstin.trim().toUpperCase() })
      if (isNew) d.bills.push(saved)
      else d.bills = d.bills.map((x) => (x.id === saved.id ? saved : x))
      if (saved.requestId) {
        const r = d.requests.find((x) => x.id === saved.requestId)
        if (r && !r.billId) {
          r.billId = saved.id
          r.status = 'in_progress'
          r.timeline.push({ at: new Date().toISOString(), by: session?.name ?? 'Accounts', action: 'Ordered — vendor bill recorded', note: `${saved.billNo}` })
          notify(d, [`${r.requestedBy.role}:${r.requestedBy.userId}`], { kind: 'request', important: false, title: `${r.ref} ordered`, body: `${r.title} — mark it received when it arrives`, link: '/staff/requests' })
        }
      }
      if (isNew && needsMgmt) notify(d, ['admin:admin'], { kind: 'finance', important: true, title: `Bill needs approval · ${saved.billNo}`, body: `${d.vendors.find((v) => v.id === saved.vendorId)?.name} · ${money2(billTotals(saved).payable, d.branding.currency)}`, link: '/admin/approvals?tab=bills' })
    })
    toast(isNew ? (needsMgmt ? 'Bill recorded — sent to management for approval' : 'Bill recorded and approved') : 'Bill updated')
    onClose()
  }
  const req = b.requestId ? db.requests.find((r) => r.id === b.requestId) : undefined
  return (
    <Modal open wide title={b.id ? `Edit ${b.billNo}` : 'Record vendor bill'} onClose={onClose} footer={<><span className="muted tiny" style={{ marginRight: 'auto' }}>{t.total > limit ? `Over ${money2(limit)} → management approval` : 'Within limit → approved on save'}</span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save bill</Button></>}>
      {req && <div className="alert alert-info tiny">For purchase request {req.ref}: {req.title} (approved, est. {money2(req.estimatedCost)})</div>}
      <div className="form-grid">
        <Field label="Vendor" error={touched ? errors.vendor : null}>
          {(id) => (
            <select id={id} className="input" value={newVendor ? '__new' : b.vendorId} onChange={(e) => pickVendor(e.target.value)}>
              <option value="">Select vendor…</option>
              {db.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              <option value="__new">+ New vendor</option>
            </select>
          )}
        </Field>
        <Field label="Vendor bill no." error={touched ? errors.billNo : null}>{(id) => <input id={id} className="input mono" value={b.billNo} onChange={(e) => set('billNo', e.target.value)} />}</Field>
        {newVendor && (
          <>
            <Field label="Vendor name">{(id) => <input id={id} className="input" value={newVendor.name} onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })} autoFocus />}</Field>
            <Field label="GSTIN (optional)" error={touched ? errors.gstin : null}>{(id) => <input id={id} className="input mono" value={newVendor.gstin} onChange={(e) => { const g = e.target.value.toUpperCase(); setNewVendor({ ...newVendor, gstin: g, state: /^\d{2}/.test(g) ? g.slice(0, 2) : newVendor.state, pan: g.length >= 12 ? g.slice(2, 12) : newVendor.pan }); if (/^\d{2}/.test(g)) set('interState', g.slice(0, 2) !== db.tax.stateCode) }} placeholder="29ABCDE1234F1Z5" />}</Field>
          </>
        )}
        <Field label="Category">{(id) => <select id={id} className="input" value={b.category} onChange={(e) => set('category', e.target.value as BillCategory)}>{CATS.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>}</Field>
        <div className="form-grid inner">
          <Field label="Bill date" error={touched ? errors.date : null}>{(id) => <input id={id} type="date" className="input" value={b.date} max={toISODate(new Date())} onChange={(e) => set('date', e.target.value)} />}</Field>
          <Field label="Due date" error={touched ? errors.due : null}>{(id) => <input id={id} type="date" className="input" value={b.dueDate} min={b.date} onChange={(e) => set('dueDate', e.target.value)} />}</Field>
        </div>
        <label className="checkbox span-2"><input type="checkbox" checked={b.interState} onChange={(e) => set('interState', e.target.checked)} /> Inter-state supply (IGST instead of CGST + SGST)</label>
      </div>
      <LineItemsEditor items={b.items} onChange={(items) => set('items', items)} interState={b.interState} totals={false} />
      {touched && errors.items && <div className="alert alert-warn tiny">{errors.items}</div>}
      <div className="form-grid">
        <Field label="TDS section" hint={b.tdsSection ? TDS_SECTIONS.find((x) => x.id === b.tdsSection)?.hint : 'Deduct tax at source when paying contractors, professionals, rent…'}>
          {(id) => (
            <select id={id} className="input" value={b.tdsSection ?? ''} onChange={(e) => { const s = e.target.value || null; setB((p) => ({ ...p, tdsSection: s, tdsRate: s ? db.tax.tdsRates[s] ?? 0 : 0 })) }}>
              <option value="">No TDS</option>
              {TDS_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="TDS rate %" hint="On the value before GST">{(id) => <input id={id} type="number" min={0} max={30} step="0.1" className="input" disabled={!b.tdsSection} value={b.tdsRate} onChange={(e) => set('tdsRate', Math.max(0, +e.target.value))} />}</Field>
        <Field label="Notes" span={2}>{(id) => <input id={id} className="input" value={b.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>
      </div>
      <div className="row"><span className="spacer" /><TotalsBlock t={lineTotals(b.items, b.interState)} interState={b.interState} extra={t.tds > 0 ? (<><dt>TDS {b.tdsSection} @ {b.tdsRate}%</dt><dd>−{money2(t.tds)}</dd><dt>Net payable</dt><dd><strong>{money2(t.payable)}</strong></dd></>) : undefined} /></div>
    </Modal>
  )
}

function PayBill({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { db, session, update, toast } = useStore()
  const t = billTotals(bill)
  const [acc, setAcc] = useState(db.bankAccounts[0]?.id ?? '')
  const [date, setDate] = useState(toISODate(new Date()))
  const [ref, setRef] = useState('')
  const v = db.vendors.find((x) => x.id === bill.vendorId)
  const dateErr = !date ? 'Enter the payment date' : date > toISODate(new Date()) ? 'Payment date cannot be in the future' : date < bill.date ? 'Payment date is before the bill date' : null
  const pay = () => {
    if (dateErr) return
    const paymentRef = ref.trim() || `NEFT-${Date.now().toString(36).toUpperCase()}`
    update((d) => {
      const b = d.bills.find((x) => x.id === bill.id)
      if (!b) return
      Object.assign(b, { status: 'paid', paidOn: date, paymentRef, bankAccountId: acc })
      // Payment from the college account shows on the bank statement, already reconciled.
      d.bankTxns.push({ id: uid('bt'), accountId: acc, date, description: `NEFT DR ${v?.name.toUpperCase() ?? ''}`, ref: paymentRef, debit: t.payable, credit: 0, match: { type: 'bill', id: b.id } })
      if (b.requestId) {
        const r = d.requests.find((x) => x.id === b.requestId)
        if (r) notify(d, [`${r.requestedBy.role}:${r.requestedBy.userId}`], { kind: 'request', important: false, title: `${r.ref}: vendor paid`, body: r.title, link: '/staff/requests' })
      }
    })
    toast(`${bill.billNo} paid · ${money2(t.payable)}${t.tds ? ` (TDS ${money2(t.tds)} withheld)` : ''}`)
    onClose()
    void session
  }
  return (
    <Modal open title={`Pay ${bill.billNo}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Banknote size={16} />} disabled={!acc || !!dateErr} onClick={pay}>Pay {money2(t.payable)}</Button></>}>
      <p><strong>{v?.name}</strong> · {bill.items.map((i) => i.description).join(', ')}</p>
      <dl className="mini-dl"><dt>Bill total</dt><dd>{money2(t.total)}</dd>{t.tds > 0 && (<><dt>TDS withheld ({bill.tdsSection})</dt><dd>−{money2(t.tds)}</dd></>)}<dt>Amount to transfer</dt><dd><strong>{money2(t.payable)}</strong></dd></dl>
      <div className="form-grid">
        <Field label="From account">{(id) => <select id={id} className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>{db.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bank} · {a.accountNo.slice(-4)}</option>)}</select>}</Field>
        <Field label="Payment date" error={dateErr}>{(id) => <input id={id} type="date" className="input" value={date} min={bill.date} max={toISODate(new Date())} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="UTR / reference" span={2} hint="Leave empty to generate one">{(id) => <input id={id} className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}

function BillView({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { db } = useStore()
  const t = billTotals(bill)
  const v = db.vendors.find((x) => x.id === bill.vendorId)
  return (
    <Modal open wide title={`Bill ${bill.billNo}`} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button onClick={() => window.print()}>Print / PDF</Button></>}>
      <div className="print-area stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><span className="spec">Vendor</span><h3>{v?.name}</h3><span className="tiny muted">GSTIN {v?.gstin || 'unregistered'} · PAN {v?.pan || '—'}</span></div>
          <div className="right"><span className="spec">Bill</span><div className="mono">{bill.billNo}</div><span className="tiny muted">{formatDate(bill.date)} · due {formatDate(bill.dueDate)}</span><div><Badge tone={STATUS_TONE[bill.status]}>{bill.status}</Badge></div></div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">GST</th><th className="right">Amount</th></tr></thead>
            <tbody>{bill.items.map((i, k) => <tr key={k}><td>{i.description}</td><td className="right">{i.qty}</td><td className="right">{money2(i.rate)}</td><td className="right">{i.gstRate}%</td><td className="right">{money2(i.qty * i.rate)}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="row"><span className="spacer" /><TotalsBlock t={t} interState={bill.interState} extra={t.tds > 0 ? (<><dt>TDS {bill.tdsSection} @ {bill.tdsRate}%</dt><dd>−{money2(t.tds)}</dd><dt>Net payable</dt><dd><strong>{money2(t.payable)}</strong></dd></>) : undefined} /></div>
        {bill.status === 'paid' && <p className="tiny muted">Paid {formatDate(bill.paidOn!)} · ref {bill.paymentRef} · {db.bankAccounts.find((a) => a.id === bill.bankAccountId)?.bank}</p>}
        {bill.notes && <p className="tiny muted" style={{ whiteSpace: 'pre-wrap' }}>{bill.notes}</p>}
      </div>
    </Modal>
  )
}

function Vendors() {
  const { db, update, toast } = useStore()
  const [v, setV] = useState<Vendor | null>(null)
  const spend = (id: string) => db.bills.filter((b) => b.vendorId === id && b.status === 'paid').reduce((a, b) => a + billTotals(b).payable, 0)
  return (
    <Card pad={false} actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setV({ id: '', name: '', gstin: '', pan: '', state: db.tax.stateCode, email: '', phone: '' })}>Add vendor</Button>} title="Vendors">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Vendor</th><th className="hide-sm">GSTIN</th><th className="hide-sm">PAN</th><th className="right">Paid (all time)</th><th /></tr></thead>
          <tbody>
            {db.vendors.map((x) => (
              <tr key={x.id}>
                <td><strong>{x.name}</strong><div className="muted tiny">{x.email} · {x.phone}</div></td>
                <td className="mono tiny hide-sm">{x.gstin || <span className="muted">unregistered</span>}</td>
                <td className="mono tiny hide-sm">{x.pan}</td>
                <td className="right"><Money v={spend(x.id)} /></td>
                <td className="right"><Button size="sm" variant="ghost" onClick={() => setV(x)}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {v && (
        <Modal open title={v.id ? 'Edit vendor' : 'Add vendor'} onClose={() => setV(null)} footer={<><Button variant="secondary" onClick={() => setV(null)}>Cancel</Button><Button disabled={v.name.trim().length < 2 || (!!v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v.gstin))} onClick={() => { update((d) => { if (v.id) d.vendors = d.vendors.map((x) => (x.id === v.id ? v : x)); else d.vendors.push({ ...v, id: uid('ven') }) }); toast('Vendor saved'); setV(null) }}>Save</Button></>}>
          <div className="form-grid">
            <Field label="Name" span={2}>{(id) => <input id={id} className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />}</Field>
            <Field label="GSTIN" error={v.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v.gstin) ? 'GSTIN format looks wrong' : null}>{(id) => <input id={id} className="input mono" value={v.gstin} onChange={(e) => { const g = e.target.value.toUpperCase(); setV({ ...v, gstin: g, state: /^\d{2}/.test(g) ? g.slice(0, 2) : v.state }) }} />}</Field>
            <Field label="PAN">{(id) => <input id={id} className="input mono" value={v.pan} onChange={(e) => setV({ ...v, pan: e.target.value.toUpperCase() })} />}</Field>
            <Field label="Email">{(id) => <input id={id} className="input" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />}</Field>
            <Field label="Phone">{(id) => <input id={id} className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />}</Field>
          </div>
        </Modal>
      )}
    </Card>
  )
}
