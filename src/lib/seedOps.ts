import type {
  Accountant, AdminProfile, AppNotification, BankAccount, BankTxn, Bill, Chat, ChatMessage, Database, DeptRequest, Invoice, LeaveRequest,
  ProfileChange, TaxSettings, TdsDeposit, Vendor,
} from '../types'
import { billTotals, feeInvoiceItems } from './finance'
import { studentClassKey, toISODate } from './utils'

/** Fills every v3 collection that a database is missing (new colleges and migrations alike). */
export function seedOperations(db: Database) {
  const today = new Date()
  const day = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return toISODate(d) }
  const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

  // ---- HODs: the "Professor & HoD" of each department
  for (const d of db.departments) {
    if (d.hodId === undefined) d.hodId = db.staff.find((s) => s.department === d.code && /hod/i.test(s.designation))?.id ?? null
  }

  db.adminProfile ??= { name: 'Administrator', email: 'admin@college.edu', phone: db.branding.supportPhone, designation: 'Principal’s Office', photo: null } satisfies AdminProfile

  db.accountants ??= [
    { id: 'acc-1', empId: 'ACC201', name: 'Geetha Raman', email: 'geetha.raman@college.edu', phone: '9845011122', designation: 'Chief Accountant', status: 'active', photo: null },
    { id: 'acc-2', empId: 'ACC202', name: 'Arun Kumar', email: 'arun.kumar@college.edu', phone: '9845011133', designation: 'Accounts Assistant', status: 'active', photo: null },
  ] satisfies Accountant[]

  db.tax ??= {
    legalName: db.branding.collegeName,
    gstin: '29AABTN1234F1Z5',
    pan: 'AABTN1234F',
    tan: 'BLRN01234E',
    stateCode: '29',
    // Education services to students are GST-exempt (Notification 12/2017-CT(R), entry 66).
    feeGst: { tuition: 0, exam: 0, library: 0, hostel: 0, transport: 0, other: 0 },
    tdsRates: { '194C': 2, '194J': 10, '194I': 10, '194H': 2, '194Q': 0.1 },
    procurementApprovalLimit: 25000,
  } satisfies TaxSettings

  db.vendors ??= [
    { id: 'ven-1', name: 'BESCOM', gstin: '', pan: 'AABCB1234C', state: '29', email: 'billing@bescom.example', phone: '1912' },
    { id: 'ven-2', name: 'Airtel Business', gstin: '27AAACB2894G1ZQ', pan: 'AAACB2894G', state: '27', email: 'enterprise@airtel.example', phone: '121' },
    { id: 'ven-3', name: 'TechNova Systems Pvt Ltd', gstin: '29AAFCT5521M1Z2', pan: 'AAFCT5521M', state: '29', email: 'sales@technova.example', phone: '080 4100 2200' },
    { id: 'ven-4', name: 'CleanCampus Facility Services', gstin: '29AAKFC8812Q1Z9', pan: 'AAKFC8812Q', state: '29', email: 'ops@cleancampus.example', phone: '080 4100 3300' },
    { id: 'ven-5', name: 'Dr. Rakesh Iyer (Guest Faculty)', gstin: '', pan: 'ABRPI4521K', state: '29', email: 'rakesh.iyer@example.com', phone: '9880012345' },
    { id: 'ven-6', name: 'Sharma Stationers', gstin: '29ABCPS9921H1Z3', pan: 'ABCPS9921H', state: '29', email: 'orders@sharmastat.example', phone: '080 2222 1111' },
    { id: 'ven-7', name: 'SoundWave Events', gstin: '29AAGFS7781L1Z1', pan: 'AAGFS7781L', state: '29', email: 'book@soundwave.example', phone: '9845099990' },
  ] satisfies Vendor[]

  if (!db.bills) {
    const bill = (n: number, b: Omit<Bill, 'id' | 'billNo' | 'notes' | 'createdBy'> & { notes?: string }): Bill => ({ id: `bill-${n}`, billNo: `B-${2400 + n}`, notes: '', createdBy: 'acc-1', ...b })
    db.bills = [
      bill(1, { vendorId: 'ven-1', category: 'utilities', date: day(-62), dueDate: day(-48), items: [{ description: 'Electricity — HT connection', qty: 1, rate: 148200, gstRate: 0 }], interState: false, tdsSection: null, tdsRate: 0, status: 'paid', paidOn: day(-50), paymentRef: 'NEFT-ELEC-0912', bankAccountId: 'bank-1' }),
      bill(2, { vendorId: 'ven-2', category: 'utilities', date: day(-58), dueDate: day(-44), items: [{ description: 'Leased line 500 Mbps — monthly', qty: 1, rate: 42000, gstRate: 18 }], interState: true, tdsSection: null, tdsRate: 0, status: 'paid', paidOn: day(-45), paymentRef: 'NEFT-AIR-1001', bankAccountId: 'bank-1' }),
      bill(3, { vendorId: 'ven-4', category: 'services', date: day(-33), dueDate: day(-18), items: [{ description: 'Housekeeping contract — monthly', qty: 1, rate: 185000, gstRate: 18 }], interState: false, tdsSection: '194C', tdsRate: 2, status: 'paid', paidOn: day(-20), paymentRef: 'NEFT-CC-2210', bankAccountId: 'bank-1' }),
      bill(4, { vendorId: 'ven-5', category: 'professional', date: day(-28), dueDate: day(-14), items: [{ description: 'Guest lectures — Machine Learning (8 sessions)', qty: 8, rate: 5000, gstRate: 0 }], interState: false, tdsSection: '194J', tdsRate: 10, status: 'paid', paidOn: day(-15), paymentRef: 'NEFT-RI-0045', bankAccountId: 'bank-1' }),
      bill(5, { vendorId: 'ven-1', category: 'utilities', date: day(-30), dueDate: day(-16), items: [{ description: 'Electricity — HT connection', qty: 1, rate: 156400, gstRate: 0 }], interState: false, tdsSection: null, tdsRate: 0, status: 'paid', paidOn: day(-17), paymentRef: 'NEFT-ELEC-1012', bankAccountId: 'bank-1' }),
      bill(6, { vendorId: 'ven-6', category: 'stationery', date: day(-12), dueDate: day(3), items: [{ description: 'Answer booklets (32 pages)', qty: 4000, rate: 9.5, gstRate: 12 }, { description: 'Printer cartridges', qty: 12, rate: 2400, gstRate: 18 }], interState: false, tdsSection: null, tdsRate: 0, status: 'approved' }),
      bill(7, { vendorId: 'ven-4', category: 'services', date: day(-3), dueDate: day(12), items: [{ description: 'Housekeeping contract — monthly', qty: 1, rate: 185000, gstRate: 18 }], interState: false, tdsSection: '194C', tdsRate: 2, status: 'pending' }),
      bill(8, { vendorId: 'ven-7', category: 'events', date: day(-2), dueDate: day(10), items: [{ description: 'Sound & lighting — Tech Fest (3 days)', qty: 3, rate: 28000, gstRate: 18 }], interState: false, tdsSection: '194C', tdsRate: 2, status: 'pending' }),
      bill(9, { vendorId: 'ven-2', category: 'utilities', date: day(-27), dueDate: day(-13), items: [{ description: 'Leased line 500 Mbps — monthly', qty: 1, rate: 42000, gstRate: 18 }], interState: true, tdsSection: null, tdsRate: 0, status: 'paid', paidOn: day(-14), paymentRef: 'NEFT-AIR-1102', bankAccountId: 'bank-1' }),
    ]
  }

  if (!db.invoices) {
    const invoices: Invoice[] = []
    let n = 5000
    // Fee invoices for the main tuition fee, one per applicable student.
    const fee = db.fees[0]
    if (fee) {
      for (const st of db.students.filter((s) => s.status === 'active')) {
        invoices.push({ id: `inv-${++n}`, invoiceNo: `INV/${String(today.getFullYear()).slice(2)}/${n}`, kind: 'fee', studentId: st.id, feeId: fee.id, date: day(-25), dueDate: fee.dueDate, items: feeInvoiceItems(fee, db.tax.feeGst[fee.category] ?? 0), interState: false, status: 'issued' })
      }
    }
    invoices.push(
      { id: `inv-${++n}`, invoiceNo: `INV/${String(today.getFullYear()).slice(2)}/${n}`, kind: 'other', customer: { name: 'Karnataka Startup Forum', gstin: '29AACCK1122L1Z7', email: 'events@ksf.example' }, date: day(-18), dueDate: day(-3), items: [{ description: 'Auditorium rental — 1 day', qty: 1, rate: 60000, gstRate: 18 }], interState: false, status: 'paid', paidOn: day(-6), paymentRef: 'NEFT-KSF-778' },
      { id: `inv-${++n}`, invoiceNo: `INV/${String(today.getFullYear()).slice(2)}/${n}`, kind: 'other', customer: { name: 'Annapoorna Caterers (canteen licence)', gstin: '29ABEFA5531R1Z0', email: 'accounts@annapoorna.example' }, date: day(-5), dueDate: day(10), items: [{ description: 'Canteen space licence fee — quarterly', qty: 1, rate: 90000, gstRate: 18 }], interState: false, status: 'issued' },
    )
    db.invoices = invoices
  }

  db.bankAccounts ??= [
    { id: 'bank-1', bank: 'State Bank of India', branch: 'Knowledge Park', accountName: `${db.branding.collegeName} — Fee Collection`, accountNo: '3901 2345 6781', ifsc: 'SBIN0012345', openingBalance: 4825000, openingDate: day(-90) },
    { id: 'bank-2', bank: 'HDFC Bank', branch: 'MG Road', accountName: `${db.branding.collegeName} — Operations`, accountNo: '5010 0098 7654', ifsc: 'HDFC0001234', openingBalance: 1260000, openingDate: day(-90) },
  ] satisfies BankAccount[]

  if (!db.bankTxns) {
    const txns: BankTxn[] = []
    let n = 0
    // Online fee payments settle T+1 into the collection account; cash/cheque are deposited.
    for (const p of db.payments.filter((x) => x.status === 'success')) {
      const settle = new Date(p.paidAt)
      settle.setDate(settle.getDate() + 1)
      if (settle > today) continue
      const s = db.students.find((x) => x.id === p.studentId)
      txns.push({ id: `bt-${++n}`, accountId: 'bank-1', date: toISODate(settle), description: p.method === 'cash' ? `CASH DEPOSIT ${s?.rollNo ?? ''}` : `${p.method.toUpperCase()} COLL ${s?.rollNo ?? ''}`, ref: p.method === 'cash' ? '' : p.txnRef, debit: 0, credit: p.amount + p.lateFee, match: { type: 'payment', id: p.id } })
    }
    for (const b of db.bills.filter((x) => x.status === 'paid' && x.paidOn)) {
      txns.push({ id: `bt-${++n}`, accountId: b.bankAccountId ?? 'bank-1', date: b.paidOn!, description: `NEFT DR ${db.vendors.find((v) => v.id === b.vendorId)?.name.toUpperCase() ?? ''}`, ref: b.paymentRef ?? '', debit: billTotals(b).payable, credit: 0, match: { type: 'bill', id: b.id } })
    }
    const ksf = db.invoices.find((i) => i.kind === 'other' && i.status === 'paid')
    if (ksf) txns.push({ id: `bt-${++n}`, accountId: 'bank-2', date: ksf.paidOn!, description: 'NEFT CR KARNATAKA STARTUP FORUM', ref: ksf.paymentRef ?? '', debit: 0, credit: 70800, match: { type: 'invoice', id: ksf.id } })
    // Unreconciled lines for the accountant to look at
    txns.push({ id: `bt-${++n}`, accountId: 'bank-1', date: day(-4), description: 'BANK CHARGES QTR', ref: 'CHG-Q3', debit: 1180, credit: 0 })
    txns.push({ id: `bt-${++n}`, accountId: 'bank-2', date: day(-9), description: 'SALARY TRANSFER — NOVEMBER (BULK)', ref: 'SAL-BULK-11', debit: 2840000, credit: 0 })
    txns.push({ id: `bt-${++n}`, accountId: 'bank-2', date: day(-11), description: 'TRANSFER FROM FEE COLLECTION A/C', ref: 'INT-TRF-77', debit: 0, credit: 3000000 })
    txns.push({ id: `bt-${++n}`, accountId: 'bank-1', date: day(-11), description: 'TRANSFER TO OPERATIONS A/C', ref: 'INT-TRF-77', debit: 3000000, credit: 0 })
    txns.push({ id: `bt-${++n}`, accountId: 'bank-1', date: day(-2), description: 'UPI COLL UNKNOWN REF', ref: 'UPI9988776655', debit: 0, credit: 3500 })
    db.bankTxns = txns.sort((a, b) => a.date.localeCompare(b.date))
  }

  if (!db.tdsDeposits) {
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const m = toISODate(prev).slice(0, 7)
    db.tdsDeposits = [{ id: 'tds-1', month: m, section: '194J', amount: 4000, challanNo: 'ITNS281-0045521', depositedOn: toISODate(new Date(today.getFullYear(), today.getMonth(), 5)) }] satisfies TdsDeposit[]
  }

  // ---- Chats
  if (!db.chats) {
    const msg = (role: Database['chats'][number]['members'][number]['role'], userId: string, name: string, text: string, h: number): ChatMessage => ({ id: `cm-${Math.random().toString(36).slice(2, 9)}`, from: { role, userId, name }, text, at: ago(h) })
    const chats: Chat[] = []
    const classes = [...new Set(db.students.map(studentClassKey))].sort()
    for (const key of classes) {
      const [d, y, sec] = key.split('|')
      const teachers = [...new Set(db.timetable.filter((t) => t.classKey === key).map((t) => db.subjects.find((s) => s.id === t.subjectId)?.staffId).filter(Boolean) as string[])]
      const students = db.students.filter((s) => studentClassKey(s) === key)
      const lead = db.staff.find((s) => s.id === teachers[0])
      const messages: ChatMessage[] = []
      if (lead) messages.push(msg('staff', lead.id, lead.name, 'Reminder: lab records must be submitted by Friday 4 PM. Late submissions will lose 2 marks.', 26))
      if (students[0]) messages.push(msg('student', students[0].id, students[0].name, 'Ma’am, can we submit the record in the department office if you are not in the lab?', 25))
      if (lead) messages.push(msg('staff', lead.id, lead.name, 'Yes, leave it with the lab assistant and sign the register.', 24))
      if (students[2]) messages.push(msg('student', students[2].id, students[2].name, 'Thank you ma’am 🙏', 23))
      chats.push({ id: `chat-class-${d}-${y}-${sec}`, kind: 'group', name: `${d} · Year ${y} · Sec ${sec}`, topic: 'Class group — teachers and students', scope: 'class', members: [...teachers.map((id) => ({ role: 'staff' as const, userId: id })), ...students.map((s) => ({ role: 'student' as const, userId: s.id }))], admins: teachers.map((id) => `staff:${id}`), announceOnly: false, createdBy: 'admin:admin', createdAt: ago(24 * 40), messages, reads: {} })
    }
    for (const d of db.departments) {
      const staff = db.staff.filter((s) => s.department === d.code)
      const hod = staff.find((s) => s.id === d.hodId)
      chats.push({ id: `chat-dept-${d.code}`, kind: 'group', name: `${d.code} Department`, topic: `${d.name} faculty`, scope: 'department', members: staff.map((s) => ({ role: 'staff' as const, userId: s.id })), admins: hod ? [`staff:${hod.id}`] : [], announceOnly: false, createdBy: hod ? `staff:${hod.id}` : 'admin:admin', createdAt: ago(24 * 60), messages: hod ? [msg('staff', hod.id, hod.name, 'Please update syllabus completion % in the tracker before the council meeting.', 30)] : [], reads: {} })
    }
    chats.push({
      id: 'chat-all-staff', kind: 'group', name: 'All staff', topic: 'Announcements from management', scope: 'staff',
      members: [{ role: 'admin', userId: 'admin' }, ...db.staff.map((s) => ({ role: 'staff' as const, userId: s.id })), ...db.accountants.map((a) => ({ role: 'accountant' as const, userId: a.id }))],
      admins: ['admin:admin'], announceOnly: true, createdBy: 'admin:admin', createdAt: ago(24 * 90),
      messages: [msg('admin', 'admin', 'Administrator', 'Mid-semester exams start on the 19th. Invigilation duty chart is on the notice board.', 50), msg('admin', 'admin', 'Administrator', 'Salary for November has been credited. Payslips are available in the accounts office.', 8)], reads: {},
    })
    const hods = db.departments.map((d) => d.hodId).filter(Boolean) as string[]
    chats.push({ id: 'chat-mgmt-hods', kind: 'group', name: 'Management & HODs', topic: 'Principal’s office with heads of department', scope: 'management', members: [{ role: 'admin', userId: 'admin' }, ...hods.map((id) => ({ role: 'staff' as const, userId: id }))], admins: ['admin:admin'], announceOnly: false, createdBy: 'admin:admin', createdAt: ago(24 * 60), messages: hods[0] ? [msg('admin', 'admin', 'Administrator', 'Please send department budget requests for next semester by the 25th.', 40), msg('staff', hods[0], db.staff.find((s) => s.id === hods[0])?.name ?? '', 'Will do. CSE needs 10 lab systems replaced — request raised.', 39)] : [], reads: {} })
    chats.push({ id: 'chat-mgmt-accounts', kind: 'group', name: 'Management & Accounts', topic: 'Payments, budgets and audits', scope: 'management', members: [{ role: 'admin', userId: 'admin' }, ...db.accountants.map((a) => ({ role: 'accountant' as const, userId: a.id }))], admins: ['admin:admin'], announceOnly: false, createdBy: 'admin:admin', createdAt: ago(24 * 60), messages: [msg('accountant', 'acc-1', 'Geetha Raman', 'Two vendor bills are waiting for your approval before payment.', 5)], reads: {} })
    const s0 = db.staff[1], st0 = db.students[0]
    if (s0 && st0) chats.push({ id: 'chat-dm-1', kind: 'direct', name: '', topic: '', scope: 'direct', members: [{ role: 'staff', userId: s0.id }, { role: 'student', userId: st0.id }], admins: [], announceOnly: false, createdBy: `student:${st0.id}`, createdAt: ago(30), messages: [msg('student', st0.id, st0.name, 'Sir, could you share the reference book for Data Structures?', 29), msg('staff', s0.id, s0.name, '“Data Structures and Algorithms in C” by Weiss — the library has 4 copies.', 28)], reads: {} })
    db.chats = chats
  }

  // ---- Requests & leave
  if (!db.requests) {
    const by = (id: string) => { const s = db.staff.find((x) => x.id === id)!; return { role: 'staff' as const, userId: s.id, name: s.name } }
    const hodName = (dept: string) => db.staff.find((x) => x.id === db.departments.find((d) => d.code === dept)?.hodId)?.name ?? 'HOD'
    const reqs: DeptRequest[] = [
      { id: 'req-1', ref: 'PR-1001', kind: 'purchase', category: 'computer', title: '10 desktop computers for CSE Lab 2', description: 'Replace 10 systems (Core i3, 4 GB) that cannot run current IDEs. Spec: Core i5 / 16 GB / 512 GB SSD.', quantity: 10, estimatedCost: 450000, location: 'CSE Lab 2', department: 'CSE', priority: 'high', requestedBy: by('stf-2'), createdAt: ago(24 * 6), status: 'pending_admin', timeline: [{ at: ago(24 * 6), by: by('stf-2').name, action: 'Submitted' }, { at: ago(24 * 5), by: hodName('CSE'), action: 'Approved by HOD', note: 'Essential before next semester labs.' }] },
      { id: 'req-2', ref: 'PR-1002', kind: 'repair', category: 'projector', title: 'Projector in CSE-102 shuts down', description: 'Projector switches off after ~10 minutes. Probably lamp/overheating.', quantity: 1, estimatedCost: 6500, location: 'CSE-102', department: 'CSE', priority: 'high', requestedBy: by('stf-2'), createdAt: ago(60), status: 'in_progress', timeline: [{ at: ago(60), by: by('stf-2').name, action: 'Submitted' }, { at: ago(55), by: hodName('CSE'), action: 'Approved by HOD' }, { at: ago(30), by: 'Administrator', action: 'Work started', note: 'Lamp ordered from vendor.' }] },
      { id: 'req-3', ref: 'PR-1003', kind: 'repair', category: 'furniture', title: 'Broken benches in ECE-103', description: '6 benches have loose tops and 2 have broken legs — unsafe for students.', quantity: 8, estimatedCost: 9600, location: 'ECE-103', department: 'ECE', priority: 'urgent', requestedBy: by('stf-5'), createdAt: ago(20), status: 'pending_hod', timeline: [{ at: ago(20), by: by('stf-5').name, action: 'Submitted' }] },
      { id: 'req-4', ref: 'PR-1004', kind: 'purchase', category: 'av', title: 'Wireless podium mic for MBA seminar hall', description: 'Current wired mic limits presenters; need 1 podium + 2 handheld wireless mics.', quantity: 1, estimatedCost: 18000, location: 'MBA Seminar Hall', department: 'MBA', priority: 'normal', requestedBy: by('stf-8'), createdAt: ago(9), status: 'pending_hod', timeline: [{ at: ago(9), by: by('stf-8').name, action: 'Submitted' }] },
      { id: 'req-5', ref: 'PR-1005', kind: 'setup', category: 'network', title: 'Wi-Fi access point for ECE staff room', description: 'No signal in the staff room. Need one ceiling AP.', quantity: 1, estimatedCost: 12000, location: 'ECE staff room', department: 'ECE', priority: 'low', requestedBy: by('stf-6'), createdAt: ago(24 * 12), status: 'completed', timeline: [{ at: ago(24 * 12), by: by('stf-6').name, action: 'Submitted' }, { at: ago(24 * 11), by: hodName('ECE'), action: 'Approved by HOD' }, { at: ago(24 * 9), by: 'Administrator', action: 'Work started' }, { at: ago(24 * 7), by: 'Administrator', action: 'Completed', note: 'AP installed and tested.' }] },
    ]
    db.requests = reqs
  }
  if (!db.leaves) {
    const lv: LeaveRequest[] = [
      { id: 'lv-1', staffId: 'stf-2', type: 'casual', from: day(3), to: day(4), days: 2, reason: 'Family function in Mysuru.', status: 'pending', approver: 'hod', createdAt: ago(5) },
      { id: 'lv-2', staffId: 'stf-5', type: 'sick', from: day(-10), to: day(-9), days: 2, reason: 'Viral fever.', status: 'approved', approver: 'hod', decidedBy: 'Dr. Suresh Babu', decidedAt: ago(24 * 10), createdAt: ago(24 * 10) },
      { id: 'lv-3', staffId: 'stf-1', type: 'duty', from: day(8), to: day(9), days: 2, reason: 'Paper presentation at IEEE conference, Chennai.', status: 'pending', approver: 'admin', createdAt: ago(18) },
    ]
    db.leaves = lv
  }
  db.profileChanges ??= [
    { id: 'pc-1', studentId: db.students[4]?.id ?? 'stu-5', changes: { phone: '9876501234', guardianPhone: '9876505678' }, reason: 'Changed mobile numbers.', status: 'pending', createdAt: ago(6) },
  ] satisfies ProfileChange[]
  db.notifications ??= [] satisfies AppNotification[]
  return db
}

