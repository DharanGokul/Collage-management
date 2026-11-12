import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, Wallet, FileText, PartyPopper, MessageSquareText, Receipt, AlertTriangle, Clock, Megaphone } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty } from '../../components/ui'
import { Donut } from '../../components/charts'
import { ComingUp, Greeting, NeedsYou, UpNext, WeekAhead, type Need } from '../../components/dash'
import { EventDetail, useRegistration } from '../shared/eventsUi'
import { addDays, agenda, canRegister, countdown, eventRange, myRegistration, type AgendaItem } from '../../lib/agenda'
import { formatDate, formatMoney, studentClassKey, studentFeeStatus, summarize, weekdayIndex } from '../../lib/utils'
import type { CampusEvent } from '../../types'

export default function StudentDashboard() {
  const { db, session } = useStore()
  const go = useNavigate()
  const { register } = useRegistration()
  const [viewing, setViewing] = useState<CampusEvent | null>(null)
  const me = db.students.find((s) => s.id === session?.userId)
  const now = new Date()
  const upcoming = useMemo(() => (session ? agenda(db, session, now, addDays(now, 30), { includeFees: false, includeClasses: true }).filter((i) => i.end > now) : []), [db, session]) // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => {
    const s = new Date()
    s.setHours(0, 0, 0, 0)
    return session ? agenda(db, session, s, addDays(s, 7), { includeFees: true }) : []
  }, [db, session])
  if (!me || !session) return <Empty title="Student record not found" />

  const cur = db.branding.currency
  const key = studentClassKey(me)
  const att = summarize(db.attendance.filter((a) => a.classKey === key), me.id)
  const due = studentFeeStatus(db, me).filter((f) => f.status !== 'paid')
  const dueTotal = due.reduce((a, f) => a + f.total, 0)
  const nextExam = upcoming.find((i) => i.kind === 'exam')
  const hero = upcoming.find((i) => i.kind !== 'class') ?? upcoming[0] ?? null
  const myRegs = db.events.filter((e) => myRegistration(e, session) && eventRange(e).end > now)
  const openEvents = db.events.filter((e) => e.registration.enabled && canRegister(db, session, e).ok && !myRegistration(e, session))
  const tickets = db.tickets.filter((t) => t.from.userId === me.id)
  const todayClasses = db.timetable.filter((t) => t.classKey === key && t.day === weekdayIndex(now)).sort((a, b) => a.period - b.period)

  const needs: Need[] = [
    ...due.map<Need>((f) => ({
      id: f.fee.id,
      icon: <Receipt size={18} />,
      alert: f.status === 'overdue',
      title: `${f.fee.name} · ${formatMoney(f.total, cur)}`,
      sub: f.status === 'overdue' ? `Overdue since ${formatDate(f.fee.dueDate)}${f.lateFee ? ` · includes ${formatMoney(f.lateFee, cur)} late fee` : ''}` : `Due ${formatDate(f.fee.dueDate)}`,
      actions: <Button size="sm" variant="ink" onClick={() => go('/student/fees')}>Pay now</Button>,
    })),
    ...tickets.filter((t) => t.unreadByRequester).map<Need>((t) => ({ id: t.id, icon: <MessageSquareText size={18} />, title: `Reply from the office: ${t.subject}`, sub: `${t.ref} · ${t.status.replace('_', ' ')}`, actions: <Button size="sm" variant="secondary" onClick={() => go(`/student/queries?t=${t.id}`)}>Read</Button> })),
    ...(att.total > 0 && att.pct < 75 ? [{ id: 'att', icon: <AlertTriangle size={18} />, alert: true, title: `Attendance ${att.pct}% — below 75%`, sub: 'You may be barred from exams. Talk to your class advisor.', actions: <Button size="sm" variant="secondary" onClick={() => go('/student/attendance')}>View</Button> }] : []),
    ...openEvents.slice(0, 3).map<Need>((e) => ({
      id: e.id,
      icon: <PartyPopper size={18} />,
      title: e.title,
      sub: `Open to apply${e.registration.deadline ? ` · closes ${formatDate(e.registration.deadline, { day: 'numeric', month: 'short' })}` : ''}`,
      actions: <><Button size="sm" variant="ink" onClick={() => register(e)}>Apply</Button><Button size="sm" variant="secondary" onClick={() => setViewing(e)}>Details</Button></>,
    })),
  ]

  const onItem = (i: AgendaItem) => {
    const e = i.eventId && db.events.find((x) => x.id === i.eventId)
    if (e) setViewing(e)
    else if (i.kind === 'class') go('/student/timetable')
    else go('/student/calendar')
  }

  return (
    <>
      <Greeting
        name={me.name}
        kpis={[
          { icon: <CalendarCheck size={18} />, value: `${att.pct}%`, label: `Attendance · ${att.present + att.late} of ${att.total} periods`, badge: att.total > 0 && att.pct < 75 ? <Badge tone="red">low</Badge> : undefined },
          { icon: <Wallet size={18} />, value: formatMoney(dueTotal, cur), label: `Fees due · ${due.length} item${due.length === 1 ? '' : 's'}` },
          { icon: <FileText size={18} />, value: nextExam ? countdown(nextExam.start) : '—', label: nextExam ? `Next exam · ${nextExam.title.replace(/^(Mid-sem|Exam):\s*/, '')}` : 'No exams scheduled' },
          { icon: <PartyPopper size={18} />, value: myRegs.length, label: 'Events you’re going to' },
        ]}
        action={<Button variant="ink" icon={<Receipt size={16} />} onClick={() => go('/student/fees')}>Pay fees</Button>}
      />
      <div className="grid dash">
        <Card title="Up next" actions={<span className="muted tiny">{me.rollNo} · {me.department} Y{me.year} {me.section}</span>}>
          <div className="stack">
            <UpNext item={hero} onOpen={onItem} />
            <ComingUp items={upcoming.filter((i) => i.id !== hero?.id).slice(0, 6)} onOpen={onItem} />
          </div>
        </Card>
        <NeedsYou items={needs} />
      </div>
      <WeekAhead items={week} calendarTo="/student/calendar" />
      <div className="grid three-col">
        <Card title="Attendance" actions={<Link className="link" to="/student/attendance">Details</Link>}>
          <div className="row gap center-v">
            <Donut value={att.pct} label="overall" />
            <div className="stack-s">
              <span><Badge tone="green">{att.present}</Badge> present</span>
              <span><Badge tone="amber">{att.late}</Badge> late</span>
              <span><Badge tone="red">{att.absent}</Badge> absent</span>
            </div>
          </div>
        </Card>
        <Card title="Today's classes" pad={false}>
          {todayClasses.length === 0 ? <Empty icon={<Clock />} title="No classes today" /> : (
            <ul className="schedule">
              {todayClasses.map((t) => {
                const p = db.periods.find((x) => x.no === t.period)
                const sub = db.subjects.find((s) => s.id === t.subjectId)
                return <li key={t.id}><span className="time">{p?.start}<small>{p?.end}</small></span><div><strong>{sub?.name}</strong><small className="muted">{db.staff.find((s) => s.id === sub?.staffId)?.name ?? 'TBA'} · {t.room}</small></div></li>
              })}
            </ul>
          )}
        </Card>
        <Card title="Announcements">
          {db.announcements.filter((a) => a.audience !== 'staff').length === 0 ? <Empty icon={<Megaphone />} title="No announcements" /> : (
            <ul className="feed">{db.announcements.filter((a) => a.audience !== 'staff').map((a) => <li key={a.id}><strong>{a.title}</strong><p className="muted">{a.body}</p><small className="muted">{formatDate(a.createdAt)}</small></li>)}</ul>
          )}
        </Card>
      </div>
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
