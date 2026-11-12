import { useMemo, useState } from 'react'
import { Clock, Plus, Trash2, Printer } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Field, Modal, PageHeader } from '../../components/ui'
import TimetableGrid from '../shared/TimetableGrid'
import { DAYS, classKey, classLabel } from '../../lib/utils'
import type { Period, TimetableSlot } from '../../types'

export default function AdminTimetable() {
  const { db, update, toast } = useStore()
  const classes = useMemo(() => {
    const keys = new Set<string>()
    for (const s of db.subjects) for (const sec of db.sections) keys.add(classKey(s.department, s.year, sec))
    return [...keys].sort()
  }, [db.subjects, db.sections])
  const [cls, setCls] = useState(classes[0] ?? '')
  const [edit, setEdit] = useState<{ day: number; period: number; slot?: TimetableSlot } | null>(null)
  const [periodsOpen, setPeriodsOpen] = useState(false)

  const slots = db.timetable.filter((t) => t.classKey === cls)

  const staffClash = (slot: TimetableSlot) => {
    const sub = db.subjects.find((s) => s.id === slot.subjectId)
    if (!sub?.staffId) return undefined
    const other = db.timetable.find((t) => t.id !== slot.id && t.day === slot.day && t.period === slot.period && db.subjects.find((s) => s.id === t.subjectId)?.staffId === sub.staffId)
    return other ? `Faculty also in ${classLabel(other.classKey)}` : undefined
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        subtitle="Click any cell to assign a subject and room"
        actions={
          <>
            <Button variant="secondary" icon={<Clock size={16} />} onClick={() => setPeriodsOpen(true)}>Period timings</Button>
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>
          </>
        }
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="chips">
            {classes.map((k) => (
              <button key={k} className={`chip ${k === cls ? 'active' : ''}`} onClick={() => setCls(k)}>{classLabel(k)}</button>
            ))}
          </div>
        </div>
        <div className="print-area">
          <h3 className="print-only">{db.branding.collegeName} — {classLabel(cls)}</h3>
          <TimetableGrid
            slots={slots}
            onCellClick={(day, period, slot) => setEdit({ day, period, slot })}
            cell={(slot) => {
              const sub = db.subjects.find((s) => s.id === slot.subjectId)
              const st = db.staff.find((s) => s.id === sub?.staffId)
              return { title: sub?.name ?? 'Unknown subject', lines: [st?.name ?? 'No faculty', slot.room].filter(Boolean), warn: staffClash(slot) }
            }}
          />
        </div>
      </Card>
      {edit && (
        <SlotEditor
          cls={cls}
          {...edit}
          onClose={() => setEdit(null)}
          onSave={(subjectId, room) => {
            update((d) => {
              d.timetable = d.timetable.filter((t) => !(t.classKey === cls && t.day === edit.day && t.period === edit.period))
              if (subjectId) d.timetable.push({ id: `tt-${cls}-${edit.day}-${edit.period}`, classKey: cls, day: edit.day, period: edit.period, subjectId, room })
            })
            toast(subjectId ? 'Slot saved' : 'Slot cleared')
            setEdit(null)
          }}
        />
      )}
      {periodsOpen && <PeriodEditor onClose={() => setPeriodsOpen(false)} />}
    </>
  )
}

function SlotEditor({ cls, day, period, slot, onClose, onSave }: { cls: string; day: number; period: number; slot?: TimetableSlot; onClose: () => void; onSave: (subjectId: string | null, room: string) => void }) {
  const { db } = useStore()
  const [d, y] = cls.split('|')
  const subs = db.subjects.filter((s) => s.department === d && s.year === +y)
  const [subjectId, setSubjectId] = useState(slot?.subjectId ?? subs[0]?.id ?? '')
  const [room, setRoom] = useState(slot?.room ?? '')
  const sub = db.subjects.find((s) => s.id === subjectId)
  const clash = sub?.staffId ? db.timetable.find((t) => t.classKey !== cls && t.day === day && t.period === period && db.subjects.find((s) => s.id === t.subjectId)?.staffId === sub.staffId) : undefined
  const roomClash = room.trim() ? db.timetable.find((t) => t.classKey !== cls && t.day === day && t.period === period && t.room.toLowerCase() === room.trim().toLowerCase()) : undefined
  return (
    <Modal
      open
      title={`${DAYS[day]} · Period ${period}`}
      onClose={onClose}
      footer={
        <>
          {slot && <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => onSave(null, '')}>Clear</Button>}
          <span className="spacer" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!subjectId} onClick={() => onSave(subjectId, room.trim())}>Save</Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Subject">{(id) => <select id={id} className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subs.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name}</option>)}</select>}</Field>
        <Field label="Room">{(id) => <input id={id} className="input" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. CSE-101" />}</Field>
        {sub && <p className="muted tiny">Faculty: {db.staff.find((s) => s.id === sub.staffId)?.name ?? 'Unassigned'}</p>}
        {clash && <div className="alert alert-warn">This faculty member already teaches {classLabel(clash.classKey)} in this period.</div>}
        {roomClash && <div className="alert alert-warn">Room {roomClash.room} is already booked by {classLabel(roomClash.classKey)}.</div>}
      </div>
    </Modal>
  )
}

function PeriodEditor({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [rows, setRows] = useState<Period[]>(() => [...db.periods].sort((a, b) => a.no - b.no))
  const invalid = rows.some((r, i) => !r.start || !r.end || r.start >= r.end || (i > 0 && r.start < rows[i - 1].end))
  return (
    <Modal
      open
      title="Period timings"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            disabled={invalid || !rows.length}
            onClick={() => {
              const nos = new Set(rows.map((r) => r.no))
              update((d) => {
                d.periods = rows
                d.timetable = d.timetable.filter((t) => nos.has(t.period))
              })
              toast('Period timings saved')
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="stack">
        {rows.map((r, i) => (
          <div key={r.no} className="row gap-s">
            <strong style={{ width: 32 }}>P{r.no}</strong>
            <input type="time" className="input sm" value={r.start} aria-label={`Period ${r.no} start`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
            <span>–</span>
            <input type="time" className="input sm" value={r.end} aria-label={`Period ${r.no} end`} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
            {i === rows.length - 1 && rows.length > 1 && <button className="icon-btn danger" aria-label="Remove period" onClick={() => setRows(rows.slice(0, -1))}><Trash2 size={16} /></button>}
          </div>
        ))}
        <Button
          variant="ghost"
          icon={<Plus size={16} />}
          disabled={rows.length >= 10}
          onClick={() => {
            const last = rows[rows.length - 1]
            setRows([...rows, { no: (last?.no ?? 0) + 1, start: last?.end ?? '09:00', end: last?.end ?? '09:50' }])
          }}
        >
          Add period
        </Button>
        {invalid && <div className="alert alert-error">Each period must end after it starts and must not overlap the previous one.</div>}
        <p className="muted tiny">Removing a period also removes its timetable slots.</p>
      </div>
    </Modal>
  )
}
