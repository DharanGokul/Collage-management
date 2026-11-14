import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Wrench, CalendarRange, CheckCheck, Send } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { useNow } from '../../lib/useNow'
import { Badge, Button, Empty, Field, Modal, PageHeader, Segmented, Stat, Tabs } from '../../components/ui'
import { RequestCard, CATEGORY_LABEL, KIND_LABEL } from './requestsUi'
import { formatDate, formatMoney, toISODate, uid } from '../../lib/utils'
import { LEAVE_QUOTA, hodOf, initialStatus, isHod, leaveBalance, leaveDays, nextRequestRef } from '../../lib/workflow'
import type { DeptRequest, LeaveRequest } from '../../types'

type Tab = 'requests' | 'leave'
const LEAVE_LABEL: Record<LeaveRequest['type'], string> = { casual: 'Casual leave', sick: 'Sick leave', earned: 'Earned leave', duty: 'On duty (OD)' }

export default function Requests() {
  const { db, session, update, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('requests')
  const [creating, setCreating] = useState<DeptRequest['kind'] | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- syncs the ?tab=/?new= URL params into local UI state, then clears ?new=
    if (params.get('tab') === 'leave') setTab('leave')
    const n = params.get('new')
    if (!n) return
    if (n === 'leave') {
      setTab('leave')
      setApplying(true)
    } else if (n === 'purchase' || n === 'repair' || n === 'setup') setCreating(n)
    params.delete('new')
    setParams(params, { replace: true })
  }, [params, setParams])

  const me = db.staff.find((s) => s.id === session?.userId)
  const mine = useMemo(() => db.requests.filter((r) => r.requestedBy.userId === session?.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.requests, session])
  const myLeaves = useMemo(() => db.leaves.filter((l) => l.staffId === session?.userId).sort((a, b) => b.from.localeCompare(a.from)), [db.leaves, session])
  if (!session || !me) return <Empty title="Requests are for staff accounts" />
  const hod = isHod(db, me.id)

  const markDone = (r: DeptRequest) => {
    update((d) => {
      const x = d.requests.find((y) => y.id === r.id)
      if (!x) return
      x.status = 'completed'
      x.timeline.push({ at: new Date().toISOString(), by: me.name, action: r.kind === 'purchase' ? 'Received' : 'Confirmed fixed' })
      const h = hodOf(d, x.department)
      notify(d, [...(h && h !== me.id ? [`staff:${h}`] : []), 'admin:admin'], { kind: 'request', important: false, title: `${x.ref} completed`, body: x.title, link: (to) => (to.startsWith('admin') ? '/admin/approvals' : '/staff/department') })
    })
    toast(`${r.ref} marked complete`)
  }

  return (
    <>
      <PageHeader
        title="Requests"
        subtitle={hod ? 'You are HOD — your requests go straight to management.' : 'Equipment, repairs and leave — approved by your HOD.'}
        actions={
          tab === 'requests' ? (
            <>
              <Button variant="secondary" icon={<Wrench size={16} />} onClick={() => setCreating('repair')}>Report an issue</Button>
              <Button icon={<Plus size={16} />} onClick={() => setCreating('purchase')}>New request</Button>
            </>
          ) : (
            <Button icon={<CalendarRange size={16} />} onClick={() => setApplying(true)}>Apply for leave</Button>
          )
        }
      />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'requests', label: `Equipment & repairs (${mine.length})`, icon: <Wrench size={16} /> }, { id: 'leave', label: `Leave (${myLeaves.length})`, icon: <CalendarRange size={16} /> }]} />
      {tab === 'requests' ? (
        <>
          <div className="grid stats-grid">
            <Stat label="Awaiting approval" value={mine.filter((r) => r.status.startsWith('pending')).length} icon={<Send size={20} />} tone="amber" />
            <Stat label="Approved / in progress" value={mine.filter((r) => r.status === 'approved' || r.status === 'in_progress').length} icon={<Wrench size={20} />} tone="blue" />
            <Stat label="Completed" value={mine.filter((r) => r.status === 'completed').length} icon={<CheckCheck size={20} />} tone="green" />
            <Stat label="Value requested" value={formatMoney(mine.reduce((a, r) => a + r.estimatedCost, 0), db.branding.currency)} icon={<Plus size={20} />} />
          </div>
          {mine.length === 0 ? (
            <Empty icon={<Wrench />} title="No requests yet">Need a projector, computers or a bench fixed? Raise a request.</Empty>
          ) : (
            <div className="req-grid">
              {mine.map((r) => (
                <RequestCard key={r.id} r={r} actions={(r.status === 'in_progress' || (r.status === 'approved' && r.kind !== 'purchase')) && <Button size="sm" variant="secondary" icon={<CheckCheck size={14} />} onClick={() => markDone(r)}>{r.kind === 'purchase' ? 'Mark received' : 'Confirm fixed'}</Button>} />
              ))}
            </div>
          )}
        </>
      ) : (
        <LeavePanel leaves={myLeaves} />
      )}
      {creating && <NewRequest kind={creating} onClose={() => setCreating(null)} />}
      {applying && <ApplyLeave onClose={() => setApplying(false)} />}
    </>
  )
}

