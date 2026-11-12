import { Link } from 'react-router-dom'
import { BookOpen, CalendarCheck, Clock, GraduationCap } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Card, Empty, PageHeader, Stat } from '../../components/ui'
import { classLabel, formatDate, toISODate, weekdayIndex } from '../../lib/utils'

export default function StaffDashboard() {
  const { db, session } = useStore()
  const me = db.staff.find((s) => s.id === session?.userId)
  const subjects = db.subjects.filter((s) => s.staffId === session?.userId)
  const ids = new Set(subjects.map((s) => s.id))
  const today = weekdayIndex(new Date())
  const todayISO = toISODate(new Date())
  const todays = db.timetable.filter((t) => t.day === today && ids.has(t.subjectId)).sort((a, b) => a.period - b.period)
  const weekly = db.timetable.filter((t) => ids.has(t.subjectId)).length
  const classes = new Set(db.timetable.filter((t) => ids.has(t.subjectId)).map((t) => t.classKey))
  const students = db.students.filter((s) => s.status === 'active' && classes.has(`${s.department}|${s.year}|${s.section}`)).length
  const marked = db.attendance.filter((a) => a.markedBy === session?.userId).length
  const anns = db.announcements.filter((a) => a.audience !== 'students')

  return (
    <>
      <PageHeader title={`Hello, ${me?.name.split(' ').slice(0, 2).join(' ') ?? 'there'}`} subtitle={`${me?.designation ?? ''} · ${db.departments.find((d) => d.code === me?.department)?.name ?? ''}`} />
      <div className="grid stats-grid">
        <Stat label="Classes today" value={todays.length} icon={<Clock size={20} />} />
        <Stat label="Subjects" value={subjects.length} icon={<BookOpen size={20} />} tone="blue" hint={`${weekly} periods / week`} />
        <Stat label="Students" value={students} icon={<GraduationCap size={20} />} tone="green" />
        <Stat label="Sessions marked" value={marked} icon={<CalendarCheck size={20} />} tone="amber" />
      </div>
      <div className="grid two">
        <Card title="Today's schedule" actions={<Link to="/staff/attendance" className="link">Mark attendance</Link>} pad={false}>
          {todays.length === 0 ? (
            <Empty icon={<Clock />} title="No classes today" />
          ) : (
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
        <Card title="Announcements">
          {anns.length === 0 ? <Empty title="No announcements" /> : (
            <ul className="feed">
              {anns.map((a) => <li key={a.id}><strong>{a.title}</strong><p className="muted">{a.body}</p><small className="muted">{formatDate(a.createdAt)}</small></li>)}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
