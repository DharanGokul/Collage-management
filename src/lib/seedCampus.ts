import type { CampusEvent, Database, Ticket } from '../types'
import { classKey, toISODate } from './utils'

/** `YYYY-MM-DDTHH:mm` for today + `days` at `time`. */
function at(days: number, time = '00:00') {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${toISODate(d)}T${time}`
}
const dateOnly = (days: number) => at(days).slice(0, 10)

/** Next weekday on/after today + days (exams never land on weekends). */
function weekday(days: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  let n = days
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
    n++
  }
  return n
}

type Seedable = Pick<Database, 'students' | 'staff' | 'subjects' | 'departments' | 'sections'>

export function seedEvents(db: Seedable): CampusEvent[] {
  const base = (e: Partial<CampusEvent> & Pick<CampusEvent, 'id' | 'title' | 'kind' | 'start' | 'end'>): CampusEvent => ({
    description: '',
    allDay: false,
    location: '',
    audience: 'all',
    classKeys: [],
    registration: { enabled: false, capacity: null, deadline: null },
    registrations: [],
    createdBy: 'admin',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    ...e,
  })

  const events: CampusEvent[] = [
    base({
      id: 'evt-techfest',
      title: 'Northbridge Tech Fest',
      kind: 'fest',
      allDay: true,
      start: dateOnly(weekday(6)),
      end: dateOnly(weekday(6) + 2),
      location: 'Main auditorium & labs',
      audience: 'students',
      description: 'Three days of hackathons, robotics, paper presentations and the startup pitch. Teams of up to four.',
      registration: { enabled: true, capacity: 120, deadline: dateOnly(weekday(4)) },
    }),
    base({
      id: 'evt-ai-workshop',
      title: 'Hands-on: Building with AI APIs',
      kind: 'workshop',
      start: at(weekday(2), '14:00'),
      end: at(weekday(2), '16:30'),
      location: 'CSE Lab 2',
      audience: 'all',
      classKeys: [],
      description: 'A practical session on calling AI models from web apps. Bring a laptop.',
      registration: { enabled: true, capacity: 40, deadline: at(weekday(2), '10:00').slice(0, 10) },
    }),
    base({
      id: 'evt-faculty-meet',
      title: 'Faculty council meeting',
      kind: 'meeting',
      start: at(weekday(1), '15:30'),
      end: at(weekday(1), '16:30'),
      location: 'Seminar hall',
      audience: 'staff',
      description: 'Mid-semester review: syllabus progress, internal marks and the exam timetable.',
    }),
    base({
      id: 'evt-guest',
      title: 'Guest lecture: Careers in product management',
      kind: 'event',
      start: at(weekday(3), '11:00'),
      end: at(weekday(3), '12:30'),
      location: 'MBA block, Room 201',
      audience: 'students',
      classKeys: db.sections.flatMap((s) => [classKey('MBA', 1, s), classKey('MBA', 2, s)]),
      description: 'With an alumna who leads product at a fintech startup. Q&A to follow.',
      registration: { enabled: true, capacity: 60, deadline: null },
    }),
    base({
      id: 'evt-holiday',
      title: 'Founders’ Day — college closed',
      kind: 'holiday',
      allDay: true,
      start: dateOnly(weekday(9)),
      end: dateOnly(weekday(9)),
      audience: 'all',
      description: 'No classes. Library open 10 AM–2 PM.',
    }),
    base({
      id: 'evt-sports',
      title: 'Inter-department sports meet',
      kind: 'event',
      allDay: true,
      start: dateOnly(weekday(12)),
      end: dateOnly(weekday(13)),
      location: 'College grounds',
      audience: 'all',
      description: 'Athletics, cricket and basketball. Volunteers needed from every department.',
      registration: { enabled: true, capacity: null, deadline: dateOnly(weekday(10)) },
    }),
    base({
      id: 'evt-pta',
      title: 'Parent–teacher meeting',
      kind: 'meeting',
      start: at(weekday(5), '10:00'),
      end: at(weekday(5), '13:00'),
      location: 'Respective department blocks',
      audience: 'all',
      description: 'Guardians meet class advisors to discuss mid-semester performance.',
    }),
    base({
      id: 'evt-past-orientation',
      title: 'Library orientation',
      kind: 'event',
      start: at(-3, '10:00'),
      end: at(-3, '11:00'),
      location: 'Central library',
      audience: 'students',
      description: 'Digital resources, borrowing rules and the reading room.',
    }),
  ]

  // Mid-semester exams: one subject per class per day, starting next week.
  const examStart = weekday(7)
  const classes = [...new Set(db.students.map((s) => classKey(s.department, s.year, s.section)))]
  for (const key of classes) {
    const [d, y] = key.split('|')
    const subs = db.subjects.filter((s) => s.department === d && s.year === +y).slice(0, 3)
    subs.forEach((sub, i) => {
      const day = weekday(examStart + i)
      events.push(
        base({
          id: `exam-${key}-${sub.id}`,
          title: `Mid-sem: ${sub.name}`,
          kind: 'exam',
          start: at(day, i % 2 ? '14:00' : '10:00'),
          end: at(day, i % 2 ? '17:00' : '13:00'),
          location: `${d} exam hall ${y}`,
          audience: 'students',
          classKeys: [key],
          subjectId: sub.id,
          description: `${sub.code} · 3 hours · Closed book. Carry your ID card.`,
        }),
      )
    })
  }

  // Some students already registered for the fest / workshop.
  const fest = events[0]
  const ws = events[1]
  db.students.slice(0, 18).forEach((s, i) => {
    fest.registrations.push({ userId: s.id, role: 'student', name: s.name, at: new Date(Date.now() - 3600000 * (i + 2)).toISOString(), status: 'registered' })
  })
  db.students.slice(5, 14).forEach((s, i) => {
    ws.registrations.push({ userId: s.id, role: 'student', name: s.name, at: new Date(Date.now() - 3600000 * (i + 5)).toISOString(), status: 'registered' })
  })
  db.staff.slice(1, 3).forEach((s) => ws.registrations.push({ userId: s.id, role: 'staff', name: s.name, at: new Date(Date.now() - 7200000).toISOString(), status: 'registered' }))
  return events
}

export function seedTickets(db: Seedable): Ticket[] {
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()
  const st = db.students
  const sf = db.staff
  const mk = (n: number, t: Omit<Ticket, 'id' | 'ref' | 'updatedAt'>): Ticket => ({ id: `tkt-${n}`, ref: `Q-${1040 + n}`, updatedAt: t.messages[t.messages.length - 1].at, ...t })
  const msg = (by: 'admin' | 'requester', name: string, text: string, h: number) => ({ id: `m-${Math.random().toString(36).slice(2, 8)}`, by, name, text, at: ago(h) })

  return [
    mk(1, { kind: 'query', category: 'fees', subject: 'Can I pay the tuition fee in two instalments?', priority: 'normal', status: 'open', anonymous: false, from: { role: 'student', userId: st[2].id, name: st[2].name }, createdAt: ago(3), messages: [msg('requester', st[2].name, 'My family can pay half now and half next month. Is that allowed, and will a late fee apply on the second half?', 3)], unreadByAdmin: true, unreadByRequester: false }),
    mk(2, { kind: 'complaint', category: 'facilities', subject: 'Projector in CSE-102 not working for a week', priority: 'high', status: 'in_progress', anonymous: false, from: { role: 'staff', userId: sf[1].id, name: sf[1].name }, createdAt: ago(52), messages: [msg('requester', sf[1].name, 'The projector in CSE-102 shuts down after ten minutes. I have had to cancel two lab demos.', 52), msg('admin', 'Administrator', 'Thanks — maintenance has ordered a replacement lamp. Expected by Friday.', 30)], unreadByAdmin: false, unreadByRequester: false }),
    mk(3, { kind: 'query', category: 'attendance', subject: 'Medical leave not reflected in attendance', priority: 'normal', status: 'open', anonymous: false, from: { role: 'student', userId: st[9].id, name: st[9].name }, createdAt: ago(7), messages: [msg('requester', st[9].name, 'I submitted a medical certificate for 3 days last week but they still show as absent.', 7)], unreadByAdmin: true, unreadByRequester: false }),
    mk(4, { kind: 'complaint', category: 'conduct', subject: 'Ragging incident near the hostel mess', priority: 'urgent', status: 'open', anonymous: true, from: { role: 'student', userId: st[20].id, name: st[20].name }, createdAt: ago(1), messages: [msg('requester', st[20].name, 'A group of seniors has been harassing first years near the mess after 9 PM. Please act quickly.', 1)], unreadByAdmin: true, unreadByRequester: false }),
    mk(5, { kind: 'query', category: 'exams', subject: 'Clash between mid-sem exam and tech fest', priority: 'low', status: 'resolved', anonymous: false, from: { role: 'student', userId: st[0].id, name: st[0].name }, createdAt: ago(80), messages: [msg('requester', st[0].name, 'Will exams be rescheduled for students presenting at the fest?', 80), msg('admin', 'Administrator', 'No clash — the fest ends before the mid-sem exams begin. Good luck!', 70)], unreadByAdmin: false, unreadByRequester: true }),
    mk(6, { kind: 'query', category: 'academics', subject: 'Request for an extra lab slot for Microprocessors', priority: 'normal', status: 'open', anonymous: false, from: { role: 'staff', userId: sf[4].id, name: sf[4].name }, createdAt: ago(20), messages: [msg('requester', sf[4].name, 'Second years need one more lab session before the exam. Thursday P5–P6 is free in ECE Lab 1.', 20)], unreadByAdmin: true, unreadByRequester: false }),
    mk(7, { kind: 'complaint', category: 'transport', subject: 'Route 4 bus consistently 20 minutes late', priority: 'normal', status: 'closed', anonymous: false, from: { role: 'student', userId: st[30].id, name: st[30].name }, createdAt: ago(200), messages: [msg('requester', st[30].name, 'We miss the first period almost every day.', 200), msg('admin', 'Administrator', 'Route 4 now leaves 15 minutes earlier from tomorrow.', 180)], unreadByAdmin: false, unreadByRequester: false }),
  ]
}