function LeavePanel({ leaves }: { leaves: LeaveRequest[] }) {
  const { db, session, update, toast } = useStore()
  if (!session) return null
  return (
    <>
      <div className="grid stats-grid">
        {(['casual', 'sick', 'earned', 'duty'] as const).map((t) => {
          const b = leaveBalance(db, session.userId, t)
          return <Stat key={t} label={LEAVE_LABEL[t]} value={b.left === null ? `${b.used} used` : `${b.left} left`} hint={b.quota === null ? 'No limit' : `of ${b.quota} this year`} icon={<CalendarRange size={20} />} tone={b.left !== null && b.left <= 2 ? 'red' : 'green'} />
        })}
      </div>
      {leaves.length === 0 ? (
        <Empty icon={<CalendarRange />} title="No leave applications" />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways)">
            <table className="table">
              <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th className="hide-sm">Reason</th><th>Status</th><th /></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{LEAVE_LABEL[l.type]}</td>
                    <td className="nowrap">{formatDate(l.from, { day: 'numeric', month: 'short' })}{l.to !== l.from ? ` – ${formatDate(l.to, { day: 'numeric', month: 'short' })}` : ''}</td>
                    <td>{l.days}</td>
                    <td className="hide-sm tiny">{l.reason}{l.note && <div className="muted">“{l.note}” — {l.decidedBy}</div>}</td>
                    <td><Badge tone={l.status === 'approved' ? 'green' : l.status === 'rejected' ? 'red' : l.status === 'pending' ? 'amber' : 'gray'}>{l.status === 'pending' ? `pending ${l.approver === 'hod' ? 'HOD' : 'management'}` : l.status}</Badge></td>
                    <td className="right">
                      {l.status === 'pending' && <Button size="sm" variant="ghost" onClick={() => { update((d) => { const x = d.leaves.find((y) => y.id === l.id); if (x) x.status = 'cancelled' }); toast('Leave application withdrawn') }}>Withdraw</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function NewRequest({ kind: initial, onClose }: { kind: DeptRequest['kind']; onClose: () => void }) {
  const { db, session, update, toast } = useStore()
  const me = db.staff.find((s) => s.id === session?.userId)
  const [kind, setKind] = useState(initial)
  const [category, setCategory] = useState<DeptRequest['category']>(initial === 'repair' ? 'furniture' : 'computer')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [cost, setCost] = useState(0)
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<DeptRequest['priority']>('normal')
  const [touched, setTouched] = useState(false)
  if (!session || !me) return null
  const errors = { title: title.trim().length < 5 ? 'Describe what is needed (5+ characters)' : null, location: !location.trim() ? 'Where is it needed?' : null, cost: kind === 'purchase' && cost <= 0 ? 'Give an estimated cost' : null }
  const limit = db.tax.procurementApprovalLimit
  const route = initialStatus(db, me.id, me.department) === 'pending_admin' ? 'Management (you are HOD)' : kind === 'purchase' || cost > limit ? 'Your HOD, then management' : 'Your HOD'

  const submit = () => {
    setTouched(true)
    if (Object.values(errors).some(Boolean)) return
    const status = initialStatus(db, me.id, me.department)
    const ref = nextRequestRef(db)
    const now = new Date().toISOString()
    update((d) => {
      d.requests.unshift({ id: uid('req'), ref, kind, category, title: title.trim(), description: description.trim(), quantity, estimatedCost: cost, location: location.trim(), department: me.department, priority, requestedBy: { role: 'staff', userId: me.id, name: me.name }, createdAt: now, status, timeline: [{ at: now, by: me.name, action: 'Submitted' }] })
      const hod = hodOf(d, me.department)
      const to = status === 'pending_hod' && hod ? [`staff:${hod}`] : ['admin:admin']
      notify(d, to, { kind: 'approval', important: true, title: `Approval needed · ${ref}`, body: `${KIND_LABEL[kind]}: ${title.trim()} — ${me.name}`, link: (k) => (k.startsWith('admin') ? '/admin/approvals' : '/staff/approvals') })
    })
    toast(`${ref} sent to ${status === 'pending_hod' ? 'your HOD' : 'management'}`)
    onClose()
  }

  return (
    <Modal open wide title={kind === 'repair' ? 'Report an issue' : 'New request'} onClose={onClose} footer={<><span className="muted tiny" style={{ marginRight: 'auto' }}>Approval route: <strong>{route}</strong></span><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Send size={16} />} onClick={submit}>Submit</Button></>}>
      <Segmented label="Request type" value={kind} onChange={setKind} options={[{ id: 'purchase', label: 'New purchase' }, { id: 'repair', label: 'Repair / issue' }, { id: 'setup', label: 'Setup' }]} />
      <div className="form-grid">
        <Field label="Category">{(id) => <select id={id} className="input" value={category} onChange={(e) => setCategory(e.target.value as DeptRequest['category'])}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <Field label="Priority">{(id) => <select id={id} className="input" value={priority} onChange={(e) => setPriority(e.target.value as DeptRequest['priority'])}>{(['low', 'normal', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select>}</Field>
        <Field label="What is needed" span={2} error={touched ? errors.title : null}>{(id) => <input id={id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'repair' ? 'e.g. 4 broken benches in ECE-103' : 'e.g. 2 projectors for MBA classrooms'} autoFocus />}</Field>
        <Field label="Room / location" error={touched ? errors.location : null}>{(id) => <input id={id} className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="CSE Lab 2" />}</Field>
        <div className="form-grid inner">
          <Field label="Quantity">{(id) => <input id={id} type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value || 1))} />}</Field>
          <Field label={`Est. cost (${db.branding.currency})`} error={touched ? errors.cost : null}>{(id) => <input id={id} type="number" min={0} className="input" value={cost || ''} onChange={(e) => setCost(Math.max(0, +e.target.value || 0))} />}</Field>
        </div>
        <Field label="Details / justification" span={2}>{(id) => <textarea id={id} className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Specs, why it is needed, impact on classes…" />}</Field>
      </div>
      {cost > limit && <p className="muted tiny">Above {formatMoney(limit, db.branding.currency)} → management approval is also needed.</p>}
    </Modal>
  )
}

function ApplyLeave({ onClose }: { onClose: () => void }) {
  const { db, session, update, toast } = useStore()
  const me = db.staff.find((s) => s.id === session?.userId)
  const now = useNow()
  // Next working day (Sundays are not counted, so don't default to one).
  const tomorrow = toISODate(new Date(now + 86400000 * (new Date(now + 86400000).getDay() === 0 ? 2 : 1)))
  const [type, setType] = useState<LeaveRequest['type']>('casual')
  const [from, setFrom] = useState(tomorrow)
  const [to, setTo] = useState(tomorrow)
  const [reason, setReason] = useState('')
  if (!session || !me) return null
  const days = to >= from ? leaveDays(from, to) : 0
  const bal = leaveBalance(db, me.id, type)
  const overlap = db.leaves.some((l) => l.staffId === me.id && (l.status === 'pending' || l.status === 'approved') && l.from <= to && l.to >= from)
  const err = to < from ? 'End date is before start date' : days === 0 ? 'Pick at least one working day' : bal.left !== null && days > bal.left ? `Only ${bal.left} ${type} day(s) left` : overlap ? 'Overlaps an existing application' : reason.trim().length < 5 ? 'Give a short reason' : null
  const approver: LeaveRequest['approver'] = isHod(db, me.id) ? 'admin' : 'hod'

  const submit = () => {
    if (err) return
    update((d) => {
      d.leaves.push({ id: uid('lv'), staffId: me.id, type, from, to, days, reason: reason.trim(), status: 'pending', approver, createdAt: new Date().toISOString() })
      const hod = hodOf(d, me.department)
      notify(d, approver === 'hod' && hod ? [`staff:${hod}`] : ['admin:admin'], { kind: 'leave', important: true, title: `Leave request — ${me.name}`, body: `${LEAVE_LABEL[type]} · ${days} day(s) from ${formatDate(from, { day: 'numeric', month: 'short' })}`, link: (k) => (k.startsWith('admin') ? '/admin/approvals?tab=leave' : '/staff/approvals?tab=leave') })
    })
    toast(`Leave application sent to ${approver === 'hod' ? 'your HOD' : 'management'}`)
    onClose()
  }
  return (
    <Modal open title="Apply for leave" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Send size={16} />} disabled={!!err} onClick={submit}>Apply ({days} day{days === 1 ? '' : 's'})</Button></>}>
      <div className="form-grid">
        <Field label="Type" span={2} hint={bal.quota === null ? 'Duty leave is not limited' : `${bal.left} of ${bal.quota} left this year`}>{(id) => <select id={id} className="input" value={type} onChange={(e) => setType(e.target.value as LeaveRequest['type'])}>{(Object.keys(LEAVE_QUOTA) as LeaveRequest['type'][]).map((t) => <option key={t} value={t}>{LEAVE_LABEL[t]}</option>)}</select>}</Field>
        <Field label="From">{(id) => <input id={id} type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value) }} />}</Field>
        <Field label="To">{(id) => <input id={id} type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
        <Field label="Reason" span={2}>{(id) => <textarea id={id} className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
      {err && (reason || !err.startsWith('Give a short')) && <div className="alert alert-warn tiny">{err}</div>}
      <p className="muted tiny">Sundays are not counted. Goes to {approver === 'hod' ? 'your HOD' : 'management'} for approval.</p>
    </Modal>
  )
}
