import type {
  AttendanceMark,
  AttendanceSession,
  Database,
  EmailTemplate,
  FeeItem,
  Payment,
  Staff,
  Student,
  Subject,
  TimetableSlot,
} from '../types'
import { classKey, toISODate } from './utils'
import { seedEvents, seedTickets } from './seedCampus'

// Deterministic PRNG so every fresh tenant gets the same demo data.
function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Aarav', 'Diya', 'Vihaan', 'Ananya', 'Arjun', 'Isha', 'Kabir', 'Meera', 'Rohan', 'Saanvi', 'Aditya', 'Kavya', 'Nikhil', 'Priya', 'Rahul', 'Sneha', 'Varun', 'Neha', 'Karthik', 'Pooja', 'Siddharth', 'Riya', 'Yash', 'Tanvi']
const LAST = ['Sharma', 'Iyer', 'Patel', 'Reddy', 'Nair', 'Gupta', 'Menon', 'Rao', 'Khan', 'Das', 'Joshi', 'Pillai', 'Verma', 'Singh']

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'tpl-fee-reminder',
    name: 'Fee payment reminder',
    category: 'fees',
    subject: 'Fee reminder: {{fee_name}} due on {{due_date}}',
    body: 'Dear {{student_name}},\n\nThis is a friendly reminder that {{fee_name}} of {{amount}} is due on {{due_date}}.\n\nPlease pay online from your student portal: {{portal_url}}\n\nRegards,\nAccounts Office\n{{college_name}}',
  },
  {
    id: 'tpl-fee-receipt',
    name: 'Payment receipt',
    category: 'fees',
    subject: 'Payment received – Receipt {{receipt_no}}',
    body: 'Dear {{student_name}},\n\nWe have received {{amount}} towards {{fee_name}}.\nReceipt number: {{receipt_no}}\nTransaction reference: {{txn_ref}}\n\nThank you,\n{{college_name}}',
  },
  {
    id: 'tpl-low-attendance',
    name: 'Low attendance alert',
    category: 'attendance',
    subject: 'Attendance alert for {{student_name}}',
    body: 'Dear {{student_name}},\n\nYour attendance is currently {{attendance_pct}}, below the required 75%.\nPlease meet your class advisor at the earliest.\n\nRegards,\nOffice of Academics\n{{college_name}}',
  },
  {
    id: 'tpl-welcome',
    name: 'Welcome to the portal',
    category: 'account',
    subject: 'Welcome to {{college_name}}',
    body: 'Hello {{name}},\n\nYour {{college_name}} portal account is ready. Sign in at {{portal_url}} to view your timetable, attendance and fees.\n\nCheers,\n{{college_name}}',
  },
  {
    id: 'tpl-general',
    name: 'General announcement',
    category: 'general',
    subject: '{{college_name}}: Important update',
    body: 'Dear {{name}},\n\n<your message here>\n\nRegards,\n{{college_name}}',
  },
]

