import { Link } from 'react-router-dom'
import { useNow, useToday } from '../../lib/useNow'
import { Users, GraduationCap, CalendarCheck, ClipboardCheck, Wrench, Plane } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Avatar, Badge, Card, Empty, PageHeader, Progress, Stat } from '../../components/ui'
import { Pulse } from '../../components/dash'
import { RequestCard } from '../shared/requestsUi'
import { classLabel, studentClassKey, weekdayIndex } from '../../lib/utils'
import { canDecide, canDecideLeave, hodDepartment } from '../../lib/workflow'

/** HOD view of their department: people, today's teaching, attendance and requests. */
export default function Department() {
  const { db, session } = useStore()
  const now = useNow()
  const today = useToday()
  const dept = hodDepartment(db, session?.userId)
  if (!session || !dept) return <Empty title="Only heads of department can see this page" />
  const staff = db.staff.filter((s) => s.department === dept.code)
  const students = db.students.filter((s) => s.department === dept.code && s.status === 'active')
  const day = weekdayIndex(new Date(now))
  const classes = [...new Set(students.map(studentClassKey))].sort()

  const pct = (pred: (k: string) => boolean) => {
    let p = 0, t = 0
    for (const a of db.attendance) if (pred(a.classKey)) for (const m of Object.values(a.marks)) { t++; if (m !== 'A') p++ }
    return t ? (p / t) * 100 : 0
  }
  const onLeave = new Set(db.leaves.filter((l) => l.status === 'approved' && l.from <= today && l.to >= today).map((l) => l.staffId))
  const pending = db.requests.filter((r) => canDecide(db, session, r)).length + db.leaves.filter((l) => canDecideLeave(db, session, l)).length + db.profileChanges.filter((p) => p.status === 'pending' && db.students.find((s) => s.id === p.studentId)?.department === dept.code).length
  const reqs = db.requests.filter((r) => r.department === dept.code).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <>
      <PageHeader title={`${dept.name}`} subtitle="Your department at a glance" actions={<Link className="btn btn-primary btn-md" to="/staff/approvals"><ClipboardCheck size={16} /><span>Approvals{pending ? ` (${pending})` : ''}</span></Link>} />
      <div className="grid stats-grid">
        <Stat label="Faculty" value={staff.length} icon={<Users size={20} />} hint={onLeave.size ? `${onLeave.size} on leave today` : 'All present'} />
        <Stat label="Students" value={students.length} icon={<GraduationCap size={20} />} tone="blue" hint={`${classes.length} classes`} />
        <Stat label="Attendance" value={`${pct((k) => k.startsWith(dept.code + '|')).toFixed(1)}%`} icon={<CalendarCheck size={20} />} tone="green" />
        <Stat label="Waiting for you" value={pending} icon={<ClipboardCheck size={20} />} tone={pending ? 'red' : 'green'} />
      </div>
      <div className="grid dash">
        <Card title="Faculty today" pad={false}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Faculty</th><th className="hide-sm">Subjects</th><th>Today</th><th>Attendance</th></tr></thead>
              <tbody>
                {staff.map((s) => {
                  const ids = new Set(db.subjects.filter((x) => x.staffId === s.id).map((x) => x.id))
                  const slots = db.timetable.filter((t) => t.day === day && ids.has(t.subjectId))
                  const marked = slots.filter((t) => db.attendance.some((a) => a.date === today && a.classKey === t.classKey && a.period === t.period)).length
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <Avatar name={s.name} src={s.photo} size={32} />
                          <div><strong>{s.name}</strong><div className="muted tiny">{s.designation}</div></div>
                        </div>
                      </td>
                      <td className="hide-sm tiny">{ids.size} subjects</td>
                      <td>{onLeave.has(s.id) ? <Badge tone="amber"><Plane size={12} /> On leave</Badge> : `${slots.length} classes`}</td>
                      <td style={{ minWidth: 120 }}>{slots.length ? <div className="row gap-s"><Progress value={(marked / slots.length) * 100} /><span className="tiny">{marked}/{slots.length}</span></div> : <span className="muted tiny">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Attendance by class">
          {classes.map((k) => {
            const v = pct((x) => x === k)
            return <Pulse key={k} code={k.split('|')[1] ? `Y${k.split('|')[1]}` : '—'} name={classLabel(k)} value={`${v.toFixed(1)}%`} pct={v} sub={`${students.filter((s) => studentClassKey(s) === k).length} students`} />
          })}
        </Card>
      </div>
      <Card title="Department requests" actions={<Link className="link" to="/staff/approvals">Open approvals</Link>}>
        {reqs.length === 0 ? <Empty icon={<Wrench />} title="No requests" /> : <div className="req-grid">{reqs.slice(0, 6).map((r) => <RequestCard key={r.id} r={r} />)}</div>}
      </Card>
    </>
  )
}
