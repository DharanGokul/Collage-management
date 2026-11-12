export type Role = 'admin' | 'staff' | 'student'

export interface Branding {
  collegeName: string
  shortName: string
  tagline: string
  primaryColor: string
  logo: string | null // data URL
  favicon: string | null // data URL
  supportEmail: string
  supportPhone: string
  address: string
  loginHeadline: string
  currency: string
  /** Theme for people who haven't chosen their own (Day = Marble, Night = Noir, Auto = by time of day). */
  defaultTheme?: 'day' | 'night' | 'auto'
}

export interface DomainSettings {
  /** Tenant slug used for `<slug>.<platformDomain>` and `?tenant=<slug>` */
  subdomain: string
  customDomain: string
  domainStatus: 'none' | 'pending' | 'verified' | 'failed'
  lastCheckedAt: string | null
  forceHttps: boolean
}

export type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun' | 'ses' | 'webhook'

export interface EmailSettings {
  provider: EmailProvider
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpSecure: boolean
  apiKey: string
  region: string
  domain: string
  /** If set, emails are POSTed here as JSON (your backend / serverless function relays them). */
  webhookUrl: string
  fromName: string
  fromEmail: string
  replyTo: string
  footer: string
  verified: boolean
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'fees' | 'attendance' | 'general' | 'account'
}

export interface EmailLog {
  id: string
  to: string[]
  subject: string
  body: string
  status: 'sent' | 'queued' | 'failed'
  error?: string
  sentAt: string
  sentBy: string
  provider: EmailProvider
}

export interface Student {
  id: string
  rollNo: string
  name: string
  email: string
  phone: string
  department: string
  year: number
  section: string
  guardianName: string
  guardianPhone: string
  status: 'active' | 'inactive'
  joinedOn: string
}

export interface Staff {
  id: string
  empId: string
  name: string
  email: string
  phone: string
  department: string
  designation: string
  status: 'active' | 'inactive'
  joinedOn: string
}

export interface Subject {
  id: string
  code: string
  name: string
  department: string
  year: number
  staffId: string | null
  credits: number
}

export interface Period {
  no: number
  start: string
  end: string
}

export interface TimetableSlot {
  id: string
  classKey: string // `${department}|${year}|${section}`
  day: number // 0 = Monday
  period: number
  subjectId: string
  room: string
}

export type AttendanceMark = 'P' | 'A' | 'L'

export interface AttendanceSession {
  id: string
  date: string // YYYY-MM-DD
  classKey: string
  period: number
  subjectId: string
  markedBy: string
  marks: Record<string, AttendanceMark>
}

export interface FeeItem {
  id: string
  name: string
  category: 'tuition' | 'hostel' | 'exam' | 'transport' | 'library' | 'other'
  amount: number
  department: string // 'All' or department code
  year: number | 0 // 0 = all years
  dueDate: string
  term: string
  lateFeePerDay: number
}

export interface Payment {
  id: string
  receiptNo: string
  studentId: string
  feeId: string
  amount: number
  lateFee: number
  method: 'upi' | 'card' | 'netbanking' | 'cash' | 'cheque'
  txnRef: string
  paidAt: string
  status: 'success' | 'failed' | 'refunded'
  recordedBy: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  audience: 'all' | 'staff' | 'students'
  createdAt: string
}

export type EventKind = 'event' | 'exam' | 'holiday' | 'meeting' | 'fest' | 'workshop'

export interface EventRegistration {
  userId: string
  role: 'student' | 'staff'
  name: string
  at: string
  status: 'registered' | 'waitlisted'
}

export interface CampusEvent {
  id: string
  title: string
  kind: EventKind
  description: string
  /** Local date-time `YYYY-MM-DDTHH:mm` (date only is used when allDay) */
  start: string
  end: string
  allDay: boolean
  location: string
  audience: 'all' | 'students' | 'staff'
  /** Restrict to these classes (`dept|year|section`); empty = every class */
  classKeys: string[]
  /** Exams: the subject being examined */
  subjectId?: string
  registration: { enabled: boolean; capacity: number | null; deadline: string | null }
  registrations: EventRegistration[]
  createdBy: string
  createdAt: string
}

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface TicketMessage {
  id: string
  by: 'admin' | 'requester'
  name: string
  text: string
  at: string
}

export interface Ticket {
  id: string
  ref: string
  kind: 'query' | 'complaint'
  category: 'academics' | 'fees' | 'attendance' | 'exams' | 'facilities' | 'hostel' | 'transport' | 'conduct' | 'other'
  subject: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  status: TicketStatus
  anonymous: boolean
  from: { role: 'student' | 'staff'; userId: string; name: string }
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
  unreadByAdmin: boolean
  unreadByRequester: boolean
}

export interface Database {
  branding: Branding
  domain: DomainSettings
  email: EmailSettings
  templates: EmailTemplate[]
  emailLog: EmailLog[]
  departments: { code: string; name: string }[]
  sections: string[]
  students: Student[]
  staff: Staff[]
  subjects: Subject[]
  periods: Period[]
  timetable: TimetableSlot[]
  attendance: AttendanceSession[]
  fees: FeeItem[]
  payments: Payment[]
  announcements: Announcement[]
  events: CampusEvent[]
  tickets: Ticket[]
}

export interface Session {
  role: Role
  userId: string // 'admin' for admin
  name: string
}
