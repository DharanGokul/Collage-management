import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  GraduationCap, Wallet, CalendarCheck, Megaphone, Trash2, Plus, AlertTriangle, MessageSquareText, Inbox, History, Send, Check, PartyPopper,
  Receipt, ClipboardCheck, Mail, UserPlus,
} from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal } from '../../components/ui'
import { BarChart } from '../../components/charts'
import { ComingUp, Greeting, NeedsYou, Pulse, UpNext, WeekAhead, type Need } from '../../components/dash'
import { EventDetail } from '../shared/eventsUi'
import { addDays, agenda, eventRange, registeredCount, type AgendaItem } from '../../lib/agenda'
import { classLabel, formatDate, formatMoney, studentFeeStatus, summarize, uid } from '../../lib/utils'
import { useNow } from '../../lib/useNow'
import type { Announcement, CampusEvent } from '../../types'

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${Math.max(1, m)} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

export default function AdminDashboard() {
  const { db, session, update, toast } = useStore()
  const go = useNavigate()
  const [params, setParams] = useSearchParams()
  const [annOpen, setAnnOpen] = useState(false)
  const [viewing, setViewing] = useState<CampusEvent | null>(null)
  const cur = db.branding.currency

  useEffect(() => {
    if (params.get('announce')) {
      // oxlint-disable-next-line react/set-state-in-effect -- one-shot: consumes a URL query param (external router state) into local state, then clears it
      setAnnOpen(true)
      params.delete('announce')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const nowMs = useNow()
  const now = useMemo(() => new Date(nowMs), [nowMs])
  const upcoming = useMemo(() => (session ? agenda(db, session, now, addDays(now, 30), { includeFees: false }).filter((i) => i.end > now) : []), [db, session, now])
  const week = useMemo(() => {
    const s = new Date(nowMs)
    s.setHours(0, 0, 0, 0)
    return session ? agenda(db, session, s, addDays(s, 7), { includeFees: true }) : []
  }, [db, session, nowMs])

  const stats = useMemo(() => {
    let billed = 0, collected = 0, defaulters = 0
    const byDept: Record<string, number> = {}
    for (const s of db.students.filter((x) => x.status === 'active')) {
      let owes = false
      for (const f of studentFeeStatus(db, s)) {
        billed += f.fee.amount
        if (f.payment) {
          collected += f.payment.amount
          byDept[s.department] = (byDept[s.department] ?? 0) + f.payment.amount + f.payment.lateFee
        } else if (f.status === 'overdue') owes = true
      }
      if (owes) defaulters++
    }
    const dates = [...new Set(db.attendance.map((a) => a.date))].sort()
    const pctFor = (ds: string[], pred: (k: string) => boolean = () => true) => {
      let p = 0, t = 0
      for (const a of db.attendance) if (ds.includes(a.date) && pred(a.classKey)) for (const m of Object.values(a.marks)) { t++; if (m !== 'A') p++ }
      return t ? (p / t) * 100 : 0
    }
    const last5 = dates.slice(-5), prev5 = dates.slice(-10, -5)
    const dept = db.departments.map((d) => {
      const pred = (k: string) => k.startsWith(d.code + '|')
      const cur5 = pctFor(last5, pred)
      return { code: d.code, name: d.name, pct: cur5, trend: cur5 - pctFor(prev5, pred), students: db.students.filter((s) => s.department === d.code && s.status === 'active').length }
    })
    const low = db.students.filter((s) => { const r = summarize(db.attendance, s.id); return r.total > 0 && r.pct < 75 }).length
    return { billed, collected, defaulters, byDept, avg: pctFor(dates.slice(-10)), dept, low }
  }, [db])

  const openTickets = db.tickets.filter((t) => t.status === 'open' || t.status === 'in_progress')
  const unread = db.tickets.filter((t) => t.unreadByAdmin)

  const needs: Need[] = [
    ...unread
      .sort((a, b) => ({ urgent: 0, high: 1, normal: 2, low: 3 })[a.priority] - ({ urgent: 0, high: 1, normal: 2, low: 3 })[b.priority])
      .map<Need>((t) => ({
        id: t.id,
        icon: t.kind === 'complaint' ? <AlertTriangle size={18} /> : <MessageSquareText size={18} />,
        alert: t.priority === 'urgent',
        title: t.subject,
        sub: `${t.kind === 'complaint' ? 'Complaint' : 'Query'} · ${t.anonymous ? `Anonymous ${t.from.role}` : t.from.name} · ${ago(t.createdAt)}`,
        actions: (
          <>
            <Button size="sm" variant="ink" icon={<Send size={14} />} onClick={() => go(`/admin/queries?t=${t.id}`)}>Reply</Button>
            <Button size="sm" variant="secondary" icon={<Check size={14} />} onClick={() => { update((d) => { const x = d.tickets.find((y) => y.id === t.id); if (x) { x.status = 'resolved'; x.unreadByAdmin = false; x.unreadByRequester = true; x.updatedAt = new Date().toISOString() } }); toast(`${t.ref} resolved`) }}>Resolve</Button>
          </>
        ),
      })),
    ...(stats.defaulters
      ? [{ id: 'fees', icon: <Receipt size={18} />, alert: true, title: `${stats.defaulters} students have overdue fees`, sub: `${formatMoney(stats.billed - stats.collected, cur)} outstanding across all fee items`, actions: <Button size="sm" variant="ink" onClick={() => go('/admin/fees')}>Send reminders</Button> }]
      : []),
    ...(stats.low
      ? [{ id: 'low', icon: <ClipboardCheck size={18} />, title: `${stats.low} students below 75% attendance`, sub: 'Alert them and their class advisors', actions: <Button size="sm" variant="secondary" onClick={() => go('/admin/attendance')}>Review</Button> }]
      : []),
    ...db.events
      .filter((e) => e.registration.enabled && e.registration.deadline && eventRange(e).start > now && new Date(e.registration.deadline + 'T23:59:59').getTime() - now.getTime() < 4 * 86400000)
      .map<Need>((e) => ({ id: e.id, icon: <PartyPopper size={18} />, title: `Registration closes ${formatDate(e.registration.deadline!, { weekday: 'short', day: 'numeric' })}: ${e.title}`, sub: `${registeredCount(e)}${e.registration.capacity ? ` of ${e.registration.capacity}` : ''} registered`, actions: <Button size="sm" variant="secondary" onClick={() => setViewing(e)}>View</Button> })),
  ]

  // Team activity, newest first (derived from what actually happened in the data).
  const activity = useMemo(() => {
    const out: { at: string; who: string; text: string; icon: React.ReactNode }[] = []
    for (const p of [...db.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 4)) {
      const s = db.students.find((x) => x.id === p.studentId)
      out.push({ at: p.paidAt, who: s?.name ?? 'A student', text: `paid ${formatMoney(p.amount + p.lateFee, cur)} · ${db.fees.find((f) => f.id === p.feeId)?.name ?? 'fee'}`, icon: <Wallet size={13} /> })
    }
    for (const e of db.events) for (const r of e.registrations.slice(-2)) out.push({ at: r.at, who: r.name, text: `registered for “${e.title}”`, icon: <PartyPopper size={13} /> })
    for (const t of db.tickets.slice(0, 5)) out.push({ at: t.createdAt, who: t.anonymous ? 'Someone' : t.from.name, text: `raised ${t.kind === 'complaint' ? 'a complaint' : 'a query'}: “${t.subject.slice(0, 44)}${t.subject.length > 44 ? '…' : ''}”`, icon: <MessageSquareText size={13} /> })
    for (const m of db.emailLog.slice(0, 2)) out.push({ at: m.sentAt, who: m.sentBy, text: `emailed ${m.to[0]}`, icon: <Mail size={13} /> })
    const marked = [...db.attendance].sort((a, b) => b.date.localeCompare(a.date) || b.period - a.period).slice(0, 2)
    for (const a of marked) out.push({ at: `${a.date}T${db.periods.find((p) => p.no === a.period)?.end ?? '17:00'}:00`, who: db.staff.find((s) => s.id === a.markedBy)?.name ?? 'Admin', text: `marked attendance for ${classLabel(a.classKey)} · P${a.period}`, icon: <ClipboardCheck size={13} /> })
    return out.filter((x) => new Date(x.at) <= now).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7)
  }, [db, cur, now])

  const statusCounts = (['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => db.tickets.filter((t) => t.status === s).length)
  const totalT = Math.max(1, statusCounts.reduce((a, b) => a + b, 0))
  const onItem = (i: AgendaItem) => {
    const e = i.eventId && db.events.find((x) => x.id === i.eventId)
    if (e) setViewing(e)
    else go('/admin/calendar')
  }

  return (
    <>
      <Greeting
        name={session?.name ?? 'Admin'}
        kpis={[
          { icon: <GraduationCap size={18} />, value: db.students.filter((s) => s.status === 'active').length, label: `Students across ${db.departments.length} departments` },
          { icon: <CalendarCheck size={18} />, value: `${stats.avg.toFixed(1)}%`, label: 'Attendance, last 10 working days' },
          { icon: <Wallet size={18} />, value: `${stats.billed ? Math.round((stats.collected / stats.billed) * 100) : 0}%`, label: `Fees collected · ${formatMoney(stats.collected, cur)}` },
          { icon: <Inbox size={18} />, value: openTickets.length, label: 'Open queries & complaints', badge: unread.length ? <Badge tone="red">{unread.length} new</Badge> : undefined },
        ]}
        action={
          <div className="row gap-s">
            <Button variant="secondary" icon={<Megaphone size={16} />} onClick={() => setAnnOpen(true)}>Announce</Button>
            <Button variant="ink" icon={<Plus size={16} />} onClick={() => go('/admin/events?new=event')}>New event</Button>
          </div>
        }
      />

      <div className="grid dash">
        <Card title="Up next" actions={<Link to="/admin/calendar" className="link">Open calendar</Link>}>
          <div className="stack">
            <UpNext item={upcoming[0] ?? null} onOpen={onItem} />
            <ComingUp items={upcoming.slice(1, 7)} onOpen={onItem} />
          </div>
        </Card>
        <NeedsYou items={needs} />
      </div>

      <WeekAhead items={week} calendarTo="/admin/calendar" />

      <div className="grid three-col">
        <Card title="Attendance pulse" actions={<Link className="round-btn" to="/admin/attendance" aria-label="Attendance"><CalendarCheck size={16} /></Link>}>
          {stats.dept.map((d) => (
            <Pulse key={d.code} code={d.code} name={d.name} value={`${d.pct.toFixed(1)}%`} pct={d.pct} trend={d.trend} sub={`${d.students} students`} />
          ))}
          <p className="muted tiny mt">Last 5 working days vs the 5 before.</p>
        </Card>
        <Card title="Help desk pulse" actions={<Link className="round-btn" to="/admin/queries" aria-label="Help desk"><Inbox size={16} /></Link>}>
          <div className="tri">
            <div><strong>{openTickets.length}</strong><span className="muted tiny">active</span></div>
            <div><strong>{unread.length}</strong><span className="muted tiny">unread</span></div>
            <div><strong>{openTickets.filter((t) => t.priority === 'urgent' || t.priority === 'high').length}</strong><span className="muted tiny">priority</span></div>
          </div>
          <div className="segbar" aria-hidden>
            {statusCounts.map((n, i) => n > 0 && <span key={i} style={{ flex: n / totalT, background: ['var(--warn)', 'var(--info)', 'var(--ok)', 'var(--control-border)'][i] }} />)}
          </div>
          <div className="legend">
            {['Open', 'In progress', 'Resolved', 'Closed'].map((l, i) => <span key={l}><span className="status-dot" style={{ color: ['var(--warn)', 'var(--info)', 'var(--ok)', 'var(--control-border)'][i] }} />{l} {statusCounts[i]}</span>)}
          </div>
          <ul className="feed mt">
            {db.tickets.slice(0, 3).map((t) => (
              <li key={t.id}>
                <Link to={`/admin/queries?t=${t.id}`} className="feed-head">
                  <strong className="ellipsis">{t.anonymous ? 'Anonymous' : t.from.name}</strong>
                  {t.unreadByAdmin && <span className="tk-unread" style={{ marginTop: 0 }} />}
                  <span className="spacer" />
                  <Badge tone={t.kind === 'complaint' ? 'red' : 'gray'}>{t.kind}</Badge>
                </Link>
                <span className="muted tiny ellipsis">{t.subject}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Team activity" actions={<span className="round-btn" aria-hidden><History size={16} /></span>}>
          {activity.length === 0 ? <Empty title="No activity yet" /> : (
            <ul className="feed">
              {activity.map((a, i) => (
                <li key={i}>
                  <span><strong>{a.who}</strong> <span className="muted">{a.text}</span></span>
                  <small className="muted row gap-s">{a.icon} {ago(a.at)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid two">
        <Card title="Announcements" actions={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setAnnOpen(true)}>New</Button>}>
          {db.announcements.length === 0 ? (
            <Empty icon={<Megaphone />} title="Nothing announced yet" />
          ) : (
            <ul className="feed">
              {db.announcements.map((a) => (
                <li key={a.id}>
                  <div className="feed-head">
                    <strong>{a.title}</strong>
                    <Badge tone={a.audience === 'all' ? 'primary' : a.audience === 'staff' ? 'blue' : 'green'}>{a.audience}</Badge>
                    <button className="icon-btn sm" aria-label="Delete announcement" onClick={() => { update((d) => { d.announcements = d.announcements.filter((x) => x.id !== a.id) }); toast('Announcement removed') }}><Trash2 size={14} /></button>
                  </div>
                  <p className="muted">{a.body}</p>
                  <small className="muted">{formatDate(a.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Fee collection by department" actions={<Link className="link" to="/admin/fees">Open ledger</Link>}>
          <BarChart data={db.departments.map((d) => ({ label: d.code, value: stats.byDept[d.code] ?? 0 }))} format={(v) => formatMoney(v, cur)} />
          <div className="row gap-s mt"><UserPlus size={14} className="muted" /><span className="muted tiny">{stats.defaulters} students with overdue fees</span></div>
        </Card>
      </div>

      <AnnouncementModal
        open={annOpen}
        onClose={() => setAnnOpen(false)}
        onSave={(a) => {
          update((d) => { d.announcements.unshift(a) })
          toast('Announcement published')
          setAnnOpen(false)
        }}
      />
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} onEdit={() => { setViewing(null); go('/admin/events') }} />}
    </>
  )
}

function AnnouncementModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: Announcement) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Announcement['audience']>('all')
  const valid = title.trim().length > 2
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New announcement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button icon={<Plus size={16} />} disabled={!valid} onClick={() => { onSave({ id: uid('ann'), title: title.trim(), body: body.trim(), audience, createdAt: new Date().toISOString() }); setTitle(''); setBody('') }}>Publish</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" span={2}>{(id) => <input id={id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />}</Field>
        <Field label="Audience" span={2}>
          {(id) => (
            <select id={id} className="input" value={audience} onChange={(e) => setAudience(e.target.value as Announcement['audience'])}>
              <option value="all">Everyone</option>
              <option value="staff">Staff only</option>
              <option value="students">Students only</option>
            </select>
          )}
        </Field>
        <Field label="Message" span={2}>{(id) => <textarea id={id} className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
