import { useMemo, useState } from 'react'
import { Send, Download, ClipboardCheck, BarChart3, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, PageHeader, Progress, Tabs } from '../../components/ui'
import AttendanceMarker from '../shared/AttendanceMarker'
import { classKey, classLabel, downloadCSV, studentClassKey, summarize, toISODate } from '../../lib/utils'
import { useNow } from '../../lib/useNow'

type Tab = 'report' | 'low' | 'mark'

export default function AdminAttendance() {
  const [tab, setTab] = useState<Tab>('report')
  const { db, session } = useStore()
  return (
    <>
      <PageHeader title="Attendance" subtitle="Period-wise attendance across all classes" />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'report', label: 'Class report', icon: <BarChart3 size={16} /> }, { id: 'low', label: 'Below 75%', icon: <AlertTriangle size={16} /> }, { id: 'mark', label: 'Mark attendance', icon: <ClipboardCheck size={16} /> }]} />
      {tab === 'report' && <Report />}
      {tab === 'low' && <LowAttendance />}
      {tab === 'mark' && <AttendanceMarker subjects={db.subjects} markedBy={session?.userId ?? 'admin'} />}
    </>
  )
}

function useRange() {
  const today = new Date(useNow())
  const from = new Date(today)
  from.setDate(today.getDate() - 30)
  const [range, setRange] = useState({ from: toISODate(from), to: toISODate(today) })
  return [range, setRange] as const
}

function Report() {
  const { db } = useStore()
  const classes = useMemo(() => [...new Set(db.students.map(studentClassKey))].sort(), [db.students])
  const [cls, setCls] = useState(classes[0] ?? '')
  const [range, setRange] = useRange()

  const sessions = useMemo(() => db.attendance.filter((a) => a.classKey === cls && a.date >= range.from && a.date <= range.to), [db.attendance, cls, range])
  const students = db.students.filter((s) => studentClassKey(s) === cls).sort((a, b) => a.rollNo.localeCompare(b.rollNo))
  const subjects = db.subjects.filter((s) => cls === classKey(s.department, s.year, cls.split('|')[2]))

  const overview = classes.map((k) => {
    const ss = db.attendance.filter((a) => a.classKey === k && a.date >= range.from && a.date <= range.to)
    let t = 0, p = 0
    for (const a of ss) for (const m of Object.values(a.marks)) { t++; if (m !== 'A') p++ }
    return { k, sessions: ss.length, pct: t ? Math.round((p / t) * 1000) / 10 : 0 }
  })

  return (
    <>
      <div className="class-cards">
        {overview.map((o) => (
          <button key={o.k} className={`class-card card ${o.k === cls ? 'active' : ''}`} onClick={() => setCls(o.k)}>
            <span className="muted tiny">{classLabel(o.k)}</span>
            <strong>{o.sessions ? `${o.pct}%` : '—'}</strong>
            <Progress value={o.pct} />
            <small className="muted">{o.sessions} periods recorded</small>
          </button>
        ))}
      </div>
      <Card
        pad={false}
        title={classLabel(cls)}
        actions={
          <>
            <input type="date" className="input sm" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} aria-label="From" />
            <input type="date" className="input sm" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} aria-label="To" />
            <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCSV(`attendance-${cls.replace(/\|/g, '-')}.csv`, [['Roll No', 'Name', ...subjects.map((s) => s.code), 'Overall %'], ...students.map((s) => [s.rollNo, s.name, ...subjects.map((sub) => summarize(sessions.filter((a) => a.subjectId === sub.id), s.id).pct), summarize(sessions, s.id).pct])])}>CSV</Button>
          </>
        }
      >
        {sessions.length === 0 ? (
          <Empty title="No attendance in this period" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  {subjects.map((s) => <th key={s.id} title={s.name} className="center">{s.code}</th>)}
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const all = summarize(sessions, s.id)
                  return (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong><div className="muted tiny mono">{s.rollNo}</div></td>
                      {subjects.map((sub) => {
                        const r = summarize(sessions.filter((a) => a.subjectId === sub.id), s.id)
                        return <td key={sub.id} className={`center ${r.total && r.pct < 75 ? 'text-red' : ''}`}>{r.total ? `${Math.round(r.pct)}%` : '—'}</td>
                      })}
                      <td style={{ minWidth: 140 }}>
                        <div className="row gap-s"><Progress value={all.pct} /><strong className="tiny">{all.pct}%</strong></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

function LowAttendance() {
  const { db, sendBulkEmail, toast } = useStore()
  const [threshold, setThreshold] = useState(75)
  const [sending, setSending] = useState(false)
  const rows = useMemo(
    () =>
      db.students
        .filter((s) => s.status === 'active')
        .map((s) => ({ s, sum: summarize(db.attendance, s.id) }))
        .filter((r) => r.sum.total > 0 && r.sum.pct < threshold)
        .sort((a, b) => a.sum.pct - b.sum.pct),
    [db.students, db.attendance, threshold],
  )

  const alertAll = async () => {
    const tpl = db.templates.find((t) => t.id === 'tpl-low-attendance')
    if (!tpl) return toast('Low attendance template missing', 'error')
    setSending(true)
    const r = await sendBulkEmail({ subject: tpl.subject, body: tpl.body, recipients: rows.map(({ s, sum }) => ({ email: s.email, vars: { name: s.name, student_name: s.name, attendance_pct: `${sum.pct}%` } })) })
    setSending(false)
    if (r.failed) toast(`${r.sent} sent, ${r.failed} failed`, r.sent ? 'info' : 'error')
    else toast(`Alert sent to ${r.sent} student(s)`)
  }

  return (
    <Card
      pad={false}
      title={`${rows.length} students below ${threshold}%`}
      actions={
        <>
          <label className="row gap-s tiny">Threshold <input type="number" className="input sm" style={{ width: 70 }} min={1} max={100} value={threshold} onChange={(e) => setThreshold(Math.min(100, Math.max(1, +e.target.value || 75)))} />%</label>
          <Button size="sm" icon={<Send size={14} />} disabled={!rows.length} loading={sending} onClick={alertAll}>Email all</Button>
        </>
      }
    >
      {rows.length === 0 ? (
        <Empty title="Everyone is above the threshold 🎉" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Student</th><th>Class</th><th>Attended</th><th>Absent</th><th>Attendance</th></tr></thead>
            <tbody>
              {rows.map(({ s, sum }) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong><div className="muted tiny">{s.email}</div></td>
                  <td>{classLabel(studentClassKey(s))}</td>
                  <td>{sum.present + sum.late}/{sum.total}</td>
                  <td>{sum.absent}</td>
                  <td><Badge tone="red">{sum.pct}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