export function createSeed(collegeName = 'Northbridge Institute of Technology'): Database {
  const r = rng(42)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]

  const departments = [
    { code: 'CSE', name: 'Computer Science & Engineering' },
    { code: 'ECE', name: 'Electronics & Communication' },
    { code: 'MBA', name: 'Business Administration' },
  ]
  const sections = ['A']
  const years = [1, 2]

  const staffSeed: [string, string, string][] = [
    ['Dr. Anita Krishnan', 'CSE', 'Professor & HoD'],
    ['Prof. Ravi Shankar', 'CSE', 'Associate Professor'],
    ['Ms. Lakshmi Menon', 'CSE', 'Assistant Professor'],
    ['Dr. Suresh Babu', 'ECE', 'Professor & HoD'],
    ['Ms. Fatima Sheikh', 'ECE', 'Assistant Professor'],
    ['Mr. Joseph Thomas', 'ECE', 'Assistant Professor'],
    ['Dr. Meenakshi Rao', 'MBA', 'Professor & HoD'],
    ['Mr. Vikram Desai', 'MBA', 'Associate Professor'],
  ]
  const staff: Staff[] = staffSeed.map(([name, dept, designation], i) => ({
    id: `stf-${i + 1}`,
    empId: `EMP${String(101 + i)}`,
    name,
    email: name.toLowerCase().replace(/^(dr|prof|ms|mr)\.\s*/, '').replace(/\s+/g, '.') + '@college.edu',
    phone: `98450${String(10000 + i * 137).slice(0, 5)}`,
    department: dept,
    designation,
    status: 'active',
    joinedOn: `20${15 + (i % 8)}-06-01`,
  }))

  const subjectNames: Record<string, string[][]> = {
    CSE: [
      ['Programming in C', 'Engineering Mathematics I', 'Digital Logic', 'Physics', 'Communication Skills'],
      ['Data Structures', 'Database Systems', 'Operating Systems', 'Discrete Mathematics', 'Web Technologies'],
    ],
    ECE: [
      ['Circuit Theory', 'Engineering Mathematics I', 'Electronic Devices', 'Physics', 'Communication Skills'],
      ['Signals & Systems', 'Analog Circuits', 'Microprocessors', 'Electromagnetics', 'Network Analysis'],
    ],
    MBA: [
      ['Principles of Management', 'Managerial Economics', 'Accounting for Managers', 'Business Statistics', 'Organisational Behaviour'],
      ['Marketing Management', 'Financial Management', 'Operations Management', 'HR Management', 'Business Analytics'],
    ],
  }
  const subjects: Subject[] = []
  for (const d of departments) {
    const deptStaff = staff.filter((s) => s.department === d.code)
    years.forEach((y, yi) => {
      subjectNames[d.code][yi].forEach((name, si) => {
        subjects.push({
          id: `sub-${d.code}-${y}-${si + 1}`,
          code: `${d.code}${y}0${si + 1}`,
          name,
          department: d.code,
          year: y,
          staffId: deptStaff[(si + yi) % deptStaff.length].id,
          credits: si < 3 ? 4 : 3,
        })
      })
    })
  }

  const students: Student[] = []
  let n = 0
  for (const d of departments)
    for (const y of years)
      for (const s of sections)
        for (let i = 0; i < 8; i++) {
          n++
          const first = pick(FIRST)
          const last = pick(LAST)
          students.push({
            id: `stu-${n}`,
            rollNo: `${26 - y}${d.code}${String(i + 1).padStart(3, '0')}`,
            name: `${first} ${last}`,
            email: `${first}.${last}${n}`.toLowerCase() + '@student.college.edu',
            phone: `9${Math.floor(100000000 + r() * 899999999)}`,
            department: d.code,
            year: y,
            section: s,
            guardianName: `${pick(FIRST)} ${last}`,
            guardianPhone: `9${Math.floor(100000000 + r() * 899999999)}`,
            status: 'active',
            joinedOn: `20${26 - y}-07-15`,
          })
        }

  const periods = [
    { no: 1, start: '09:00', end: '09:50' },
    { no: 2, start: '09:50', end: '10:40' },
    { no: 3, start: '11:00', end: '11:50' },
    { no: 4, start: '11:50', end: '12:40' },
    { no: 5, start: '13:30', end: '14:20' },
    { no: 6, start: '14:20', end: '15:10' },
  ]

  const timetable: TimetableSlot[] = []
  for (const d of departments)
    for (const y of years)
      for (const s of sections) {
        const key = classKey(d.code, y, s)
        const subs = subjects.filter((x) => x.department === d.code && x.year === y)
        for (let day = 0; day < 5; day++)
          for (const p of periods) {
            const sub = subs[(day + p.no) % subs.length]
            timetable.push({
              id: `tt-${key}-${day}-${p.no}`,
              classKey: key,
              day,
              period: p.no,
              subjectId: sub.id,
              room: `${d.code}-${y}0${(p.no % 3) + 1}`,
            })
          }
      }

  // Attendance for the past 15 weekdays (first two periods each day)
  const attendance: AttendanceSession[] = []
  const today = new Date()
  const days: Date[] = []
  for (let i = 1; days.length < 15; i++) {
    const dt = new Date(today)
    dt.setDate(today.getDate() - i)
    if (dt.getDay() !== 0 && dt.getDay() !== 6) days.push(dt)
  }
  // Some students are habitually absent, so the low-attendance report has content.
  const absentees = new Set(students.filter(() => r() < 0.15).map((s) => s.id))
  for (const dt of days) {
    const day = (dt.getDay() + 6) % 7
    for (const slot of timetable.filter((t) => t.day === day && t.period <= 2)) {
      const marks: Record<string, AttendanceMark> = {}
      const [dept, yr, sec] = slot.classKey.split('|')
      for (const st of students.filter((x) => x.department === dept && x.year === +yr && x.section === sec)) {
        const v = r()
        const absentChance = absentees.has(st.id) ? 0.4 : 0.07
        marks[st.id] = v < absentChance ? 'A' : v < absentChance + 0.04 ? 'L' : 'P'
      }
      const sub = subjects.find((s) => s.id === slot.subjectId)!
      attendance.push({
        id: `att-${toISODate(dt)}-${slot.classKey}-${slot.period}`,
        date: toISODate(dt),
        classKey: slot.classKey,
        period: slot.period,
        subjectId: slot.subjectId,
        markedBy: sub.staffId ?? 'admin',
        marks,
      })
    }
  }

  const yr = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const fees: FeeItem[] = [
    { id: 'fee-1', name: 'Tuition Fee – Semester', category: 'tuition', amount: 65000, department: 'All', year: 0, dueDate: `${yr}-${mm}-05`, term: 'Odd Semester', lateFeePerDay: 50 },
    { id: 'fee-2', name: 'Examination Fee', category: 'exam', amount: 3500, department: 'All', year: 0, dueDate: `${yr}-${mm}-25`, term: 'Odd Semester', lateFeePerDay: 20 },
    { id: 'fee-3', name: 'Lab & Library Fee', category: 'library', amount: 4500, department: 'CSE', year: 0, dueDate: `${yr}-${mm}-28`, term: 'Odd Semester', lateFeePerDay: 0 },
    { id: 'fee-4', name: 'Industry Immersion Programme', category: 'other', amount: 12000, department: 'MBA', year: 2, dueDate: `${yr}-${mm}-28`, term: 'Odd Semester', lateFeePerDay: 0 },
  ]

  const payments: Payment[] = []
  let rc = 1000
  for (const st of students) {
    if (r() < 0.7) {
      const paid = new Date(today)
      paid.setDate(today.getDate() - Math.floor(r() * 20) - 1)
      payments.push({
        id: `pay-${rc}`,
        receiptNo: `RCPT-${yr}-${++rc}`,
        studentId: st.id,
        feeId: 'fee-1',
        amount: 65000,
        lateFee: 0,
        method: pick(['upi', 'card', 'netbanking', 'cash'] as const),
        txnRef: `TXN${Math.floor(r() * 1e10)}`,
        paidAt: paid.toISOString(),
        status: 'success',
        recordedBy: 'system',
      })
    }
  }

  const campus = { students, staff, subjects, departments, sections }
  return {
    events: seedEvents(campus),
    tickets: seedTickets(campus),
    branding: {
      collegeName,
      shortName: 'NIT Campus',
      tagline: 'Excellence in learning since 1998',
      primaryColor: '#6d001a',
      logo: null,
      favicon: null,
      supportEmail: 'help@college.edu',
      supportPhone: '+91 80 4000 1234',
      address: '12 Knowledge Park, Bengaluru 560001',
      loginHeadline: 'One portal for academics, attendance & fees',
      currency: 'INR',
      defaultTheme: 'auto',
    },
    domain: {
      subdomain: 'northbridge',
      customDomain: '',
      domainStatus: 'none',
      lastCheckedAt: null,
      forceHttps: true,
    },
    email: {
      provider: 'smtp',
      smtpHost: 'smtp.college.edu',
      smtpPort: 587,
      smtpUser: 'no-reply@college.edu',
      smtpPassword: '',
      smtpSecure: true,
      apiKey: '',
      region: 'ap-south-1',
      domain: '',
      webhookUrl: '',
      fromName: collegeName,
      fromEmail: 'no-reply@college.edu',
      replyTo: 'office@college.edu',
      footer: 'This is an automated message from the college ERP. Please do not reply.',
      verified: false,
    },
    templates: DEFAULT_TEMPLATES,
    emailLog: [],
    departments,
    sections,
    students,
    staff,
    subjects,
    periods,
    timetable,
    attendance,
    fees,
    payments,
    announcements: [
      { id: 'ann-1', title: 'Mid-semester exams from the 24th', body: 'Exam timetable is published on the notice board and portal.', audience: 'all', createdAt: new Date(today.getTime() - 86400000 * 2).toISOString() },
      { id: 'ann-2', title: 'Faculty meeting on Friday 3 PM', body: 'All faculty to attend in the seminar hall.', audience: 'staff', createdAt: new Date(today.getTime() - 86400000 * 4).toISOString() },
      { id: 'ann-3', title: 'Tech fest registrations open', body: 'Register before the end of the month through the student council.', audience: 'students', createdAt: new Date(today.getTime() - 86400000 * 5).toISOString() },
    ],
  }
}
