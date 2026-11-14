import { useDeferredValue, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Send, Download, Receipt, Undo2, Wallet, Search } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Pager, Stat, Tabs, usePaged } from '../../components/ui'
import { ReceiptModal, PAYMENT_METHOD_LABEL } from '../../components/Receipt'
import { downloadCSV, feeAppliesTo, formatDate, formatMoney, lateFeeFor, newReceiptNo, studentFeeStatus, uid } from '../../lib/utils'
import type { FeeItem, Payment, Student } from '../../types'

type Tab = 'dues' | 'structure' | 'payments'

export default function AdminFees() {
  const { db } = useStore()
  const [tab, setTab] = useState<Tab>('dues')
  const cur = db.branding.currency
  const totals = useMemo(() => {
    let billed = 0, collected = 0
    for (const s of db.students.filter((x) => x.status === 'active'))
      for (const f of studentFeeStatus(db, s)) {
        billed += f.fee.amount
        if (f.payment) collected += f.payment.amount
      }
    return { billed, collected, pct: billed ? Math.round((collected / billed) * 100) : 0 }
  }, [db])

  return (
    <>
      <PageHeader title="Fees & Payments" subtitle="Fee structures, dues, collections and receipts" />
      <div className="grid stats-grid three">
        <Stat label="Total billed" value={formatMoney(totals.billed, cur)} icon={<Wallet size={20} />} tone="blue" />
        <Stat label="Collected" value={formatMoney(totals.collected, cur)} icon={<Receipt size={20} />} tone="green" hint={`${totals.pct}% of billed`} />
        <Stat label="Outstanding" value={formatMoney(totals.billed - totals.collected, cur)} icon={<Wallet size={20} />} tone="red" />
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'dues', label: 'Student dues' }, { id: 'structure', label: 'Fee structure' }, { id: 'payments', label: 'Payment ledger' }]} />
      {tab === 'dues' && <Dues />}
      {tab === 'structure' && <Structure />}
      {tab === 'payments' && <Ledger />}
    </>
  )
}

