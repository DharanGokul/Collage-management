# What a real college needs from its management system

This is a gap analysis against how Indian colleges (affiliated colleges and autonomous institutions) actually run day to day. It maps each need to what this portal does today, what this update added, and what should come next.

**Status:** ✅ built · 🆕 added in this update · 🟡 partly there · ⬜ not yet

---

## 1. People and roles

| Need | Status | Notes |
|---|---|---|
| Separate portals for management, faculty, students | ✅ | Admin, Staff and Student portals |
| **Accounts / finance office** | 🆕 | New *Accounts* login: bills, invoices, fees, bank, taxes, reports |
| **Head of Department (HOD)** with real authority | 🆕 | HODs are faculty with a *Department* page and *Approvals* inbox; HOD is set per department |
| Role-based permissions (who can see or approve what) | 🟡 | Enforced in the UI. A backend must enforce it again on every API call |
| Parents / guardians | ⬜ | Read-only parent login: attendance, fees, results, notices (very commonly asked for) |
| Other roles: librarian, hostel warden, transport, exam cell, placement officer | ⬜ | Same role pattern; each has its own module (below) |
| Multi-campus / multiple colleges | ✅ | Platform super admin, one tenant per college, white-label domain |

## 2. Approvals and workflow (the HOD layer)

| Need | Status | Notes |
|---|---|---|
| Equipment purchase requests (computers, projectors, lab kit) | 🆕 | Staff → HOD → management (purchases, or anything over the limit) → accounts raises the bill → staff confirms receipt |
| Maintenance and issue reports (benches, electrical, network) | 🆕 | Repair/setup requests with priority, location, timeline and progress stepper |
| Staff leave (CL / SL / EL / OD) with balances | 🆕 | HOD approves their faculty; management approves the HOD; working-day count; yearly quotas |
| Student profile changes approved by HOD | 🆕 | Photo, name, contact and guardian changes need HOD approval; staff edit their own contact details and photo |
| Purchase approval limit | 🆕 | Configurable in Taxes › Settings (default ₹25,000) |
| Substitute arrangement when a teacher is on leave | ⬜ | Suggest free faculty for their periods; notify the class |
| Student leave and on-duty for events | ⬜ | Class advisor approves; attendance marked as OD automatically |
| Circulars needing acknowledgement | 🟡 | Announcements exist; "read & acknowledged" tracking does not |

## 3. Communication

| Need | Status | Notes |
|---|---|---|
| Class groups (teachers ↔ their students) | 🆕 | Seeded for every class; teachers are group admins |
| Department group, management ↔ HODs, management ↔ accounts, all-staff announcements | 🆕 | All-staff is announcement-only |
| Direct messages with sensible limits | 🆕 | Students can only message their own teachers, their HOD and the office |
| Live updates and notifications | 🆕 | Live across tabs and windows, toast notifications, important ones stay until dismissed. Production needs WebSockets/SSE and push |
| SMS / WhatsApp / push to parents | ⬜ | Fee due, absence, exam alerts. Use DLT-registered SMS templates in India |
| Email | ✅ | SMTP, SendGrid, Mailgun, SES or an HTTPS relay; templates; bulk sending |
| Help desk (queries and complaints, anonymous option) | ✅ | Includes anonymous complaints. Anti-ragging and ICC (POSH) cases need restricted visibility and audit |

## 4. Academics

| Need | Status | Notes |
|---|---|---|
| Timetable with clash detection | ✅ | Faculty and room clashes flagged |
| Period-wise attendance, 75% rule | ✅ | Below-75% list and alerts |
| Events and exam schedule on everyone's calendar | ✅ | Registration, waitlist, exam clash warning |
| **Internal assessment and marks entry → results / grade cards** | ⬜ | The biggest academic gap. CIA marks, end-semester results, GPA/CGPA, grade sheets, revaluation |
| Exam cell: hall tickets, seating plans, invigilation duty | ⬜ | Builds on the existing exam events and rooms |
| Course outcomes (CO/PO) attainment | ⬜ | Required for NBA accreditation |
| Assignments, materials, LMS | ⬜ | Or integrate Google Classroom / Moodle |
| Syllabus completion tracking | ⬜ | The HOD dashboard is the natural home |
| Feedback on teaching (student surveys) | ⬜ | Mandatory for NAAC Criterion 2 |

## 5. Finance (accounts office)

