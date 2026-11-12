import type { CampusEvent, Database, EventKind, Session } from '../types'
import { classKey, feeAppliesTo, studentClassKey, toISODate, weekdayIndex } from './utils'

export type AgendaKind = EventKind | 'fee' | 'class'

export interface AgendaItem {
  id: string
  kind: AgendaKind
  title: string
  start: Date
  end: Date
  allDay: boolean
  sub: string
  /** Set for items backed by a CampusEvent */
  eventId?: string
}

export const KIND_LABEL: Record<AgendaKind, string> = {
  event: 'Event',
  exam: 'Exam',
  holiday: 'Holiday',
  meeting: 'Meeting',
  fest: 'Fest',
  workshop: 'Workshop',
  fee: 'Fee due',
  class: 'Class',
}

/** Short code shown on dense chips (week strip, month cells). */
export const KIND_CODE: Record<AgendaKind, string> = { event: 'EV', exam: 'EX', holiday: 'HO', meeting: 'MT', fest: 'FS', workshop: 'WS', fee: 'FE', class: 'CL' }

export const parseLocal = (s: string) => (s.length === 10 ? new Date(s + 'T00:00:00') : new Date(s))

export function eventRange(e: CampusEvent) {
  const start = parseLocal(e.allDay ? e.start.slice(0, 10) : e.start)
  const end = e.allDay ? new Date(parseLocal(e.end.slice(0, 10)).getTime() + 86400000 - 1) : parseLocal(e.end)
  return { start, end }
}

/** Can this viewer see the event at all? */
export function canSee(db: Database, s: Session, e: CampusEvent) {
  if (s.role === 'admin') return true
  if (s.role === 'staff') {
    if (e.audience === 'students' && e.kind !== 'exam') return false
    if (e.kind === 'exam') {
      // Staff see exams for subjects they teach.
      const sub = db.subjects.find((x) => x.id === e.subjectId)
      return !!sub && sub.staffId === s.userId
    }
    return true
  }
  if (e.audience === 'staff') return false
  const me = db.students.find((x) => x.id === s.userId)
  if (!me) return false
  return e.classKeys.length === 0 || e.classKeys.includes(studentClassKey(me))
}

export function canRegister(db: Database, s: Session, e: CampusEvent) {
  if (s.role === 'admin' || !e.registration.enabled || !canSee(db, s, e)) return { ok: false as const, reason: '' }
  const { start } = eventRange(e)
  if (start.getTime() < Date.now()) return { ok: false as const, reason: 'Event has started' }
  if (e.registration.deadline && new Date(e.registration.deadline + 'T23:59:59') < new Date()) return { ok: false as const, reason: 'Registration closed' }
  return { ok: true as const, reason: '' }
}

export function myRegistration(e: CampusEvent, s: Session) {
  return e.registrations.find((r) => r.userId === s.userId)
}

export function registeredCount(e: CampusEvent) {
  return e.registrations.filter((r) => r.status === 'registered').length
}

export interface AgendaOptions {
  includeClasses?: boolean
  includeFees?: boolean
}

/** Every agenda item visible to `s` that overlaps [from, to). */
export function agenda(db: Database, s: Session, from: Date, to: Date, opts: AgendaOptions = {}): AgendaItem[] {
  const items: AgendaItem[] = []
  for (const e of db.events) {
    if (!canSee(db, s, e)) continue
    const { start, end } = eventRange(e)
    if (end < from || start >= to) continue
    items.push({ id: e.id, eventId: e.id, kind: e.kind, title: e.title, start, end, allDay: e.allDay, sub: e.location })
  }

  if (opts.includeFees !== false) {
    const me = s.role === 'student' ? db.students.find((x) => x.id === s.userId) : undefined
    for (const f of db.fees) {
      if (s.role === 'staff') break
      if (me && (!feeAppliesTo(f, me) || db.payments.some((p) => p.studentId === me.id && p.feeId === f.id && p.status === 'success'))) continue
      const start = parseLocal(f.dueDate)
      const end = new Date(start.getTime() + 86400000 - 1)
      if (end < from || start >= to) continue
      items.push({ id: `fee-${f.id}`, kind: 'fee', title: `${f.name} due`, start, end, allDay: true, sub: f.department === 'All' ? 'All students' : f.department })
    }
  }

  if (opts.includeClasses) {
    const slots =
      s.role === 'student'
        ? (() => {
            const me = db.students.find((x) => x.id === s.userId)
            return me ? db.timetable.filter((t) => t.classKey === studentClassKey(me)) : []
          })()
        : s.role === 'staff'
          ? db.timetable.filter((t) => db.subjects.find((x) => x.id === t.subjectId)?.staffId === s.userId)
          : []
    const holidays = items.filter((i) => i.kind === 'holiday')
    for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
      const day = weekdayIndex(d)
      const iso = toISODate(d)
      if (holidays.some((h) => toISODate(h.start) <= iso && toISODate(h.end) >= iso)) continue
      for (const slot of slots.filter((t) => t.day === day)) {
        const p = db.periods.find((x) => x.no === slot.period)
        const sub = db.subjects.find((x) => x.id === slot.subjectId)
        if (!p || !sub) continue
        items.push({ id: `cls-${slot.id}-${iso}`, kind: 'class', title: sub.name, start: new Date(`${iso}T${p.start}`), end: new Date(`${iso}T${p.end}`), allDay: false, sub: `${slot.room} · P${slot.period}` })
      }
    }
  }
  return items.sort((a, b) => a.start.getTime() - b.start.getTime() || Number(b.allDay) - Number(a.allDay))
}

export const startOfWeek = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - weekdayIndex(x))
  return x
}
export const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const sameDay = (a: Date, b: Date) => toISODate(a) === toISODate(b)
export const overlapsDay = (i: AgendaItem, day: Date) => {
  const s = new Date(day)
  s.setHours(0, 0, 0, 0)
  const e = addDays(s, 1)
  return i.start < e && i.end >= s
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** "2 d 4 h", "11 h 56 min", "5 min" */
export function countdown(to: Date, now = new Date()) {
  let ms = Math.max(0, to.getTime() - now.getTime())
  const d = Math.floor(ms / 86400000)
  ms -= d * 86400000
  const h = Math.floor(ms / 3600000)
  ms -= h * 3600000
  const m = Math.floor(ms / 60000)
  if (d > 0) return `${d} d ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

export { classKey }