function Dues() {
  const { db, sendBulkEmail, toast } = useStore()
  const cur = db.branding.currency
  const [feeId, setFeeId] = useState(db.fees[0]?.id ?? '')
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('unpaid')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState<{ student: Student; fee: FeeItem } | null>(null)
  const fee = db.fees.find((f) => f.id === feeId)

  const dq = useDeferredValue(q)
  const rows = useMemo(() => {
    if (!fee) return []
    const t = dq.trim().toLowerCase()
    return db.students
      .filter((s) => s.status === 'active' && feeAppliesTo(fee, s) && (!t || s.name.toLowerCase().includes(t) || s.rollNo.toLowerCase().includes(t)))
      .map((s) => ({ s, st: studentFeeStatus(db, s).find((x) => x.fee.id === fee.id)! }))
      .filter(({ st }) => filter === 'all' || (filter === 'unpaid' ? st.status !== 'paid' : st.status === filter))
  }, [db, fee, filter, dq])
  const paged = usePaged(rows)

  const unpaidRows = rows.filter((r) => r.st.status !== 'paid')
  const allSelected = unpaidRows.length > 0 && unpaidRows.every((r) => selected.has(r.s.id))

  const remind = async () => {
    const tpl = db.templates.find((t) => t.id === 'tpl-fee-reminder')
    if (!tpl || !fee) return
    const targets = unpaidRows.filter((r) => selected.has(r.s.id))
    setSending(true)
    const res = await sendBulkEmail({
      subject: tpl.subject,
      body: tpl.body,
      recipients: targets.map(({ s, st }) => ({ email: s.email, vars: { name: s.name, student_name: s.name, fee_name: fee.name, amount: formatMoney(st.total, cur), due_date: formatDate(fee.dueDate) } })),
    })
    setSending(false)
    setSelected(new Set())
    if (res.failed) toast(`${res.sent} sent, ${res.failed} failed – see Email Center`, res.sent ? 'info' : 'error')
    else toast(`Reminder sent to ${res.sent} student(s)`)
  }

  if (!fee) return <Card><Empty title="No fee items">Create a fee in the Fee structure tab.</Empty></Card>

  return (
    <Card pad={false}>
      <div className="toolbar">
        <select className="input" value={feeId} onChange={(e) => { setFeeId(e.target.value); setSelected(new Set()) }} aria-label="Fee item">
          {db.fees.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Status">
          <option value="unpaid">Unpaid</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="all">All</option>
        </select>
        <div className="search">
          <Search size={16} />
          <input className="input" placeholder="Search student…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>
        <div className="spacer" />
        <Button icon={<Send size={16} />} disabled={!selected.size} loading={sending} onClick={remind}>Send reminder ({selected.size})</Button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="check"><input type="checkbox" aria-label="Select all unpaid" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(unpaidRows.map((r) => r.s.id)))} /></th>
              <th>Student</th><th className="hide-sm">Class</th><th className="hide-sm">Amount</th><th className="hide-sm">Late fee</th><th>Status</th><th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map(({ s, st }) => (
              <tr key={s.id}>
                <td className="check">
                  {st.status !== 'paid' && (
                    <input type="checkbox" aria-label={`Select ${s.name}`} checked={selected.has(s.id)} onChange={() => setSelected((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })} />
                  )}
                </td>
                <td><strong>{s.name}</strong><div className="muted tiny mono">{s.rollNo}</div></td>
                <td className="hide-sm">{s.department} · Y{s.year}</td>
                <td className="hide-sm">{formatMoney(st.fee.amount, cur)}</td>
                <td className="hide-sm">{st.lateFee ? formatMoney(st.lateFee, cur) : '—'}</td>
                <td>{st.status === 'paid' ? <Badge tone="green">Paid {formatDate(st.payment!.paidAt, { day: 'numeric', month: 'short' })}</Badge> : st.status === 'overdue' ? <Badge tone="red">Overdue</Badge> : <Badge tone="amber">Due {formatDate(fee.dueDate, { day: 'numeric', month: 'short' })}</Badge>}</td>
                <td className="right">{st.status !== 'paid' && <Button size="sm" variant="secondary" onClick={() => setRecording({ student: s, fee })}>Record payment</Button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="center muted">Nothing to show for this filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...paged} />
      {recording && <RecordPayment {...recording} onClose={() => setRecording(null)} />}
    </Card>
  )
}

function RecordPayment({ student, fee, onClose }: { student: Student; fee: FeeItem; onClose: () => void }) {
  const { db, update, toast, session } = useStore()
  const late = lateFeeFor(fee)
  const [method, setMethod] = useState<Payment['method']>('cash')
  const [ref, setRef] = useState('')
  const [waive, setWaive] = useState(false)
  const cur = db.branding.currency
  return (
    <Modal
      open
      title="Record offline payment"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={method === 'cheque' && !ref.trim()}
            onClick={() => {
              update((d) => {
                d.payments.push({ id: uid('pay'), receiptNo: newReceiptNo(), studentId: student.id, feeId: fee.id, amount: fee.amount, lateFee: waive ? 0 : late, method, txnRef: ref.trim() || `OFFLINE-${Date.now()}`, paidAt: new Date().toISOString(), status: 'success', recordedBy: session?.name ?? 'admin' })
              })
              toast(`Payment recorded for ${student.name}`)
              onClose()
            }}
          >
            Record {formatMoney(fee.amount + (waive ? 0 : late), cur)}
          </Button>
        </>
      }
    >
      <p><strong>{student.name}</strong> <span className="muted">({student.rollNo})</span> — {fee.name}</p>
      <div className="form-grid">
        <Field label="Payment mode">
          {(id) => (
            <select id={id} className="input" value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])}>
              {(['cash', 'cheque', 'upi', 'card', 'netbanking'] as const).map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>)}
            </select>
          )}
        </Field>
        <Field label={method === 'cheque' ? 'Cheque number' : 'Reference (optional)'}>{(id) => <input id={id} className="input" value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
      </div>
      {late > 0 && (
        <label className="checkbox"><input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} /> Waive late fee of {formatMoney(late, cur)}</label>
      )}
    </Modal>
  )
}

