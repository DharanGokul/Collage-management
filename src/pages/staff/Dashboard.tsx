import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, CalendarCheck, Clock, MessageSquareText, ClipboardCheck, PartyPopper, Megaphone } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty } from '../../components/ui'
import { ComingUp, Greeting, NeedsYou, Pulse, UpNext, WeekAhead, type Need } from '../../components/dash'
import { EventDetail, useRegistration } from '../shared/eventsUi'
import { addDays, agenda, canRegister, eventRange, type AgendaItem } from '../../lib/agenda'
import { classLabel, formatDate, toISODate, weekdayIndex } from '../../lib/utils'
import type { CampusEvent } from '../../types'

export default function StaffDashboard() {
  const { db, session } = useStore()
  const go = useNavigate()
  const { register } = useRegistration()
  const [viewing, setViewing] = useState<CampusEvent | null>(null)
  const me = db.staff.find((s) => s.id === session?.userId)
  const subjects = db.subjects.filter((s) => s.staffId === session?.userId)
  const ids = new Set(subjects.map((s) => s.id))
  const todayISO = toISODate(new Date())
  const todays = db.timetable.filter((t) => t.day === weekdayIndex(new Date()) && ids.has(t.subjectId)).sort((a, b) => a.period - b.period)
  const pending = todays.filter((t) => {
    const p = db.periods.find((x) => x.no === t.period)
    const started = p && new Date(`${todayISO}T${p.start}`) <= new Date()
    return started && !db.attendance.some((a) => a.date === todayISO && a.classKey === t.classKey && a.period === t.period)
  })
  const myClasses = [...new Set(db.timetable.filter((t) => ids.has(t.subjectId)).map((t) => t.classKey))].sort()

  const now = new Date()
  const upcoming = useMemo(() => (session ? agenda(db, session, now, addDays(now, 21), { includeClasses: true, includeFees: false }).filter((i) => i.end > now) : []), [db, session]) // eslint-disable-line react-hooks/exhaustive-deps
  const nonClass = upcoming.filter((i) => i.kind !== 'class')
  const week = useMemo(() => {
    const s = new Date()
    s.setHours(0, 0, 0, 0)
    return session ? agenda(db, session, s, addDays(s, 7), { includeFees: false }) : []
  }, [db, session])
  const myTickets = db.tickets.filter((t) => t.from.userId === session?.userId)
  const openEvents = session ? db.events.filter((e) => e.registration.enabled && canRegister(db, session, e).ok && !e.registrations.some((r) => r.userId === session.userId)) : []

  if (!session) return null
  const needs: Need[] = [
    ...pending.map<Need>((t) => ({
      id: t.id,
      icon: <ClipboardCheck size={18} />,
      alert: true,
      title: `Attendance not marked · P${t.period} ${db.subjects.find((s) => s.id === t.subjectId)?.name}`,
      sub: `${classLabel(t.classKey)} · ${t.room}`,
      actions: <Button size="sm" variant="ink" onClick={() => go('/staff/attendance')}>Mark now</Button>,
    })),
    ...myTickets.filter((t) => t.unreadByRequester).map<Need>((t) => ({ id: t.id, icon: <MessageSquareText size={18} />, title: `New reply: ${t.subject}`, sub: `${t.ref} · ${t.status.replace('_', ' ')}`, actions: <Button size="sm" variant="secondary" onClick={() => go(`/staff/queries?t=${t.id}`)}>Read</Button> })),
    ...openEvents.slice(0, 3).map<Need>((e) => ({ id: e.id, icon: <PartyPopper size={18} />, title: e.title, sub: `Open for staff · ${formatDate(eventRange(e).start.toISOString(), { weekday: 'short', day: 'numeric', month: 'short' })}`, actions: <><Button size="sm" variant="ink" onClick={() => register(e)}>Apply</Button><Button size="sm" variant="secondary" onClick={() => setViewing(e)}>Details</Button></> })),
  ]
  const onItem = (i: AgendaItem) => {
    const e = i.eventId && db.events.find((x) => x.id === i.eventId)
    if (e) setViewing(e)
    else if (i.kind === 'class') go('/staff/attendance')
    else go('/staff/calendar')
  }
  const classPct = (k: string) => {
    let p = 0, t = 0
    for (const a of db.attendance) if (a.classKey === k && ids.has(a.subjectId)) for (const m of Object.values(a.marks)) { t++; if (m !== 'A') p++ }
    return t ? (p / t) * 100 : 0
  }

  return (
    <>
      <Greeting
        name={session.name}
        kpis={[
          { icon: <Clock size={18} />, value: todays.length, label: 'Classes today' },
          { icon: <ClipboardCheck size={18} />, value: pending.length, label: 'Attendance to mark', badge: pending.length ? <Badge tone="red">due</Badge> : undefined },
          { icon: <BookOpen size={18} />, value: subjects.length, label: `Subjects · ${myClasses.length} classes` },
          { icon: <MessageSquareText size={18} />, value: myTickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length, label: 'My open queries' },
        ]}
        action={<Button variant="ink" icon={<ClipboardCheck size={16} />} onClick={() => go('/staff/attendance')}>Mark attendance</Button>}
      />
      <div className="grid dash">
        <Card title="Up next" actions={<span className="muted tiny">{me?.designation}</span>}>
          <div className="stack">
            <UpNext item={upcoming[0] ?? null} onOpen={onItem} />
            <ComingUp items={[...upcoming.slice(1, 4), ...nonClass.filter((i) => i.id !== upcoming[0]?.id).slice(0, 3)].slice(0, 6)} onOpen={onItem} />
          </div>
        </Card>
        <NeedsYou items={needs} />
      </div>
      <WeekAhead items={week} calendarTo="/staff/calendar" footer={(d, list) => {
        const n = db.timetable.filter((t) => t.day === weekdayIndex(d) && ids.has(t.subjectId)).length
        return `${n} class${n === 1 ? '' : 'es'}${list.length ? ` · ${list.length} event${list.length > 1 ? 's' : ''}` : ''}`
      }} />
      <div className="grid three-col">
        <Card title="Today's classes" pad={false}>
          {todays.length === 0 ? <Empty icon={<Clock />} title="No classes today" /> : (
            <ul className="schedule">
              {todays.map((t) => {
                const p = db.periods.find((x) => x.no === t.period)
                const done = db.attendance.some((a) => a.date === todayISO && a.classKey === t.classKey && a.period === t.period)
                return (
                  <li key={t.id}>
                    <span className="time">{p?.start}<small>{p?.end}</small></span>
                    <div><strong>{db.subjects.find((s) => s.id === t.subjectId)?.name}</strong><small className="muted">{classLabel(t.classKey)} · {t.room}</small></div>
                    {done ? <Badge tone="green">Marked</Badge> : <Badge tone="amber">Pending</Badge>}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
        <Card title="My classes" actions={<Link className="round-btn" to="/staff/students" aria-label="My students"><CalendarCheck size={16} /></Link>}>
          {myClasses.length === 0 ? <Empty title="No classes assigned" /> : myClasses.map((k) => {
            const pct = classPct(k)
            return <Pulse key={k} code={k.split('|')[0]} name={classLabel(k)} value={`${pct.toFixed(1)}%`} pct={pct} sub={`${db.students.filter((s) => `${s.department}|${s.year}|${s.section}` === k).length} students`} />
          })}
        </Card>
        <Card title="Announcements">
          {db.announcements.filter((a) => a.audience !== 'students').length === 0 ? <Empty icon={<Megaphone />} title="No announcements" /> : (
            <ul className="feed">
              {db.announcements.filter((a) => a.audience !== 'students').map((a) => <li key={a.id}><strong>{a.title}</strong><p className="muted">{a.body}</p><small className="muted">{formatDate(a.createdAt)}</small></li>)}
            </ul>
          )}
        </Card>
      </div>
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
