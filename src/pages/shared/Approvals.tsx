import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wrench, CalendarRange, UserRound, Receipt, Play, CheckCheck } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Empty, PageHeader, Tabs } from '../../components/ui'
import { DecisionBar, RequestCard } from './requestsUi'
import { formatDate, formatMoney, toISODate, weekdayIndex } from '../../lib/utils'
import { billTotals } from '../../lib/finance'
import { afterHodApproval, canDecide, canDecideLeave, hodDepartment, hodOf, leaveBalance } from '../../lib/workflow'
import type { DeptRequest } from '../../types'

type Tab = 'requests' | 'leave' | 'profile' | 'bills'
const FIELD_LABEL: Record<string, string> = { name: 'Name', email: 'Email', phone: 'Phone', guardianName: 'Guardian', guardianPhone: 'Guardian phone', photo: 'Photo' }

/** HOD (own department) and management approvals in one place. */
export default function Approvals() {
  const { db, session, update, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const isAdmin = session?.role === 'admin'
  const dept = !isAdmin ? hodDepartment(db, session?.userId) : undefined
  // The URL owns the tab, so links from toasts/notifications switch it even when this page is already open.
  const tabParam = params.get('tab') as Tab | null
  const tab: Tab = tabParam && ['requests', 'leave', 'profile', 'bills'].includes(tabParam) ? tabParam : 'requests'
  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params)
    p.set('tab', t)
    setParams(p, { replace: true })
  }
  const [showDone, setShowDone] = useState(false)

  const reqs = useMemo(() => {
    if (!session) return []
    const scope = db.requests.filter((r) => isAdmin || r.department === dept?.code)
    const open = scope.filter((r) => canDecide(db, session, r) || (isAdmin && (r.status === 'approved' || r.status === 'in_progress') && r.kind !== 'purchase'))
    return showDone ? scope : open
  }, [db, session, isAdmin, dept, showDone])
  const leaves = useMemo(() => (session ? db.leaves.filter((l) => (showDone ? (isAdmin ? l.approver === 'admin' : l.approver === 'hod' && db.staff.find((s) => s.id === l.staffId)?.department === dept?.code) : canDecideLeave(db, session, l))) : []), [db, session, showDone, isAdmin, dept])
  const profiles = useMemo(
    () => db.profileChanges.filter((p) => (showDone || p.status === 'pending') && (isAdmin ? !hodOf(db, db.students.find((s) => s.id === p.studentId)?.department ?? '') : db.students.find((s) => s.id === p.studentId)?.department === dept?.code)),
    [db, showDone, isAdmin, dept],
  )
  const bills = useMemo(() => (isAdmin ? db.bills.filter((b) => (showDone ? b.status !== 'pending' : b.status === 'pending')) : []), [db.bills, isAdmin, showDone])

  if (!session || (!isAdmin && !dept)) return <Empty title="Approvals are for HODs and management" />
  const actor = isAdmin ? 'Management' : session.name
  const now = () => new Date().toISOString()

  const decideRequest = (r: DeptRequest, approve: boolean, note: string) => {
    // Decide the outcome from the current snapshot (state updaters may run later).
    const nextStatus: DeptRequest['status'] = !approve ? 'rejected' : r.status === 'pending_hod' ? afterHodApproval(db, r) : 'approved'
    update((d) => {
      const x = d.requests.find((y) => y.id === r.id)
      if (!x) return
      const requester = `${x.requestedBy.role}:${x.requestedBy.userId}`
      if (!approve) {
        x.status = 'rejected'
        x.timeline.push({ at: now(), by: actor, action: isAdmin ? 'Rejected by management' : 'Rejected by HOD', note })
        notify(d, [requester], { kind: 'request', important: true, title: `${x.ref} rejected`, body: `${x.title}${note ? ` — “${note}”` : ''}`, link: '/staff/requests' })
        return
      }
      if (x.status === 'pending_hod') {
        x.status = afterHodApproval(d, x)
        x.timeline.push({ at: now(), by: actor, action: isAdmin ? 'Approved by management (no HOD appointed)' : 'Approved by HOD', note: note || undefined })
        notify(d, [requester], { kind: 'request', important: x.status === 'approved', title: `${x.ref} approved by HOD${x.status === 'pending_admin' ? ' → management' : ''}`, body: x.title, link: '/staff/requests' })
        if (x.status === 'pending_admin') notify(d, ['admin:admin'], { kind: 'approval', important: true, title: `Approval needed · ${x.ref}`, body: `${x.title} · ${formatMoney(x.estimatedCost, d.branding.currency)} · ${x.department}`, link: '/admin/approvals' })
      } else {
        x.status = 'approved'
        x.timeline.push({ at: now(), by: actor, action: 'Approved by management', note: note || undefined })
        const hod = hodOf(d, x.department)
        notify(d, [requester, ...(hod ? [`staff:${hod}`] : [])], { kind: 'request', important: true, title: `${x.ref} approved by management`, body: x.kind === 'purchase' ? `${x.title} — accounts will raise the order` : x.title, link: (k) => (k === requester ? '/staff/requests' : '/staff/department') })
        if (x.kind === 'purchase') notify(d, d.accountants.map((a) => `accountant:${a.id}`), { kind: 'finance', important: false, title: `Purchase approved · ${x.ref}`, body: `${x.title} · est. ${formatMoney(x.estimatedCost, d.branding.currency)} — record the vendor bill`, link: `/accountant/bills?request=${x.id}` })
      }
    })
    toast(approve ? `${r.ref} ${nextStatus === 'pending_admin' ? 'forwarded to management' : 'approved'}` : `${r.ref} rejected`, approve ? 'success' : 'info')
  }

  const progress = (r: DeptRequest, to: 'in_progress' | 'completed') => {
    update((d) => {
      const x = d.requests.find((y) => y.id === r.id)
      if (!x) return
      x.status = to
      x.timeline.push({ at: now(), by: actor, action: to === 'in_progress' ? 'Work started' : 'Completed' })
      notify(d, [`${x.requestedBy.role}:${x.requestedBy.userId}`], { kind: 'request', important: false, title: `${x.ref}: ${to === 'in_progress' ? 'work started' : 'completed'}`, body: x.title, link: '/staff/requests' })
    })
    toast(`${r.ref} ${to === 'in_progress' ? 'in progress' : 'completed'}`)
  }

  const counts = {
    requests: db.requests.filter((r) => canDecide(db, session, r)).length,
    leave: db.leaves.filter((l) => canDecideLeave(db, session, l)).length,
    profile: db.profileChanges.filter((p) => p.status === 'pending' && (isAdmin ? !hodOf(db, db.students.find((s) => s.id === p.studentId)?.department ?? '') : db.students.find((s) => s.id === p.studentId)?.department === dept?.code)).length,
    bills: isAdmin ? db.bills.filter((b) => b.status === 'pending').length : 0,
  }
  const tabs = [
    { id: 'requests' as Tab, label: `Equipment & repairs${counts.requests ? ` (${counts.requests})` : ''}`, icon: <Wrench size={16} /> },
    { id: 'leave' as Tab, label: `Leave${counts.leave ? ` (${counts.leave})` : ''}`, icon: <CalendarRange size={16} /> },
    { id: 'profile' as Tab, label: `Student profiles${counts.profile ? ` (${counts.profile})` : ''}`, icon: <UserRound size={16} /> },
    ...(isAdmin ? [{ id: 'bills' as Tab, label: `Vendor bills${counts.bills ? ` (${counts.bills})` : ''}`, icon: <Receipt size={16} /> }] : []),
  ]

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={isAdmin ? 'Purchases above the limit, HOD leave, bills and anything escalated to management' : `${dept!.name} — requests, leave and student profile changes`}
        actions={<label className="checkbox tiny"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show history</label>}
      />
      <Tabs value={tab} onChange={setTab} items={tabs} />

      {tab === 'requests' &&
        (reqs.length === 0 ? (
          <Empty icon={<Wrench />} title="Nothing waiting for you">New equipment and repair requests appear here.</Empty>
        ) : (
          <div className="req-grid">
            {reqs.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                actions={
                  canDecide(db, session, r) ? (
                    <DecisionBar approveLabel={r.status === 'pending_hod' && afterHodApproval(db, r) === 'pending_admin' ? 'Approve & forward' : 'Approve'} onApprove={(n) => decideRequest(r, true, n)} onReject={(n) => decideRequest(r, false, n)} />
                  ) : isAdmin && r.status === 'approved' && r.kind !== 'purchase' ? (
                    <Button size="sm" icon={<Play size={14} />} onClick={() => progress(r, 'in_progress')}>Start work</Button>
                  ) : isAdmin && r.status === 'in_progress' && r.kind !== 'purchase' ? (
                    <Button size="sm" variant="secondary" icon={<CheckCheck size={14} />} onClick={() => progress(r, 'completed')}>Mark completed</Button>
                  ) : undefined
                }
              />
            ))}
          </div>
        ))}

      {tab === 'leave' &&
        (leaves.length === 0 ? (
          <Empty icon={<CalendarRange />} title="No leave applications waiting" />
        ) : (
          <div className="req-grid">
            {leaves.map((l) => {
              const st = db.staff.find((s) => s.id === l.staffId)
              const bal = leaveBalance(db, l.staffId, l.type)
              return (
                <article key={l.id} className="req-card card">
                  <div className="req-top">
                    <div className="person">
                      <Avatar name={st?.name ?? ''} src={st?.photo} size={40} />
                      <div className="stack-s" style={{ gap: 2 }}>
                        <strong>{st?.name}</strong>
                        <span className="muted tiny">{st?.designation} · {st?.department}</span>
                      </div>
                    </div>
                    <Badge tone={l.status === 'approved' ? 'green' : l.status === 'rejected' ? 'red' : 'amber'}>{l.status}</Badge>
                  </div>
                  <div className="stack-s">
                    <span><strong>{l.type[0].toUpperCase() + l.type.slice(1)} leave</strong> · {l.days} day{l.days > 1 ? 's' : ''} · {formatDate(l.from, { weekday: 'short', day: 'numeric', month: 'short' })}{l.to !== l.from ? ` – ${formatDate(l.to, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</span>
                    <span className="muted tiny">“{l.reason}”</span>
                    {bal.quota !== null && <span className="tiny">Balance: {bal.left} of {bal.quota} left</span>}
                    {(() => {
                      // Periods this person teaches while away — what the HOD must arrange cover for.
                      const mine = new Set(db.subjects.filter((x) => x.staffId === l.staffId).map((x) => x.id))
                      let n = 0
                      for (let d = new Date(l.from + 'T00:00:00'); toISODate(d) <= l.to; d.setDate(d.getDate() + 1)) n += db.timetable.filter((t) => t.day === weekdayIndex(d) && mine.has(t.subjectId)).length
                      return n > 0 ? <span className="tiny">Classes to cover: <strong>{n} period{n > 1 ? 's' : ''}</strong></span> : null
                    })()}
                    {l.note && <span className="muted tiny">Decision note: “{l.note}” — {l.decidedBy}</span>}
                  </div>
                  {canDecideLeave(db, session, l) && (
                    <div className="req-actions">
                      <DecisionBar
                        onApprove={(n) => decideLeave(l.id, true, n)}
                        onReject={(n) => decideLeave(l.id, false, n)}
                      />
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ))}

      {tab === 'profile' &&
        (profiles.length === 0 ? (
          <Empty icon={<UserRound />} title="No profile changes waiting" />
        ) : (
          <div className="req-grid">
            {profiles.map((p) => {
              const s = db.students.find((x) => x.id === p.studentId)
              if (!s) return null
              return (
                <article key={p.id} className="req-card card">
                  <div className="req-top">
                    <div className="person">
                      <Avatar name={s.name} src={s.photo} size={40} />
                      <div className="stack-s" style={{ gap: 2 }}>
                        <strong>{s.name}</strong>
                        <span className="muted tiny">{s.rollNo} · {s.department} Y{s.year} {s.section}</span>
                      </div>
                    </div>
                    <Badge tone={p.status === 'approved' ? 'green' : p.status === 'rejected' ? 'red' : 'amber'}>{p.status}</Badge>
                  </div>
                  <ul className="diff">
                    {Object.entries(p.changes).map(([k, v]) => (
                      <li key={k}>
                        <span className="spec">{FIELD_LABEL[k] ?? k}</span>
                        {k === 'photo' ? (
                          <span className="row gap-s">
                            <Avatar name={s.name} src={s.photo} size={44} /> → {v ? <img src={v as string} alt="New photo" className="diff-photo" /> : <em>remove photo</em>}
                          </span>
                        ) : (
                          <span><del>{(s as unknown as Record<string, string>)[k] || '—'}</del> → <strong>{(v as string) || '—'}</strong></span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {p.reason && <span className="muted tiny">Reason: “{p.reason}” · {formatDate(p.createdAt, { day: 'numeric', month: 'short' })}</span>}
                  {p.status === 'pending' && <div className="req-actions"><DecisionBar onApprove={(n) => decideProfile(p.id, true, n)} onReject={(n) => decideProfile(p.id, false, n)} /></div>}
                </article>
              )
            })}
          </div>
        ))}

      {tab === 'bills' &&
        (bills.length === 0 ? (
          <Empty icon={<Receipt />} title="No bills waiting" />
        ) : (
          <div className="req-grid">
            {bills.map((b) => {
              const t = billTotals(b)
              const v = db.vendors.find((x) => x.id === b.vendorId)
              const req = b.requestId ? db.requests.find((r) => r.id === b.requestId) : undefined
              return (
                <article key={b.id} className="req-card card">
                  <div className="req-top">
                    <div className="stack-s" style={{ gap: 2 }}>
                      <span className="spec">{b.billNo} · {b.category}</span>
                      <strong>{v?.name}</strong>
                      <span className="muted tiny">{b.items.map((i) => i.description).join(', ')}</span>
                    </div>
                    <Badge tone={b.status === 'pending' ? 'amber' : b.status === 'cancelled' ? 'red' : 'green'}>{b.status}</Badge>
                  </div>
                  <dl className="mini-dl">
                    <dt>Taxable</dt><dd>{formatMoney(t.taxable, db.branding.currency)}</dd>
                    <dt>GST</dt><dd>{formatMoney(t.gst, db.branding.currency)}</dd>
                    {t.tds > 0 && (<><dt>TDS {b.tdsSection}</dt><dd>−{formatMoney(t.tds, db.branding.currency)}</dd></>)}
                    <dt>Net payable</dt><dd><strong>{formatMoney(t.payable, db.branding.currency)}</strong></dd>
                  </dl>
                  {req && <span className="tiny muted">For request {req.ref}: {req.title}</span>}
                  {b.status === 'pending' && <div className="req-actions"><DecisionBar approveLabel="Approve payment" onApprove={(n) => decideBill(b.id, true, n)} onReject={(n) => decideBill(b.id, false, n)} /></div>}
                </article>
              )
            })}
          </div>
        ))}
    </>
  )

  function decideLeave(id: string, approve: boolean, note: string) {
    update((d) => {
      const l = d.leaves.find((x) => x.id === id)
      if (!l) return
      l.status = approve ? 'approved' : 'rejected'
      l.decidedBy = actor
      l.decidedAt = now()
      l.note = note || undefined
      notify(d, [`staff:${l.staffId}`], { kind: 'leave', important: true, title: `Leave ${l.status}`, body: `${l.days} day(s) from ${formatDate(l.from, { day: 'numeric', month: 'short' })}${note ? ` — “${note}”` : ''}`, link: '/staff/requests?tab=leave' })
    })
    toast(approve ? 'Leave approved' : 'Leave rejected', approve ? 'success' : 'info')
  }

  function decideProfile(id: string, approve: boolean, note: string) {
    update((d) => {
      const p = d.profileChanges.find((x) => x.id === id)
      if (!p) return
      p.status = approve ? 'approved' : 'rejected'
      p.decidedBy = actor
      p.decidedAt = now()
      p.note = note || undefined
      const s = d.students.find((x) => x.id === p.studentId)
      if (approve && s) Object.assign(s, p.changes)
      notify(d, [`student:${p.studentId}`], { kind: 'profile', important: true, title: `Profile change ${p.status}`, body: approve ? 'Your profile has been updated.' : `Not approved${note ? ` — “${note}”` : ''}`, link: '/student/profile' })
    })
    toast(approve ? 'Profile updated for the student' : 'Profile change rejected', approve ? 'success' : 'info')
  }

  function decideBill(id: string, approve: boolean, note: string) {
    update((d) => {
      const b = d.bills.find((x) => x.id === id)
      if (!b) return
      b.status = approve ? 'approved' : 'cancelled'
      if (note) b.notes = `${b.notes ? b.notes + '\n' : ''}Management: ${note}`
      notify(d, d.accountants.map((a) => `accountant:${a.id}`), { kind: 'finance', important: approve, title: `Bill ${b.billNo} ${approve ? 'approved — ready to pay' : 'rejected'}`, body: d.vendors.find((v) => v.id === b.vendorId)?.name ?? '', link: '/accountant/bills' })
    })
    toast(approve ? 'Bill approved for payment' : 'Bill rejected', approve ? 'success' : 'info')
  }
}