function Structure() {
  const { db, update, toast } = useStore()
  const cur = db.branding.currency
  const [editing, setEditing] = useState<FeeItem | null>(null)
  return (
    <Card pad={false} title="Fee items" actions={<Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing({ id: '', name: '', category: 'tuition', amount: 0, department: 'All', year: 0, dueDate: new Date().toISOString().slice(0, 10), term: 'Odd Semester', lateFeePerDay: 0 })}>Add fee</Button>}>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fee</th><th>Applies to</th><th>Amount</th><th>Due date</th><th>Late fee / day</th><th>Paid</th><th className="right">Actions</th></tr></thead>
          <tbody>
            {db.fees.map((f) => {
              const applicable = db.students.filter((s) => s.status === 'active' && feeAppliesTo(f, s)).length
              const paid = db.payments.filter((p) => p.feeId === f.id && p.status === 'success').length
              return (
                <tr key={f.id}>
                  <td><strong>{f.name}</strong><div className="muted tiny">{f.term} · {f.category}</div></td>
                  <td>{f.department === 'All' ? 'All depts' : f.department} · {f.year ? `Year ${f.year}` : 'All years'}</td>
                  <td>{formatMoney(f.amount, cur)}</td>
                  <td>{formatDate(f.dueDate)}</td>
                  <td>{f.lateFeePerDay ? formatMoney(f.lateFeePerDay, cur) : '—'}</td>
                  <td>{paid}/{applicable}</td>
                  <td className="right nowrap">
                    <button className="icon-btn" aria-label={`Edit ${f.name}`} onClick={() => setEditing(f)}><Pencil size={16} /></button>
                    <button
                      className="icon-btn danger"
                      aria-label={`Delete ${f.name}`}
                      onClick={() => {
                        const has = db.payments.some((p) => p.feeId === f.id)
                        if (has) return toast('This fee has payments recorded and cannot be deleted.', 'error')
                        if (!confirm(`Delete ${f.name}?`)) return
                        update((d) => { d.fees = d.fees.filter((x) => x.id !== f.id) })
                        toast('Fee deleted')
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <FeeForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(f) => {
            update((d) => {
              if (!f.id) d.fees.push({ ...f, id: uid('fee') })
              else d.fees = d.fees.map((x) => (x.id === f.id ? f : x))
            })
            toast(f.id ? 'Fee updated' : 'Fee created')
            setEditing(null)
          }}
        />
      )}
    </Card>
  )
}

function FeeForm({ initial, onClose, onSave }: { initial: FeeItem; onClose: () => void; onSave: (f: FeeItem) => void }) {
  const { db } = useStore()
  const [f, setF] = useState(initial)
  const valid = f.name.trim().length > 1 && f.amount > 0 && !!f.dueDate && f.lateFeePerDay >= 0
  return (
    <Modal open title={initial.id ? 'Edit fee' : 'New fee'} onClose={onClose} wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave({ ...f, name: f.name.trim() })}>Save</Button></>}>
      <div className="form-grid">
        <Field label="Fee name" span={2}>{(id) => <input id={id} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field>
        <Field label="Category">{(id) => <select id={id} className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FeeItem['category'] })}>{['tuition', 'hostel', 'exam', 'transport', 'library', 'other'].map((c) => <option key={c}>{c}</option>)}</select>}</Field>
        <Field label="Term">{(id) => <input id={id} className="input" value={f.term} onChange={(e) => setF({ ...f, term: e.target.value })} />}</Field>
        <Field label={`Amount (${db.branding.currency})`}>{(id) => <input id={id} type="number" min={0} className="input" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Math.max(0, +e.target.value) })} />}</Field>
        <Field label="Due date">{(id) => <input id={id} type="date" className="input" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />}</Field>
        <Field label="Department">{(id) => <select id={id} className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}><option value="All">All departments</option>{db.departments.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}</select>}</Field>
        <Field label="Year">{(id) => <select id={id} className="input" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}><option value={0}>All years</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select>}</Field>
        <Field label="Late fee per day" hint="0 to disable">{(id) => <input id={id} type="number" min={0} className="input" value={f.lateFeePerDay} onChange={(e) => setF({ ...f, lateFeePerDay: Math.max(0, +e.target.value) })} />}</Field>
      </div>
    </Modal>
  )
}

