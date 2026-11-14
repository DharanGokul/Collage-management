import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Avatar, Badge, Card, Empty, PageHeader } from '../../components/ui'
import { classLabel, studentClassKey, summarize } from '../../lib/utils'

export default function StaffStudents() {
  const { db, session } = useStore()
  const subjects = db.subjects.filter((s) => s.staffId === session?.userId)
  const classes = useMemo(() => {
    const ids = new Set(subjects.map((s) => s.id))
    return [...new Set(db.timetable.filter((t) => ids.has(t.subjectId)).map((t) => t.classKey))].sort()
  }, [db.timetable, subjects])
  const [cls, setCls] = useState(classes[0] ?? '')
  const [q, setQ] = useState('')
  const mySubjectIds = new Set(subjects.map((s) => s.id))
  const sessions = db.attendance.filter((a) => a.classKey === cls && mySubjectIds.has(a.subjectId))
  const rows = db.students.filter((s) => s.status === 'active' && studentClassKey(s) === cls && (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.rollNo.toLowerCase().includes(q.toLowerCase())))

  if (!classes.length) return <><PageHeader title="My students" /><Card><Empty title="You have no classes assigned yet" /></Card></>

  return (
    <>
      <PageHeader title="My students" subtitle="Attendance in the subjects you teach" />
      <Card pad={false}>
        <div className="toolbar">
          <div className="chips">{classes.map((k) => <button key={k} className={`chip ${k === cls ? 'active' : ''}`} onClick={() => setCls(k)}>{classLabel(k)}</button>)}</div>
          <div className="search"><Search size={16} /><input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" /></div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th className="hide-sm">Roll no</th><th className="hide-sm">Phone</th><th className="hide-sm">Guardian</th><th>My subjects</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const r = summarize(sessions, s.id)
                return (
                  <tr key={s.id}>
                    <td><div className="person"><Avatar name={s.name} size={32} /><div><strong>{s.name}</strong><div className="muted tiny"><span className="show-sm mono">{s.rollNo}</span><span className="hide-sm">{s.email}</span></div></div></div></td>
                    <td className="mono hide-sm">{s.rollNo}</td>
                    <td className="hide-sm"><a className="link" href={`tel:${s.phone}`}>{s.phone}</a></td>
                    <td className="hide-sm">{s.guardianName}<div className="muted tiny">{s.guardianPhone}</div></td>
                    <td>{r.total ? <Badge tone={r.pct >= 85 ? 'green' : r.pct >= 75 ? 'amber' : 'red'}>{r.pct}% ({r.present + r.late}/{r.total})</Badge> : <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={5} className="center muted">No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
