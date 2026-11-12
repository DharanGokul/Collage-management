# College Management System (front-end)

A multi-college (multi-tenant), white-label college ERP front-end built with **React 19 + TypeScript + Vite + GSAP**, styled with the **Caesar** design system.
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

### Events, exams & calendar (all roles)
- **Admin** creates events (fest, workshop, meeting, holiday, general) and **schedules exams** per subject/class, with an optional "email the audience" notice, seat limits, apply-by deadlines and a clash warning for exams in the same class and slot.
- **Students & staff apply** for events from the Events page, the calendar or their dashboard. Full events put applicants on a waitlist that is promoted automatically when a seat frees up. Admins can see and export the registration list.
- **Calendar** for every role: week view with a time grid, multi-day bars and a "now" line; month and list views; filters by kind (exams, events, fests, workshops, meetings, holidays, fee due dates, "my classes"); a mini month calendar; and an "Open for registration" side panel. On phones the week view becomes a day strip with an agenda for the selected day.

### Help desk — queries & complaints
- Students and staff **raise queries or file complaints** (category, priority, and complaints can be anonymous) and follow the conversation thread.
- Admins work through a **help desk inbox**: filter by status and type, read threads, reply (optionally also by email), set status and priority, and resolve tickets. Unread counts show as badges in the nav, the tab bar and the notifications bell.

### Staff
Dashboard with today's classes, marking attendance for each period (Present / Late / Absent, including extra classes), personal timetable, and attendance for the students they teach.

### Student
Dashboard, fee payment (demo checkout by UPI, card or net banking, with a printable receipt and a receipt email), attendance by subject (including how many classes are needed to reach 75%), and the class timetable.

## Design system — Caesar
The UI uses the **Caesar** design system: Black leads, Burgundy speaks once, White gives room.
- The tokens in `src/index.css` mirror the system's `tokens.json`, with two themes: **Night** (Noir, dark) and **Day** (Marble, light).
- **Day / Night / Auto switch:** it sits in the top bar, in the mobile "More" sheet, and on the login and platform screens. **Auto** uses Day from 6 AM to 6 PM and Night otherwise. It flips live when the clock passes either time, and checks again when you return to the tab. A new theme spreads out in a circle from the switch where the browser supports View Transitions, and fades in elsewhere. The choice is saved per browser (`src/lib/themeMode.ts`).
- **College-wide default (Settings › Branding › Default theme):** the admin chooses Day, Night or Auto. Anyone who hasn't picked their own theme follows it. A personal choice overrides it on that device, and "Use college default" (in Settings, or in the mobile Appearance panel) switches back.
- Display type is Archivo Black in capitals; body text is Figtree.
- On request, the app softens Caesar's square, flat style: cards have 22px corners, inner tiles 16px, and buttons and inputs 12px, with soft shadows in both themes. The red (Burgundy) is the primary colour for the navigation highlight, active tabs, chips and toggles, the main buttons, today markers and badges.
- Content spans the full width of the screen; there is no fixed-width container.
- **Day theme follows the reference screenshots:** a soft mint-to-peach gradient background, semi-transparent white cards with 28px corners and very soft shadows, white inner tiles, sentence-case headings and a light sign-in page. Only the fixed bars, pop-ups and sheets blur what's behind them, which keeps clicks and typing fast. **Night** keeps the Caesar Noir look.
- The accent defaults to Burgundy. Each college can replace it with its own brand colour, and `src/lib/theme.ts` derives the pressed state, the text colour on the accent, and accent-text tints with enough contrast in both themes.
- Two sets of colours were added beyond the brand palette: status colours (ok, warn, danger, info) and agenda kind colours. Kinds always show a short code as well, so colour is never the only signal.

## Motion & speed
- **Liquid navigation:** when you switch pages, the highlight in the top pill nav and in the mobile tab bar stretches across to the new item, then settles onto it (`src/components/LiquidNav.tsx`).
- **Page entry:** each page's blocks rise into place over about 0.3s using transforms only, so the animation never forces a re-layout. Sheets and popovers slide in. Animations switch off when the user has asked for reduced motion.
- **Code splitting:** every page is its own chunk of 3–7 KB gzipped. Pages are prefetched when you hover a nav item, and all of a role's pages load in the background while the browser is idle. A page that has already been prefetched renders straight away, without React's Suspense delay (`src/routes.ts`).

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