function Ledger() {
  const { db, update, toast } = useStore()
  const cur = db.branding.currency
  const [q, setQ] = useState('')
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return [...db.payments]
      .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      .filter((p) => {
        if (!t) return true
        const s = db.students.find((x) => x.id === p.studentId)
        return p.receiptNo.toLowerCase().includes(t) || p.txnRef.toLowerCase().includes(t) || !!s?.name.toLowerCase().includes(t) || !!s?.rollNo.toLowerCase().includes(t)
      })
  }, [db.payments, db.students, q])
  const paged = usePaged(rows)

  return (
    <Card pad={false}>
      <div className="toolbar">
        <div className="search"><Search size={16} /><input className="input" placeholder="Receipt, transaction, student…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search payments" /></div>
        <div className="spacer" />
        <Button
          variant="secondary"
          icon={<Download size={16} />}
          onClick={() =>
            downloadCSV('payments.csv', [
              ['Receipt', 'Date', 'Roll No', 'Student', 'Fee', 'Amount', 'Late fee', 'Method', 'Txn Ref', 'Status'],
              ...rows.map((p) => {
                const s = db.students.find((x) => x.id === p.studentId)
                return [p.receiptNo, p.paidAt, s?.rollNo ?? '', s?.name ?? '', db.fees.find((f) => f.id === p.feeId)?.name ?? '', p.amount, p.lateFee, p.method, p.txnRef, p.status]
              }),
            ])
          }
        >
          Export
        </Button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th className="hide-sm">Receipt</th><th>Date</th><th>Student</th><th className="hide-sm">Fee</th><th className="hide-sm">Mode</th><th>Amount</th><th>Status</th><th className="right">Actions</th></tr></thead>
          <tbody>
            {paged.items.map((p) => {
              const s = db.students.find((x) => x.id === p.studentId)
              return (
                <tr key={p.id}>
                  <td className="mono tiny hide-sm">{p.receiptNo}</td>
                  <td className="nowrap">{formatDate(p.paidAt)}</td>
                  <td>{s?.name ?? <span className="muted">Deleted</span>}</td>
                  <td className="hide-sm">{db.fees.find((f) => f.id === p.feeId)?.name ?? '—'}</td>
                  <td className="hide-sm">{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td><strong>{formatMoney(p.amount + p.lateFee, cur)}</strong></td>
                  <td><Badge tone={p.status === 'success' ? 'green' : p.status === 'refunded' ? 'gray' : 'red'}>{p.status}</Badge></td>
                  <td className="right nowrap">
                    <button className="icon-btn" aria-label="View receipt" onClick={() => setReceipt(p)}><Receipt size={16} /></button>
                    {p.status === 'success' && (
                      <button className="icon-btn danger" aria-label="Refund" title="Mark refunded" onClick={() => { if (!confirm(`Mark ${p.receiptNo} as refunded? The fee will show as due again.`)) return; update((d) => { const x = d.payments.find((y) => y.id === p.id); if (x) x.status = 'refunded' }); toast('Payment marked refunded') }}>
                        <Undo2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="center muted">No payments found.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...paged} />
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </Card>
  )
}
