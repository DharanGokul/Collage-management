import type { Chat, ChatMember, Database, DeptRequest, LeaveRequest, Role, Session } from '../types'
import { studentClassKey } from './utils'

/* ---------------- HOD ---------------- */

export const hodOf = (db: Database, dept: string) => db.departments.find((d) => d.code === dept)?.hodId ?? null
export const isHod = (db: Database, staffId: string | undefined) => !!staffId && db.departments.some((d) => d.hodId === staffId)
export const hodDepartment = (db: Database, staffId: string | undefined) => db.departments.find((d) => d.hodId === staffId)

/* ---------------- Equipment & repair requests ---------------- */

export const REQUEST_STATUS: Record<DeptRequest['status'], { label: string; tone: 'amber' | 'blue' | 'green' | 'red' | 'gray' }> = {
  pending_hod: { label: 'Awaiting HOD', tone: 'amber' },
  pending_admin: { label: 'Awaiting management', tone: 'amber' },
  approved: { label: 'Approved', tone: 'blue' },
  in_progress: { label: 'In progress', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
}

/** New requests from an HOD skip their own approval and go to management. */
export function initialStatus(db: Database, requesterId: string, dept: string): DeptRequest['status'] {
  return hodOf(db, dept) === requesterId ? 'pending_admin' : 'pending_hod'
}

/** After the HOD approves: purchases and anything over the limit need management sign-off. */
export function afterHodApproval(db: Database, r: DeptRequest): DeptRequest['status'] {
  return r.kind === 'purchase' || r.estimatedCost > db.tax.procurementApprovalLimit ? 'pending_admin' : 'approved'
}

export function canDecide(db: Database, s: Session, r: DeptRequest) {
  if (r.status === 'pending_hod') return s.role === 'staff' ? hodOf(db, r.department) === s.userId : s.role === 'admin' && !hodOf(db, r.department) // vacant HOD post: management decides
  if (r.status === 'pending_admin') return s.role === 'admin'
  return false
}

export function nextRequestRef(db: Database) {
  return `PR-${Math.max(1000, ...db.requests.map((r) => +r.ref.replace(/\D/g, '') || 0)) + 1}`
}

/* ---------------- Leave ---------------- */

export const LEAVE_QUOTA: Record<LeaveRequest['type'], number | null> = { casual: 12, sick: 10, earned: 15, duty: null }

export function leaveDays(from: string, to: string) {
  // Working days (Mon–Sat) between the dates, inclusive.
  let n = 0
  for (let d = new Date(from + 'T00:00:00'); d <= new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++
  return n
}

export function leaveBalance(db: Database, staffId: string, type: LeaveRequest['type']) {
  const quota = LEAVE_QUOTA[type]
  const year = new Date().getFullYear()
  const used = db.leaves.filter((l) => l.staffId === staffId && l.type === type && l.status === 'approved' && l.from.startsWith(String(year))).reduce((a, l) => a + l.days, 0)
  return { quota, used, left: quota === null ? null : Math.max(0, quota - used) }
}

export function canDecideLeave(db: Database, s: Session, l: LeaveRequest) {
  if (l.status !== 'pending') return false
  if (l.approver === 'admin') return s.role === 'admin'
  const staff = db.staff.find((x) => x.id === l.staffId)
  if (s.role === 'admin') return !!staff && !hodOf(db, staff.department) // vacant HOD post: management decides
  return s.role === 'staff' && !!staff && hodOf(db, staff.department) === s.userId
}

/* ---------------- Chat ---------------- */

export const memberKey = (m: ChatMember) => `${m.role}:${m.userId}`
export const sessionMember = (s: Session): ChatMember => ({ role: s.role, userId: s.userId })
export const isMember = (c: Chat, s: Session) => c.members.some((m) => m.role === s.role && m.userId === s.userId)

export function displayName(db: Database, m: ChatMember) {
  if (m.role === 'admin') return 'Administrator'
  if (m.role === 'staff') return db.staff.find((x) => x.id === m.userId)?.name ?? 'Staff'
  if (m.role === 'accountant') return db.accountants.find((x) => x.id === m.userId)?.name ?? 'Accounts'
  return db.students.find((x) => x.id === m.userId)?.name ?? 'Student'
}

export function roleLabel(db: Database, m: ChatMember) {
  if (m.role === 'admin') return 'Management'
  if (m.role === 'accountant') return 'Accounts'
  if (m.role === 'staff') {
    const st = db.staff.find((x) => x.id === m.userId)
    return isHod(db, m.userId) ? `HOD · ${st?.department}` : `Faculty · ${st?.department ?? ''}`
  }
  const s = db.students.find((x) => x.id === m.userId)
  return s ? `Student · ${s.rollNo}` : 'Student'
}

export function chatTitle(db: Database, c: Chat, s: Session) {
  if (c.kind === 'group') return c.name
  const other = c.members.find((m) => !(m.role === s.role && m.userId === s.userId)) ?? c.members[0]
  return displayName(db, other)
}

export function unreadCount(c: Chat, s: Session) {
  const last = c.reads[`${s.role}:${s.userId}`] ?? ''
  return c.messages.filter((m) => m.at > last && !(m.from.role === s.role && m.from.userId === s.userId)).length
}

export function canPost(c: Chat, s: Session) {
  return isMember(c, s) && (!c.announceOnly || c.admins.includes(`${s.role}:${s.userId}`))
}

/**
 * Who can start a direct chat with whom (college policy):
 *  - students → their teachers, their HOD, management
 *  - staff/HOD → anyone in the college
 *  - accounts & management → staff and management; students via their own chats only
 */
export function directContacts(db: Database, s: Session): (ChatMember & { name: string; sub: string })[] {
  const out: (ChatMember & { name: string; sub: string })[] = []
  const add = (role: Role, userId: string) => {
    if (role === s.role && userId === s.userId) return
    const m = { role, userId }
    out.push({ ...m, name: displayName(db, m), sub: roleLabel(db, m) })
  }
  if (s.role === 'student') {
    const me = db.students.find((x) => x.id === s.userId)
    if (!me) return []
    const key = studentClassKey(me)
    const teachers = new Set(db.timetable.filter((t) => t.classKey === key).map((t) => db.subjects.find((x) => x.id === t.subjectId)?.staffId).filter(Boolean) as string[])
    const hod = hodOf(db, me.department)
    if (hod) teachers.add(hod)
    teachers.forEach((id) => add('staff', id))
    add('admin', 'admin')
    return out
  }
  add('admin', 'admin')
  db.staff.filter((x) => x.status === 'active').forEach((x) => add('staff', x.id))
  db.accountants.filter((x) => x.status === 'active').forEach((x) => add('accountant', x.id))
  if (s.role === 'staff') db.students.filter((x) => x.status === 'active').forEach((x) => add('student', x.id))
  return out
}

/** Profile photo (data URL) for anyone, or null for initials. */
export function photoOf(db: Database, m: ChatMember): string | null {
  if (m.role === 'admin') return db.adminProfile?.photo ?? null
  if (m.role === 'staff') return db.staff.find((x) => x.id === m.userId)?.photo ?? null
  if (m.role === 'accountant') return db.accountants.find((x) => x.id === m.userId)?.photo ?? null
  return db.students.find((x) => x.id === m.userId)?.photo ?? null
}
