import { Printer } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Empty, PageHeader } from '../../components/ui'
import TimetableGrid from '../shared/TimetableGrid'
import { DAYS, classLabel, studentClassKey, weekdayIndex } from '../../lib/utils'
import { useNow } from '../../lib/useNow'

export default function StudentTimetable() {
  const { db, session } = useStore()
  const nowMs = useNow()
  const me = db.students.find((s) => s.id === session?.userId)
  if (!me) return <Empty title="Student record not found" />
  const key = studentClassKey(me)
  // Phones: a week grid needs sideways scrolling, so lead with a plain list for today (or the next teaching day).
  const todayIdx = weekdayIndex(new Date(nowMs))
  const teaching = new Set(db.timetable.filter((t) => t.classKey === key).map((t) => t.day))
  let showIdx = todayIdx
  for (let i = 0; i < 7 && !teaching.has(showIdx); i++) showIdx = (showIdx + 1) % 7
  const dayRows = db.timetable.filter((t) => t.classKey === key && t.day === showIdx).sort((a, b) => a.period - b.period)
  return (
    <>
      <PageHeader title="Class timetable" subtitle={classLabel(key)} actions={<Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>} />
      {dayRows.length > 0 && (
        <Card title={showIdx === todayIdx ? `Today · ${DAYS[showIdx]}` : `Next teaching day · ${DAYS[showIdx]}`} className="no-print">
          <ul className="feed" aria-label={`${DAYS[showIdx]} classes`}>
            {dayRows.map((t) => {
              const sub = db.subjects.find((x) => x.id === t.subjectId)
              const p = db.periods.find((x) => x.no === t.period)
              return (
                <li key={t.id ?? `${t.day}-${t.period}`}>
                  <strong>P{t.period} · {sub?.name}</strong>
                  <small className="muted">{p ? `${p.start}–${p.end} · ` : ''}{db.staff.find((x) => x.id === sub?.staffId)?.name ?? 'TBA'} · {t.room}</small>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <Card pad={false}>
        <div className="print-area">
          <h3 className="print-only">{db.branding.collegeName} — {classLabel(key)}</h3>
          <TimetableGrid
            slots={db.timetable.filter((t) => t.classKey === key)}
            cell={(s) => {
              const sub = db.subjects.find((x) => x.id === s.subjectId)
              return { title: sub?.name ?? '', lines: [db.staff.find((x) => x.id === sub?.staffId)?.name ?? 'TBA', s.room] }
            }}
          />
        </div>
      </Card>
    </>
  )
}
