export type Role = 'admin' | 'staff' | 'student' | 'accountant'

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
  /** Secondary accent: derived from the primary by harmony, or a custom colour */
  secondaryHarmony?: 'analogous' | 'complementary' | 'split' | 'triadic' | 'mono' | 'custom'
  secondaryColor?: string | null
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
  photo?: string | null
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
  photo?: string | null
  bio?: string
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

/* ------------------------------ Accounts ------------------------------ */

export interface Accountant {
  id: string
  empId: string
  name: string
  email: string
  phone: string
  designation: string
  status: 'active' | 'inactive'
  photo?: string | null
}

export interface AdminProfile {
  name: string
  email: string
  phone: string
  designation: string
  photo: string | null
}

/** Student profile edits go to their HOD for approval. */
export interface ProfileChange {
  id: string
  studentId: string
  changes: Partial<Pick<Student, 'name' | 'email' | 'phone' | 'guardianName' | 'guardianPhone' | 'photo'>>
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  decidedBy?: string
  decidedAt?: string
  note?: string
}

/** Realtime notification addressed to one member (role:userId). */
export interface AppNotification {
  id: string
  to: string
  title: string
  body: string
  link?: string
  important: boolean
  kind: 'chat' | 'approval' | 'request' | 'leave' | 'profile' | 'ticket' | 'event' | 'finance' | 'info'
  at: string
}

export interface TaxSettings {
  legalName: string
  gstin: string
  pan: string
  tan: string
  stateCode: string
  /** GST % applied to fee categories. Fee amounts are treated as GST-inclusive. */
  feeGst: Record<FeeItem['category'], number>
  /** TDS % by Income-tax section, e.g. { '194C': 2 } */
  tdsRates: Record<string, number>
  /** Purchases above this need management approval after the HOD */
  procurementApprovalLimit: number
}

export interface Vendor {
  id: string
  name: string
  gstin: string
  pan: string
  state: string
  email: string
  phone: string
}

export interface LineItem {
  description: string
  qty: number
  rate: number
  gstRate: number
}

export type BillCategory = 'equipment' | 'maintenance' | 'utilities' | 'stationery' | 'services' | 'professional' | 'rent' | 'events' | 'other'

export interface Bill {
  id: string
  billNo: string
  vendorId: string
  category: BillCategory
  date: string
  dueDate: string
  items: LineItem[]
  /** Inter-state supply → IGST; otherwise CGST + SGST */
  interState: boolean
  tdsSection: string | null
  tdsRate: number
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  paidOn?: string
  paymentRef?: string
  bankAccountId?: string
  requestId?: string
  notes: string
  createdBy: string
}

export interface Invoice {
  id: string
  invoiceNo: string
  kind: 'fee' | 'other'
  studentId?: string
  feeId?: string
  customer?: { name: string; gstin: string; email: string }
  date: string
  dueDate: string
  items: LineItem[]
  interState: boolean
  /** Stored for 'other' invoices; fee invoices derive paid/unpaid from payments */
  status: 'issued' | 'paid' | 'void'
  paidOn?: string
  paymentRef?: string
}

export interface BankAccount {
  id: string
  bank: string
  branch: string
  accountName: string
  accountNo: string
  ifsc: string
  openingBalance: number
  openingDate: string
}

export interface BankTxn {
  id: string
  accountId: string
  date: string
  description: string
  ref: string
  debit: number
  credit: number
  match?: { type: 'payment' | 'bill' | 'invoice' | 'manual'; id: string; note?: string }
}

export interface TdsDeposit {
  id: string
  month: string // YYYY-MM the TDS was deducted in
  section: string
  amount: number
  challanNo: string
  depositedOn: string
}

/* ------------------------------ Chat ------------------------------ */

export interface ChatMember {
  role: Role
  userId: string
}

export interface ChatMessage {
  id: string
  from: ChatMember & { name: string }
  text: string
  at: string
}

export interface Chat {
  id: string
  kind: 'group' | 'direct'
  name: string
  topic: string
  scope: 'class' | 'department' | 'staff' | 'management' | 'custom' | 'direct'
  members: ChatMember[]
  /** Only these member keys (role:userId) may post when announceOnly */
  admins: string[]
  announceOnly: boolean
  createdBy: string
  createdAt: string
  messages: ChatMessage[]
  /** memberKey → ISO time of last read */
  reads: Record<string, string>
}

/* ------------------------------ Requests & leave ------------------------------ */

export type RequestStatus = 'pending_hod' | 'pending_admin' | 'approved' | 'rejected' | 'in_progress' | 'completed'

export interface DeptRequest {
  id: string
  ref: string
  kind: 'purchase' | 'repair' | 'setup'
  category: 'computer' | 'projector' | 'furniture' | 'lab' | 'network' | 'electrical' | 'av' | 'stationery' | 'other'
  title: string
  description: string
  quantity: number
  estimatedCost: number
  location: string
  department: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  requestedBy: { role: Role; userId: string; name: string }
  createdAt: string
  status: RequestStatus
  timeline: { at: string; by: string; action: string; note?: string }[]
  billId?: string
}

export interface LeaveRequest {
  id: string
  staffId: string
  type: 'casual' | 'sick' | 'earned' | 'duty'
  from: string
  to: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  approver: 'hod' | 'admin'
  decidedBy?: string
  decidedAt?: string
  note?: string
  createdAt: string
}

export interface Database {
  branding: Branding
  domain: DomainSettings
  email: EmailSettings
  templates: EmailTemplate[]
  emailLog: EmailLog[]
  departments: { code: string; name: string; hodId?: string | null }[]
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
  accountants: Accountant[]
  tax: TaxSettings
  vendors: Vendor[]
  bills: Bill[]
  invoices: Invoice[]
  bankAccounts: BankAccount[]
  bankTxns: BankTxn[]
  tdsDeposits: TdsDeposit[]
  chats: Chat[]
  requests: DeptRequest[]
  leaves: LeaveRequest[]
  adminProfile: AdminProfile
  profileChanges: ProfileChange[]
  notifications: AppNotification[]
}

export interface Session {
  role: Role
  userId: string // 'admin' for admin
  name: string
  /** Auth account id and expiry (ms since epoch), set by the auth service. */
  aid?: string
  exp?: number
}
