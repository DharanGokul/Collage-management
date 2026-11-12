import { useStore } from '../../store/AppStore'
import { Badge, Card, Empty, PageHeader, Progress } from '../../components/ui'
import { Donut } from '../../components/charts'
import { formatDate, studentClassKey, summarize } from '../../lib/utils'

export default function StudentAttendance() {
  const { db, session } = useStore()
  const me = db.students.find((s) => s.id === session?.userId)
  if (!me) return <Empty title="Student record not found" />
  const key = studentClassKey(me)
  const sessions = db.attendance.filter((a) => a.classKey === key && a.marks[me.id])
  const overall = summarize(sessions, me.id)
  const subjects = db.subjects.filter((s) => s.department === me.department && s.year === me.year)
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || a.period - b.period).slice(0, 30)
  // Classes needed to reach 75% if currently below.
  const need = overall.pct < 75 ? Math.ceil((0.75 * overall.total - (overall.present + overall.late)) / 0.25) : 0

  return (
    <>
      <PageHeader title="My attendance" subtitle="Late arrivals count as present" />
      <div className="grid side">
        <Card title="Overall">
          <div className="center stack"><Donut value={overall.pct} size={150} label={`${overall.present + overall.late}/${overall.total}`} />
            {need > 0 ? <div className="alert alert-error tiny">Attend the next <strong>{need}</strong> classes in a row to reach 75%.</div> : overall.total > 0 && <div className="alert alert-success tiny">You meet the 75% requirement.</div>}
          </div>
        </Card>
        <Card title="By subject" pad={false}>
          <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Subject</th><th>Attended</th><th style={{ width: '40%' }}>%</th></tr></thead>
            <tbody>
              {subjects.map((s) => {
                const r = summarize(sessions.filter((a) => a.subjectId === s.id), me.id)
                return <tr key={s.id}><td><strong>{s.name}</strong><div className="muted tiny mono">{s.code}</div></td><td>{r.present + r.late}/{r.total}</td><td>{r.total ? <div className="row gap-s"><Progress value={r.pct} /><span className="tiny">{r.pct}%</span></div> : <span className="muted">—</span>}</td></tr>
              })}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
      <Card title="Recent periods" pad={false}>
        {recent.length === 0 ? <Empty title="No attendance recorded yet" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Period</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {recent.map((a) => {
                  const m = a.marks[me.id]
                  return <tr key={a.id}><td>{formatDate(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td>P{a.period}</td><td>{db.subjects.find((s) => s.id === a.subjectId)?.name}</td><td>{m === 'P' ? <Badge tone="green">Present</Badge> : m === 'L' ? <Badge tone="amber">Late</Badge> : <Badge tone="red">Absent</Badge>}</td></tr>
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
