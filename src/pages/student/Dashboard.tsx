import { Link } from 'react-router-dom'
import { CalendarCheck, Wallet, Clock, BookOpen } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, PageHeader, Stat } from '../../components/ui'
import { Donut } from '../../components/charts'
import { formatDate, formatMoney, studentClassKey, studentFeeStatus, summarize, weekdayIndex } from '../../lib/utils'

export default function StudentDashboard() {
  const { db, session } = useStore()
  const me = db.students.find((s) => s.id === session?.userId)
  if (!me) return <Empty title="Student record not found" />
  const cur = db.branding.currency
  const key = studentClassKey(me)
  const att = summarize(db.attendance.filter((a) => a.classKey === key), me.id)
  const fees = studentFeeStatus(db, me)
  const due = fees.filter((f) => f.status !== 'paid')
  const dueTotal = due.reduce((a, f) => a + f.total, 0)
  const today = db.timetable.filter((t) => t.classKey === key && t.day === weekdayIndex(new Date())).sort((a, b) => a.period - b.period)
  const anns = db.announcements.filter((a) => a.audience !== 'staff')

  return (
    <>
      <PageHeader title={`Hi, ${me.name.split(' ')[0]} 👋`} subtitle={`${me.rollNo} · ${db.departments.find((d) => d.code === me.department)?.name} · Year ${me.year}, Section ${me.section}`} />
      <div className="grid stats-grid">
        <Stat label="Attendance" value={`${att.pct}%`} icon={<CalendarCheck size={20} />} tone={att.pct >= 75 ? 'green' : 'red'} hint={`${att.present + att.late} of ${att.total} periods`} />
        <Stat label="Fees due" value={formatMoney(dueTotal, cur)} icon={<Wallet size={20} />} tone={due.some((d) => d.status === 'overdue') ? 'red' : 'amber'} hint={`${due.length} pending item(s)`} />
        <Stat label="Classes today" value={today.length} icon={<Clock size={20} />} tone="blue" />
        <Stat label="Subjects" value={db.subjects.filter((s) => s.department === me.department && s.year === me.year).length} icon={<BookOpen size={20} />} />
      </div>
      <div className="grid two">
        <Card title="Fee summary" actions={<Link to="/student/fees" className="link">View all</Link>}>
          {due.length === 0 ? (
            <Empty title="All fees paid 🎉" />
          ) : (
            <ul className="due-list">
              {due.map((f) => (
                <li key={f.fee.id}>
                  <div><strong>{f.fee.name}</strong><small className="muted">Due {formatDate(f.fee.dueDate)}</small></div>
                  <div className="right"><strong>{formatMoney(f.total, cur)}</strong>{f.status === 'overdue' ? <Badge tone="red">Overdue</Badge> : <Badge tone="amber">Due</Badge>}</div>
                </li>
              ))}
              <li><Link to="/student/fees" className="w-full"><Button className="w-full">Pay {formatMoney(dueTotal, cur)} now</Button></Link></li>
            </ul>
          )}
        </Card>
        <Card title="Attendance">
          <div className="row gap center-v">
            <Donut value={att.pct} label="overall" />
            <div className="stack-s">
              <span><Badge tone="green">{att.present}</Badge> present</span>
              <span><Badge tone="amber">{att.late}</Badge> late</span>
              <span><Badge tone="red">{att.absent}</Badge> absent</span>
              {att.total > 0 && att.pct < 75 && <small className="text-red">Below the 75% requirement</small>}
            </div>
          </div>
        </Card>
      </div>
      <div className="grid two">
        <Card title="Today's classes" pad={false}>
          {today.length === 0 ? <Empty icon={<Clock />} title="No classes today" /> : (
            <ul className="schedule">
              {today.map((t) => {
                const p = db.periods.find((x) => x.no === t.period)
                const sub = db.subjects.find((s) => s.id === t.subjectId)
                return <li key={t.id}><span className="time">{p?.start}<small>{p?.end}</small></span><div><strong>{sub?.name}</strong><small className="muted">{db.staff.find((s) => s.id === sub?.staffId)?.name ?? 'TBA'} · {t.room}</small></div></li>
              })}
            </ul>
          )}
        </Card>
        <Card title="Announcements">
          {anns.length === 0 ? <Empty title="No announcements" /> : <ul className="feed">{anns.map((a) => <li key={a.id}><strong>{a.title}</strong><p className="muted">{a.body}</p><small className="muted">{formatDate(a.createdAt)}</small></li>)}</ul>}
        </Card>
      </div>
    </>
  )
}
