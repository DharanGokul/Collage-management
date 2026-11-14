import { useMemo, useState } from 'react'
import { CheckCheck, Save, Users, CalendarX } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { useToday } from '../../lib/useNow'
import { Avatar, Badge, Button, Card, Empty, Field } from '../../components/ui'
import { classKey, classLabel, weekdayIndex } from '../../lib/utils'
import type { AttendanceMark, Subject } from '../../types'

const MARKS: { id: AttendanceMark; label: string }[] = [
  { id: 'P', label: 'Present' },
  { id: 'L', label: 'Late' },
  { id: 'A', label: 'Absent' },
]

/**
 * Period-wise attendance marking. `subjects` restricts what the user may mark
 * (a faculty member sees only the subjects assigned to them).
 */
export default function AttendanceMarker({ subjects, markedBy }: { subjects: Subject[]; markedBy: string }) {
  const { db, update, toast } = useStore()
  const today = useToday()
  const [date, setDate] = useState(today)
  const day = weekdayIndex(new Date(date + 'T00:00:00'))
  const subjectIds = useMemo(() => new Set(subjects.map((s) => s.id)), [subjects])

  // Timetable slots for the chosen day that belong to the allowed subjects.
  const slots = useMemo(
    () => db.timetable.filter((t) => t.day === day && subjectIds.has(t.subjectId)).sort((a, b) => a.period - b.period),
    [db.timetable, day, subjectIds],
  )

  const [slotKey, setSlotKey] = useState('')
  // Manual selection (extra/rescheduled class not on the timetable)
  const [manual, setManual] = useState({ subjectId: subjects[0]?.id ?? '', section: db.sections[0] ?? 'A', period: 1 })

  // Keep the current choice when the slot list is merely rebuilt (e.g. after saving); otherwise fall back to the first slot.
  const validSlotKey = slotKey === 'manual' || slots.some((s) => s.id === slotKey) ? slotKey : (slots[0]?.id ?? 'manual')
  if (validSlotKey !== slotKey) setSlotKey(validSlotKey)

  const target = useMemo(() => {
    if (slotKey !== 'manual') {
      const s = slots.find((x) => x.id === slotKey)
      if (s) return { classKey: s.classKey, period: s.period, subjectId: s.subjectId }
    }
    const sub = subjects.find((x) => x.id === manual.subjectId)
    if (!sub) return null
    return { classKey: classKey(sub.department, sub.year, manual.section), period: manual.period, subjectId: sub.id }
  }, [slotKey, slots, manual, subjects])

  const roster = useMemo(() => {
    if (!target) return []
    const [d, y, s] = target.classKey.split('|')
    return db.students.filter((x) => x.status === 'active' && x.department === d && x.year === +y && x.section === s).sort((a, b) => a.rollNo.localeCompare(b.rollNo))
  }, [db.students, target])

  const existing = target ? db.attendance.find((a) => a.date === date && a.classKey === target.classKey && a.period === target.period) : undefined
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({})

  // Re-initialise the marks only when the target session changes.
  const marksKey = `${existing?.id}|${target?.classKey}|${target?.period}|${date}|${roster.length}`
  const [marksFor, setMarksFor] = useState<string | null>(null)
  if (marksFor !== marksKey) {
    const init: Record<string, AttendanceMark> = {}
    for (const st of roster) init[st.id] = existing?.marks[st.id] ?? 'P'
    setMarksFor(marksKey)
    setMarks(init)
  }

  const counts = Object.values(marks).reduce((acc, m) => ((acc[m] = (acc[m] ?? 0) + 1), acc), {} as Record<AttendanceMark, number>)
  const isFuture = date > today
  const conflict = existing && target && existing.subjectId !== target.subjectId ? db.subjects.find((s) => s.id === existing.subjectId) : undefined

  const save = () => {
    if (!target || isFuture) return
    update((d) => {
      const idx = d.attendance.findIndex((a) => a.date === date && a.classKey === target.classKey && a.period === target.period)
      const rec = { id: `att-${date}-${target.classKey}-${target.period}`, date, classKey: target.classKey, period: target.period, subjectId: target.subjectId, markedBy, marks }
      if (idx >= 0) d.attendance[idx] = rec
      else d.attendance.push(rec)
    })
    toast(`Attendance ${existing ? 'updated' : 'saved'} – ${counts.P ?? 0} present, ${counts.L ?? 0} late, ${counts.A ?? 0} absent`)
  }

  const subName = (id: string) => db.subjects.find((s) => s.id === id)?.name ?? 'Unknown'
  const period = db.periods.find((p) => p.no === target?.period)

  return (
    <div className="grid side">
      <Card title="Class & period">
        <div className="stack">
          <Field label="Date">{(id) => <input id={id} type="date" className="input" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />}</Field>
          {slots.length > 0 ? (
            <div className="slot-list" role="radiogroup" aria-label="Scheduled classes">
              {slots.map((s) => {
                const done = db.attendance.some((a) => a.date === date && a.classKey === s.classKey && a.period === s.period)
                return (
                  <button key={s.id} role="radio" aria-checked={slotKey === s.id} className={`slot ${slotKey === s.id ? 'active' : ''}`} onClick={() => setSlotKey(s.id)}>
                    <span className="slot-period">P{s.period}</span>
                    <span className="slot-main">
                      <strong>{subName(s.subjectId)}</strong>
                      <small>{classLabel(s.classKey)} · {s.room}</small>
                    </span>
                    {done && <Badge tone="green">Done</Badge>}
                  </button>
                )
              })}
              <button role="radio" aria-checked={slotKey === 'manual'} className={`slot ${slotKey === 'manual' ? 'active' : ''}`} onClick={() => setSlotKey('manual')}>
                <span className="slot-period">+</span>
                <span className="slot-main"><strong>Extra / substitute class</strong><small>Pick subject and period</small></span>
              </button>
            </div>
          ) : (
            <p className="muted tiny">No classes scheduled for you on this day. You can still record an extra class below.</p>
          )}
          {slotKey === 'manual' && (
            <>
              <Field label="Subject">{(id) => <select id={id} className="input" value={manual.subjectId} onChange={(e) => setManual({ ...manual, subjectId: e.target.value })}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name} (Y{s.year})</option>)}</select>}</Field>
              <div className="form-grid inner">
                <Field label="Section">{(id) => <select id={id} className="input" value={manual.section} onChange={(e) => setManual({ ...manual, section: e.target.value })}>{db.sections.map((s) => <option key={s}>{s}</option>)}</select>}</Field>
                <Field label="Period">{(id) => <select id={id} className="input" value={manual.period} onChange={(e) => setManual({ ...manual, period: +e.target.value })}>{db.periods.map((p) => <option key={p.no} value={p.no}>P{p.no} ({p.start})</option>)}</select>}</Field>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card
        title={target ? `${subName(target.subjectId)} · ${classLabel(target.classKey)}` : 'Roster'}
        actions={
          target && roster.length > 0 ? (
            <>
              <Button size="sm" variant="secondary" icon={<CheckCheck size={14} />} onClick={() => setMarks(Object.fromEntries(roster.map((s) => [s.id, 'P'])))}>All present</Button>
              <Button size="sm" variant={conflict ? 'danger' : 'primary'} icon={<Save size={14} />} disabled={isFuture} onClick={save}>{conflict ? 'Replace record' : existing ? 'Update' : 'Save'}</Button>
            </>
          ) : undefined
        }
        pad={false}
      >
        {!target ? (
          <Empty icon={<CalendarX />} title="No subjects assigned">Ask the administrator to assign subjects to you.</Empty>
        ) : roster.length === 0 ? (
          <Empty icon={<Users />} title="No students in this class" />
        ) : (
          <>
            <div className="roster-summary">
              <span>{period && `Period ${period.no} · ${period.start}–${period.end}`}</span>
              <span className="spacer" />
              <Badge tone="green">{counts.P ?? 0} present</Badge>
              <Badge tone="amber">{counts.L ?? 0} late</Badge>
              <Badge tone="red">{counts.A ?? 0} absent</Badge>
            </div>
            {conflict && <div className="alert alert-warn m">This period was already recorded for <strong>{conflict.name}</strong>. Saving will replace it.</div>}
            <ul className="roster">
              {roster.map((s) => (
                <li key={s.id}>
                  <Avatar name={s.name} size={32} />
                  <div className="roster-name">
                    <strong>{s.name}</strong>
                    <small className="mono muted">{s.rollNo}</small>
                  </div>
                  <div className="mark-group" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                    {MARKS.map((m) => (
                      <button key={m.id} role="radio" aria-checked={marks[s.id] === m.id} title={m.label} className={`mark mark-${m.id} ${marks[s.id] === m.id ? 'on' : ''}`} onClick={() => setMarks((p) => ({ ...p, [s.id]: m.id }))}>
                        {m.id}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="roster-summary" style={{ justifyContent: 'flex-end', borderTop: '1px solid var(--hairline)' }}>
              <span className="muted tiny" style={{ marginRight: 'auto' }}>{roster.length} students · {counts.A ?? 0} absent</span>
              <Button size="sm" variant={conflict ? 'danger' : 'primary'} icon={<Save size={14} />} disabled={isFuture} onClick={save}>{conflict ? `Replace ${conflict.name} record` : existing ? 'Update attendance' : 'Save attendance'}</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
