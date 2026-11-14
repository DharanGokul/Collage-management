import { useMemo, useState, type CSSProperties } from 'react'
import { CalendarClock, MapPin, Users, Pencil, Trash2, Download, Check, X, Clock } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Field, Modal, Progress } from '../../components/ui'
import { KIND_CODE, KIND_LABEL, canRegister, eventRange, fmtTime, myRegistration, registeredCount, type AgendaKind } from '../../lib/agenda'
import { classLabel, downloadCSV, formatDate, studentClassKey, toISODate, uid } from '../../lib/utils'
import type { CampusEvent, Database, EventKind, Session } from '../../types'

export const kindStyle = (k: AgendaKind) => ({ ['--kind' as string]: `var(--k-${k})` }) as CSSProperties

export function KindBadge({ kind }: { kind: AgendaKind }) {
  return (
    <span className="badge badge-gray" style={kindStyle(kind)}>
      <span className="kind-dot" /> {KIND_LABEL[kind]}
    </span>
  )
}

export function KindTile({ kind }: { kind: AgendaKind }) {
  return (
    <span className="kind-tile" style={kindStyle(kind)} aria-hidden>
      {KIND_CODE[kind]}
    </span>
  )
}

export function whenText(e: CampusEvent) {
  const { start, end } = eventRange(e)
  const sameDay = toISODate(start) === toISODate(end)
  if (e.allDay) return sameDay ? formatDate(e.start.slice(0, 10), { weekday: 'short', day: 'numeric', month: 'short' }) : `${formatDate(e.start.slice(0, 10), { day: 'numeric', month: 'short' })} – ${formatDate(e.end.slice(0, 10), { day: 'numeric', month: 'short' })}`
  return `${start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(start)}–${sameDay ? fmtTime(end) : `${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${fmtTime(end)}`}`
}

/* ---------------- registration ops ---------------- */

export function useRegistration() {
  const { db, session, update, toast } = useStore()
  const register = (e: CampusEvent) => {
    if (!session || session.role === 'admin') return
    const live = db.events.find((x) => x.id === e.id) ?? e
    const check = canRegister(db, session, live)
    if (!check.ok) return toast(check.reason || 'Registration is not open', 'error')
    if (live.registrations.some((r) => r.userId === session.userId)) return
    // Decide from the current snapshot (state updaters may run later than this handler).
    const status: 'registered' | 'waitlisted' = live.registration.capacity && registeredCount(live) >= live.registration.capacity ? 'waitlisted' : 'registered'
    update((d) => {
      const ev = d.events.find((x) => x.id === e.id)
      if (!ev || ev.registrations.some((r) => r.userId === session.userId)) return
      ev.registrations.push({ userId: session.userId, role: session.role as 'student' | 'staff', name: session.name, at: new Date().toISOString(), status })
    })
    toast(status === 'waitlisted' ? `Event is full — you're on the waitlist for ${e.title}` : `You're registered for ${e.title}`)
  }
  const cancel = (e: CampusEvent) => {
    if (!session) return
    const live = db.events.find((x) => x.id === e.id) ?? e
    const mine = live.registrations.find((r) => r.userId === session.userId)
    const promote = mine?.status === 'registered' ? live.registrations.find((r) => r.status === 'waitlisted' && r.userId !== session.userId) : undefined
    update((d) => {
      const ev = d.events.find((x) => x.id === e.id)
      if (!ev) return
      ev.registrations = ev.registrations.filter((r) => r.userId !== session.userId)
      // A freed seat goes to the first person on the waitlist.
      if (promote) {
        const next = ev.registrations.find((r) => r.userId === promote.userId)
        if (next) next.status = 'registered'
      }
    })
    toast(`Registration cancelled${promote ? ` · ${promote.name} moved off the waitlist` : ''}`)
  }
  return { register, cancel }
}

/* ---------------- detail ---------------- */

export function EventDetail({ event, onClose, onEdit }: { event: CampusEvent; onClose: () => void; onEdit?: (e: CampusEvent) => void }) {
  const { db, session, update, toast } = useStore()
  const live = db.events.find((x) => x.id === event.id) ?? event
  const { register, cancel } = useRegistration()
  const mine = session ? myRegistration(live, session) : undefined
  const check = session ? canRegister(db, session, live) : { ok: false, reason: '' }
  const count = registeredCount(live)
  const waiting = live.registrations.length - count
  const cap = live.registration.capacity
  const sub = live.subjectId ? db.subjects.find((s) => s.id === live.subjectId) : undefined
  const isAdmin = session?.role === 'admin'
  const [tab, setTab] = useState<'about' | 'people'>('about')

  return (
    <Modal
      open
      wide
      title={KIND_LABEL[live.kind]}
      onClose={onClose}
      footer={
        <>
          {isAdmin && (
            <>
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  if (!confirm(`Delete “${live.title}”?${live.registrations.length ? ` ${live.registrations.length} registration(s) will be lost.` : ''}`)) return
                  update((d) => {
                    d.events = d.events.filter((x) => x.id !== live.id)
                  })
                  toast('Event deleted')
                  onClose()
                }}
              >
                Delete
              </Button>
              <span className="spacer" />
              <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => onEdit?.(live)}>Edit</Button>
            </>
          )}
          {!isAdmin && live.registration.enabled && (
            mine ? (
              <Button variant="secondary" icon={<X size={16} />} onClick={() => cancel(live)}>Cancel registration</Button>
            ) : (
              <Button icon={<Check size={16} />} disabled={!check.ok} onClick={() => register(live)}>
                {check.ok ? (cap && count >= cap ? 'Join waitlist' : 'Apply / Register') : check.reason || 'Registration closed'}
              </Button>
            )
          )}
          {!isAdmin && <Button variant="ghost" onClick={onClose}>Close</Button>}
        </>
      }
    >
      <div className="ev-hero" style={kindStyle(live.kind)}>
        <div className="row gap-s">
          <span className="wcode">{KIND_CODE[live.kind]}</span>
          <span className="spec" style={{ color: 'rgb(255 255 255 / 0.7)' }}>{KIND_LABEL[live.kind]}{sub ? ` · ${sub.code}` : ''}</span>
          {mine && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>{mine.status === 'registered' ? 'You’re registered' : 'On waitlist'}</span>}
        </div>
        <h2>{live.title}</h2>
      </div>
      {isAdmin && live.registration.enabled && (
        <div className="tabs">
          <button className={`tab ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>Details</button>
          <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>Registrations ({live.registrations.length})</button>
        </div>
      )}
      {tab === 'about' ? (
        <>
          <div className="ev-facts">
            <CalendarClock size={18} /><span>{whenText(live)}</span>
            {live.location && (<><MapPin size={18} /><span>{live.location}</span></>)}
            <Users size={18} />
            <span>
              {live.audience === 'all' ? 'Everyone' : live.audience === 'staff' ? 'Staff only' : 'Students'}
              {live.classKeys.length > 0 && ` · ${live.classKeys.map(classLabel).join(', ')}`}
            </span>
            {live.registration.deadline && live.registration.enabled && (<><Clock size={18} /><span>Register by {formatDate(live.registration.deadline)}</span></>)}
          </div>
          {live.description && <p style={{ whiteSpace: 'pre-wrap' }}>{live.description}</p>}
          {live.registration.enabled && (
            <div className="stack-s">
              <div className="row gap-s tiny">
                <strong>{count}</strong>
                <span className="muted">registered{cap ? ` of ${cap} seats` : ''}{waiting > 0 ? ` · ${waiting} waitlisted` : ''}</span>
              </div>
              {cap ? <Progress value={Math.round((count / cap) * 100)} tone={count >= cap ? 'red' : count / cap > 0.8 ? 'amber' : 'green'} /> : null}
            </div>
          )}
        </>
      ) : (
        <div className="stack-s">
          <div className="row">
            <span className="muted tiny">{count} registered · {waiting} waitlisted</span>
            <span className="spacer" />
            <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCSV(`${live.title.replace(/\W+/g, '-').toLowerCase()}-registrations.csv`, [['Name', 'Role', 'Status', 'Registered at'], ...live.registrations.map((r) => [r.name, r.role, r.status, r.at])])}>CSV</Button>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways)">
            <table className="table">
              <tbody>
                {live.registrations.map((r) => (
                  <tr key={r.userId}>
                    <td><strong>{r.name}</strong><div className="muted tiny">{r.role === 'student' ? db.students.find((s) => s.id === r.userId)?.rollNo : 'Staff'}</div></td>
                    <td className="tiny muted">{formatDate(r.at)}</td>
                    <td className="right"><Badge tone={r.status === 'registered' ? 'green' : 'amber'}>{r.status}</Badge></td>
                  </tr>
                ))}
                {live.registrations.length === 0 && <tr><td className="muted center">No registrations yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ---------------- create / edit (admin) ---------------- */

const KINDS: EventKind[] = ['event', 'fest', 'workshop', 'meeting', 'holiday', 'exam']

export function blankEvent(kind: EventKind = 'event', date = toISODate(new Date())): CampusEvent {
  return {
    id: '',
    title: '',
    kind,
    description: '',
    start: kind === 'holiday' ? date : `${date}T10:00`,
    end: kind === 'holiday' ? date : `${date}T${kind === 'exam' ? '13:00' : '11:00'}`,
    allDay: kind === 'holiday',
    location: '',
    audience: kind === 'exam' ? 'students' : 'all',
    classKeys: [],
    registration: { enabled: false, capacity: null, deadline: null },
    registrations: [],
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
  }
}

function audienceEmails(db: Database, e: CampusEvent) {
  const students = e.audience === 'staff' ? [] : db.students.filter((s) => s.status === 'active' && (e.classKeys.length === 0 || e.classKeys.includes(studentClassKey(s))))
  const staff = e.audience === 'students' ? [] : db.staff.filter((s) => s.status === 'active')
  return [...students.map((s) => ({ email: s.email, name: s.name })), ...staff.map((s) => ({ email: s.email, name: s.name }))]
}

export function EventForm({ initial, onClose, onSaved }: { initial: CampusEvent; onClose: () => void; onSaved?: (e: CampusEvent) => void }) {
  const { db, update, toast, sendBulkEmail, session } = useStore()
  const [e, setE] = useState<CampusEvent>(initial)
  const [notify, setNotify] = useState(!initial.id)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof CampusEvent>(k: K, v: CampusEvent[K]) => setE((p) => ({ ...p, [k]: v }))
  const isExam = e.kind === 'exam'
  const classes = useMemo(() => [...new Set(db.students.map(studentClassKey))].sort(), [db.students])

  const sDate = e.start.slice(0, 10)
  const eDate = e.end.slice(0, 10)
  const sTime = e.start.slice(11, 16) || '10:00'
  const eTime = e.end.slice(11, 16) || '11:00'
  const setDates = (sd: string, st: string, ed: string, et: string, allDay = e.allDay) =>
    setE((p) => ({ ...p, allDay, start: allDay ? sd : `${sd}T${st}`, end: allDay ? ed : `${ed}T${et}` }))

  const examSubject = e.subjectId ? db.subjects.find((s) => s.id === e.subjectId) : undefined
  const pickExamSubject = (id: string) => {
    const sub = db.subjects.find((s) => s.id === id)
    if (!sub) return
    const keys = db.sections.map((sec) => `${sub.department}|${sub.year}|${sec}`).filter((k) => classes.includes(k))
    setE((p) => ({ ...p, subjectId: id, title: p.title && !p.title.startsWith('Exam:') && !p.title.startsWith('Mid-sem:') ? p.title : `Exam: ${sub.name}`, classKeys: keys, audience: 'students' }))
  }

  const range = eventRange(e)
  const errors = {
    title: e.title.trim().length < 3 ? 'Give the event a title' : null,
    when: !sDate || !eDate ? 'Pick dates' : range.end <= range.start ? 'End must be after start' : null,
    subject: isExam && !e.subjectId ? 'Choose the subject being examined' : null,
    capacity: e.registration.enabled && e.registration.capacity !== null && e.registration.capacity < 1 ? 'Capacity must be at least 1' : null,
    deadline: e.registration.enabled && e.registration.deadline && e.registration.deadline > sDate ? 'Deadline must be on or before the start date' : null,
  }
  const hasErr = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null)

  // Exams clash check: same class, overlapping time.
  const clash = isExam
    ? db.events.find((x) => x.id !== e.id && x.kind === 'exam' && x.classKeys.some((k) => e.classKeys.includes(k)) && eventRange(x).start < range.end && eventRange(x).end > range.start)
    : undefined

  const save = async () => {
    setTouched(true)
    if (hasErr) return
    setSaving(true)
    const isNew = !e.id
    const saved: CampusEvent = { ...e, id: e.id || uid(isExam ? 'exam' : 'evt'), title: e.title.trim(), createdBy: e.createdBy || session?.userId || 'admin' }
    if (!saved.registration.enabled) saved.registration = { enabled: false, capacity: null, deadline: null }
    update((d) => {
      if (isNew) d.events.push(saved)
      else d.events = d.events.map((x) => (x.id === saved.id ? { ...saved, registrations: x.registrations } : x))
    })
    if (notify) {
      const to = audienceEmails(db, saved)
      const r = await sendBulkEmail({
        recipients: to.map((p) => ({ email: p.email, vars: { name: p.name } })),
        subject: `${isNew ? 'New' : 'Updated'} ${KIND_LABEL[saved.kind].toLowerCase()}: ${saved.title}`,
        body: `Dear {{name}},\n\n${saved.title}\nWhen: ${whenText(saved)}${saved.location ? `\nWhere: ${saved.location}` : ''}\n\n${saved.description}${saved.registration.enabled ? `\n\nApply from the Events page of your portal: {{portal_url}}` : ''}\n\nRegards,\n{{college_name}}`,
      })
      toast(`${isExam ? 'Exam' : 'Event'} ${isNew ? 'created' : 'updated'} · ${r.sent} notified${r.failed ? `, ${r.failed} failed` : ''}`, r.failed ? 'info' : 'success')
    } else toast(`${isExam ? 'Exam' : 'Event'} ${isNew ? 'created' : 'updated'}`)
    setSaving(false)
    onSaved?.(saved)
    onClose()
  }

  return (
    <Modal
      open
      wide
      title={initial.id ? `Edit ${KIND_LABEL[e.kind].toLowerCase()}` : isExam ? 'Schedule exam' : 'New event'}
      onClose={onClose}
      footer={
        <>
          <label className="checkbox" style={{ marginRight: 'auto' }}>
            <input type="checkbox" checked={notify} onChange={(x) => setNotify(x.target.checked)} /> Email the audience
          </label>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={save}>{initial.id ? 'Save changes' : isExam ? 'Schedule exam' : 'Create event'}</Button>
        </>
      }
    >
      <div className="field">
        <label>Type</label>
        <div className="chips" role="radiogroup" aria-label="Event type">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={e.kind === k}
              className={`chip ${e.kind === k ? 'active' : ''}`}
              onClick={() => setE((p) => ({ ...p, kind: k, allDay: k === 'holiday' ? true : k === 'exam' ? false : p.allDay, start: k === 'holiday' ? p.start.slice(0, 10) : p.start.length === 10 ? `${p.start}T10:00` : p.start, end: k === 'holiday' ? p.end.slice(0, 10) : p.end.length === 10 ? `${p.end}T11:00` : p.end, audience: k === 'exam' ? 'students' : p.audience }))}
            >
              <span className="kind-dot" style={kindStyle(k)} /> {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid">
        {isExam && (
          <Field label="Subject" span={2} error={err('subject')}>
            {(id) => (
              <select id={id} className="input" value={e.subjectId ?? ''} onChange={(x) => pickExamSubject(x.target.value)}>
                <option value="">Select subject…</option>
                {db.departments.map((d) => (
                  <optgroup key={d.code} label={d.name}>
                    {db.subjects.filter((s) => s.department === d.code).sort((a, b) => a.year - b.year).map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name} (Year {s.year})</option>)}
                  </optgroup>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label="Title" span={2} error={err('title')}>{(id) => <input id={id} className="input" value={e.title} onChange={(x) => set('title', x.target.value)} placeholder={isExam ? 'Exam: Data Structures' : 'Tech fest, guest lecture…'} autoFocus={!isExam} />}</Field>

        {!isExam && e.kind !== 'holiday' && (
          <label className="checkbox span-2"><input type="checkbox" checked={e.allDay} onChange={(x) => setDates(sDate, sTime, eDate, eTime, x.target.checked)} /> All-day / multi-day</label>
        )}
        <Field label={e.allDay ? 'Start date' : 'Date'} error={err('when')}>{(id) => <input id={id} type="date" className="input" value={sDate} onChange={(x) => x.target.value && setDates(x.target.value, sTime, e.allDay ? (eDate < x.target.value ? x.target.value : eDate) : x.target.value, eTime)} />}</Field>
        {e.allDay ? (
          <Field label="End date">{(id) => <input id={id} type="date" className="input" value={eDate} min={sDate} onChange={(x) => x.target.value && setDates(sDate, sTime, x.target.value, eTime)} />}</Field>
        ) : (
          <div className="form-grid inner">
            <Field label="Starts">{(id) => <input id={id} type="time" className="input" value={sTime} onChange={(x) => setDates(sDate, x.target.value, eDate, eTime)} />}</Field>
            <Field label="Ends">{(id) => <input id={id} type="time" className="input" value={eTime} onChange={(x) => setDates(sDate, sTime, eDate, x.target.value)} />}</Field>
          </div>
        )}
        <Field label={isExam ? 'Exam hall' : 'Location'}>{(id) => <input id={id} className="input" value={e.location} onChange={(x) => set('location', x.target.value)} />}</Field>
        <Field label="Audience">
          {(id) => (
            <select id={id} className="input" value={e.audience} disabled={isExam} onChange={(x) => set('audience', x.target.value as CampusEvent['audience'])}>
              <option value="all">Everyone</option>
              <option value="students">Students</option>
              <option value="staff">Staff only</option>
            </select>
          )}
        </Field>
        {e.audience !== 'staff' && (
          <div className="field span-2">
            <label>Classes {e.classKeys.length === 0 && <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>· all classes</span>}</label>
            <div className="chips">
              {classes.map((k) => {
                const on = e.classKeys.includes(k)
                return (
                  <button key={k} type="button" className={`chip sm ${on ? 'active' : ''}`} aria-pressed={on} onClick={() => set('classKeys', on ? e.classKeys.filter((x) => x !== k) : [...e.classKeys, k])}>
                    {classLabel(k)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <Field label="Description" span={2}>{(id) => <textarea id={id} className="input" rows={3} value={e.description} onChange={(x) => set('description', x.target.value)} />}</Field>
      </div>
      {clash && <div className="alert alert-warn">Clash: {clash.title} ({whenText(clash)}) is already scheduled for {clash.classKeys.map(classLabel).join(', ')}.</div>}
      {examSubject && <p className="muted tiny">Shows on the calendar of {e.classKeys.map(classLabel).join(', ') || 'no class'} and of {db.staff.find((s) => s.id === examSubject.staffId)?.name ?? 'the subject teacher'}.</p>}

      {!isExam && e.kind !== 'holiday' && (
        <div className="card" style={{ padding: 16 }}>
          <label className="checkbox"><input type="checkbox" checked={e.registration.enabled} onChange={(x) => set('registration', { ...e.registration, enabled: x.target.checked })} /> <strong>Allow students / staff to apply</strong></label>
          {e.registration.enabled && (
            <div className="form-grid mt">
              <Field label="Seats" hint="Leave empty for unlimited; extra applicants are waitlisted" error={err('capacity')}>{(id) => <input id={id} type="number" min={1} className="input" value={e.registration.capacity ?? ''} onChange={(x) => set('registration', { ...e.registration, capacity: x.target.value ? +x.target.value : null })} />}</Field>
              <Field label="Apply by" error={err('deadline')}>{(id) => <input id={id} type="date" className="input" value={e.registration.deadline ?? ''} max={sDate} onChange={(x) => set('registration', { ...e.registration, deadline: x.target.value || null })} />}</Field>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

export type { Session }
