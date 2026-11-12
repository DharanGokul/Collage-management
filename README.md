# College Management System (front-end)

A multi-college (multi-tenant), white-label college ERP front-end built with **React 19 + TypeScript + Vite**.
There is no backend: all data is stored in the browser's `localStorage`. Each college gets realistic demo data when it is created.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/ (works on any host / sub-path)
```

## Portals

| Portal | Who | Sign in |
|---|---|---|
| **Platform console** (`#/super`) | Your team (platform owner) | `super@campusone.app`, any password |
| **Admin** | The college's administration | the college's admin email (any email works on the default demo college) |
| **Staff** | Faculty | staff email or employee ID, e.g. `anita.krishnan@college.edu` |
| **Student** | Students | roll number, e.g. `25CSE001` |

In demo mode any password with 4+ characters works. The login page also lists every seeded user to pick from.

### Platform super admin
- Onboard a college. The portal URL is generated from the college name (`St. Mary's College` → `st-marys-college.campusone.app`), and you set the college admin's email, a plan and a starting brand colour.
- See students, staff and fees collected for each college, plus monthly recurring revenue
- Change a college's plan, suspend or reactivate it (suspended colleges can't sign in), open its portal, or delete it (you must type its URL slug to confirm)

### Admin
- Dashboard: key numbers, attendance trend, fee collection by department, alerts, announcements
- Students and staff: add, edit and delete with validation; CSV export; welcome emails
- Subjects: assign faculty to each subject
- Fees: fee items (by department and year, with late fee per day); dues for each student; recording offline payments (with an option to waive the late fee); payment ledger with refunds and receipts; bulk email reminders
- Attendance: report for each class and subject over a date range, list of students below a threshold (with bulk email alerts), attendance marking
- Timetable: grid editor that flags faculty and room clashes, editable period timings, print
- Email Center: write emails to an audience (all students, one class, students with overdue fees, students with low attendance, staff, or a custom list), with `{{placeholders}}` filled in for each recipient, a preview, an outbox with retry, and templates
- Settings
  - **Branding:** college name, tagline, primary colour (contrast is checked), logo and favicon upload with a live preview
  - **Domain & URL:** a sub-domain, plus a custom domain with CNAME/TXT DNS instructions and a verification step
  - **Email sending:** custom SMTP, SendGrid, Mailgun, Amazon SES or an HTTPS relay; sender name, from address and reply-to; footer; test email
  - **Data:** JSON backup and restore, reset to the demo data

### Staff
Dashboard with today's classes, marking attendance for each period (Present / Late / Absent, including extra classes), personal timetable, and attendance for the students they teach.

### Student
Dashboard, fee payment (demo checkout by UPI, card or net banking, with a printable receipt and a receipt email), attendance by subject (including how many classes are needed to reach 75%), and the class timetable.

## White-labelling: how the college is found from the URL
`src/lib/tenant.ts` works out which college to show, checking in this order:
1. `?tenant=<slug>` (for previews and localhost)
2. a custom domain that has been verified
3. `<slug>.<VITE_PLATFORM_DOMAIN>` (defaults to `campusone.app`)
4. the default demo college

If the URL names a college that doesn't exist, a "College not found" page is shown. The colour, favicon, page title and logo are applied when the app loads (`src/lib/theme.ts`).

## Email delivery
A browser can't use SMTP directly, and it shouldn't hold provider API keys. Choose the **HTTPS relay** provider to have each message POSTed as JSON to your backend: `{ from, replyTo, to[], subject, text }`. With any other provider the settings are checked, sending is simulated, and the message is recorded in the outbox.

## Environment variables
| Variable | Default |
|---|---|
| `VITE_PLATFORM_DOMAIN` | `campusone.app` |
| `VITE_SUPER_ADMIN_EMAIL` | `super@campusone.app` |

## Moving to production
This app is a front-end prototype. The credential checks, domain verification and payment gateway are all simulated. To go live, connect it to a backend that handles authentication, tenant lookup, DNS checks, payments (Razorpay, Stripe or PayU) and email.