| Need | Status | Notes |
|---|---|---|
| Fee structures, dues, receipts, reminders | ✅ | Late fees, offline payments, refunds |
| **Fee invoices / bills of supply** | 🆕 | Generated per student per fee; paid status follows payments; printable with the college GSTIN and amount in words |
| **Vendor bills with GST & TDS** | 🆕 | CGST/SGST or IGST worked out from the vendor's state; TDS 194C/194J/194I/194H/194Q on the value before GST; approvals over the limit |
| **Bank accounts, statement import, reconciliation** | 🆕 | CSV import (DD/MM/YYYY), auto-matching to fees, bills and invoices, manual explanations, running balances |
| **GST summary and GSTR-1 view** | 🆕 | Output tax, exempt supplies (education services), input GST shown as a cost |
| **TDS register and challans** | 🆕 | By section; due on the 7th of next month (30 April for March); overdue flags |
| **Month-wise and year-wise (FY Apr–Mar) reports with export** | 🆕 | Collections, expenses, income & expenditure, dues ageing, bank summary; CSV and print to PDF |
| Online payment gateway (Razorpay / PayU / Stripe) | 🟡 | Checkout UI exists; a real gateway plus webhooks are needed |
| **Payroll** (salary, PF, ESI, professional tax, TDS on salary 192, Form 16) | ⬜ | The next finance module; salary appears in bank statements but isn't modelled |
| Scholarships, concessions, instalment plans | ⬜ | Very common; also state post-matric scholarships |
| Budgets by department; purchase orders and stock (inventory/assets) | ⬜ | Purchase requests already flow into bills; add PO → goods receipt → asset register |
| Double-entry ledger, Tally export, audit trail | ⬜ | Auditors expect a Tally/ERP export and an immutable log |

## 6. Student lifecycle and services

| Need | Status | Notes |
|---|---|---|
| Profile with photo | 🆕 | Changes approved by the HOD |
| Admissions and enquiries (CRM), document verification | ⬜ | The front door of every college |
| ID cards, bonafide / transfer / conduct certificates | ⬜ | Generate from the profile; request via the help desk |
| Library (circulation, fines) | ⬜ | Fines can post to fee dues |
| Hostel (rooms, mess, fees) and transport (routes, passes) | ⬜ | Both feed fees and attendance |
| Placements and alumni | ⬜ | Drives, eligibility, offers; alumni network |
| APAAR ID / Academic Bank of Credits, DigiLocker | ⬜ | National mandates for credit transfer and digital certificates |

## 7. Compliance, accreditation and reporting

| Need | Status | Notes |
|---|---|---|
| NAAC / NIRF / AISHE data | ⬜ | Most criteria can come from data already here: staff, students, attendance, events, finance |
| Anti-ragging, ICC (POSH), grievance redressal committees | 🟡 | Complaints exist; committee workflows, confidentiality and timelines are needed |
| DPDP Act 2023 (personal data) | ⬜ | Consent, purpose limitation, retention, a breach process, access logs, and data stored in India |
| Audit log of every change | ⬜ | Who changed what, when; needed for finance and approvals |

## 8. Platform (moving from demo to production)

| Need | Status | Notes |
|---|---|---|
| Real authentication (SSO / OTP / password + 2FA) | ⬜ | Currently a demo sign-in |
| Server-side database and API | ⬜ | Now stored in the browser (`localStorage`) and synced across tabs; move to Postgres plus an API |
| Realtime transport | 🟡 | Cross-tab sync stands in for it; use WebSockets/SSE per college channel |
| File storage for photos and documents | 🟡 | Photos are resized data URLs; move to object storage with signed URLs |
| Backups, monitoring, rate limits | ⬜ | |
| Accessibility and performance | ✅ | Keyboard-operable, reduced-motion aware, responsive 320px–4K; slowest interaction under 100ms on a 4× throttled CPU |

---

## Recommended next steps

1. **Backend and real authentication.** Every approval and financial record needs server-side enforcement and an audit log.
2. **Marks, results and the exam cell.** This is the largest academic gap.
3. **Payroll.** Completes the accounts office (salary, PF, ESI, PT, TDS 192).
4. **Parent portal with SMS/WhatsApp alerts.** The most visible win for families.
5. **Admissions CRM and certificates.**
6. **NAAC/NIRF data packs, generated from the data the portal already holds.**

*Tax and compliance notes describe common practice in India for orientation. Confirm rates and filings with the college's auditor.*
