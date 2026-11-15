# UX research: staff, HOD and student portals

Scope: the Staff (faculty), HOD and Student roles. Admin, accounts and super admin were covered by a separate review.
Build tested: the working tree on 14 Nov 2026 (dev server, demo data, `localStorage` only).

## 1. Summary

The core workflows work end to end and the cross-actor loops are good. Every actor in the request, leave and profile-change flows gets a live toast and a bell entry. Sticky "important" toasts link straight to the right tab. Role guards, department scoping, chat policy and anonymous complaints all held up in every permission test I ran (section 9: all 24 tests pass).

The biggest problems were in the details:

- On phones, the bottom tab bar highlighted "Home" on every page under More.
- The notification badge could never be cleared.
- Phone fields accepted any text.
- There was no skip link, and focus was lost after closing a dialog.
- An HOD opened Approvals on an empty tab while Leave and Profiles had work waiting.
- Attendance marking used radio roles that did not behave like radios (3 tab stops per student, no arrow keys), and its only Save button was above the roster.
- Staff could not filter to students below 75%.
- The student timetable on a phone was only a sideways-scrolling grid.

I fixed all of these (section 10). Automated accessibility (axe-core, WCAG 2.0/2.1/2.2 A and AA tags) went from 66 of 66 page-runs with violations to 0 of 66.

**What I could not verify.** I did not run a real screen reader, a real phone, or sessions with real users. Personas are assumptions informed by common Indian college practice. Task times below are scripted browser times, not human times.

## 2. Method

- Playwright (Chromium) against a private dev server. Students at 375x812 with touch emulation first, then 1440x900. Staff and HOD at 1440x900, then 375x812. Dark and light themes for accessibility runs.
- Multi-actor flows used three tabs in one browser context (teacher and HOD at desktop size, student at phone size), so `localStorage` events act as the realtime channel.
- axe-core was installed only in the scratchpad folder, and run with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` on 12 staff pages x 2 staff personas and 9 student pages, in day and night themes. That is 66 page-runs.
- Keyboard-only walkthrough covered tab order, dialogs, focus return and the attendance controls. Touch targets were measured on every student page at 375px.
- Scripts and screenshots are in the session scratchpad under `ux-b/`: `flow1.cjs` to `flow4.cjs`, `perm.cjs`, `perm2.cjs`, `auth.cjs`, `kb.cjs`, `axe.cjs`, `verify.cjs`.

## 3. Personas

Everything under "Evidence" comes from the product docs and what I saw in the app. Everything marked (assumption) is my inference about real users and has not been validated.

### Student (Rahul, 1st-year CSE, roll 25CSE001)

- **Goals:** know where to be next, stay above 75% attendance, pay fees and keep the receipt, join events, get problems heard, ask a teacher a quick question.
- **Context (assumption):** mostly a mid-range Android phone on mobile data, short sessions between classes. Many students do not know their college email by heart but do know their roll number.
- **Pain points:**
  - Fees are due on a deadline, and late fees apply.
  - 75% attendance is a hard rule for exam eligibility in most Indian colleges (assumption: the portal's own 75% rule matches this).
  - Complaints (ragging, hostel) are sensitive, so students fear being identified.
  - Profile changes need HOD approval (evidence: docs).
- **Evidence in app:** the student dashboard leads with attendance %, fees due and next exam. The tab bar is built for thumbs. Students may only message their teachers, HOD and office.

### Teacher (Prof. Ravi Shankar, CSE)

- **Goals:** mark attendance fast, know who is falling below 75%, report equipment faults, take leave without chasing people, reach a class at once, know what is next.
- **Context (assumption):** desktop in the staff room between periods, and a phone in the corridor or lab. Attendance is taken every period, so seconds per class add up.
- **Pain points:**
  - Substitute and extra classes happen often.
  - A broken projector costs a whole period.
  - Leave and purchases depend on the HOD.
- **Evidence in app:** the teacher sees only the subjects assigned to them in Mark attendance. Requests go "Your HOD, then management" if a purchase or over the limit.

### HOD (Dr. Anita Krishnan, CSE)

- **Goals:** clear the approvals queue quickly with a note, keep department attendance healthy, see who is on leave and which classes need cover, escalate purchases.
- **Context (assumption):** desktop most of the day, but approves on a phone between meetings. Teaches a full load as well as heading the department.
- **Pain points:** items arrive from three sources (equipment, leave, student profile changes). A rejected item needs a reason.
- **Evidence in app:** the HOD gets "Approval needed" sticky toasts. The Department page shows faculty, students and attendance for only their own department.

## 4. Jobs to be done

| Role | Jobs |
|---|---|
| Student | S1 See today's or the next timetable. S2 Check attendance and whether below 75%. S3 Pay a fee and get the receipt. S4 Apply for an event. S5 File a complaint anonymously. S6 Change phone number (needs HOD approval). S7 Message a teacher. S8 Know about replies and decisions (bell and toasts). S9 Sign in, recover a password. |
| Teacher | T1 Mark attendance for a scheduled period. T2 Mark an extra or substitute class. T3 See students below 75%. T4 Report a broken projector. T5 Apply for leave. T6 Message a class. T7 Check the next class. T8 Request a purchase over the limit. |
| HOD | H1 Approve a repair or purchase and forward to management. H2 Approve a leave with a note. H3 Approve a student's profile change. H4 See the department overview. H5 Reject with a reason. |

## 5. Task results

Times and click counts are scripted (they exclude human reading and typing time). "Sev" is severity 0-4 for the friction found, using the Nielsen scale: 0 none, 1 cosmetic, 2 minor, 3 major, 4 blocker.

### Student (375x812 first, then 1440x900)

| Task | Steps | Outcome | Friction observed | Sev |
|---|---|---|---|---|
| S1 Today's timetable | Home > More > Timetable | Works, but on a phone it is a 5-day x 6-period grid that scrolls sideways. On Saturday nothing is highlighted. | No "today" view. **Fixed:** a "Today / Next teaching day" list above the grid. | 3, fixed |
| S2 Attendance and 75% | More > Attendance | 86.7% donut, per-subject bars, clear message "You meet the 75% requirement". For 25CSE004 (36.7%): "Attend the next 46 classes in a row to reach 75%". | Message is arithmetically right but discouraging; no per-subject warning. | 1 |
| S3 Pay a fee, get a receipt | Dashboard > Pay fees > Pay now > UPI > Pay (3 clicks plus typing). Receipt opens automatically after about 3.5 s. | Success on both sizes. Empty UPI gives "Enter a valid UPI ID, e.g. name@okbank". Receipt offers Print / Save PDF. | The "Opening your receipt..." pause is demo-gateway latency. Only per-item payment; no "pay all". | 1 |
| S4 Apply to an event | Events > Apply (1 click) | Toast "You're registered for ...", the button changes to Registered / Cancel, the dashboard count goes 1 to 2. | The tab "Open to apply (3)" also lists events I had already registered for. | 1 |
| S5 Anonymous complaint | Help desk > File a complaint > subject, details, tick "Submit anonymously" > Submit (6 clicks) | Admin sees "Anonymous student". A teacher cannot see it. Empty submit shows two clear field errors. | The anonymity checkbox sits low in the form, below the details box. | 2 |
| S6 Change phone | Profile > Phone > Submit for approval. | See section 6 (flow 4). Invalid text is now blocked inline. | Before fix: any text accepted. | 3, fixed |
| S7 Message a teacher | Chat > New message > pick teacher > type > Send | Contacts list contains only 3 teachers (CSE), the HOD and the Administrator. The teacher got a toast and an unread count. A reply came back as a toast. | None | 0 |
| S8 Notifications | Bell | Badge counted stored notifications forever. | **Fixed:** "Mark all read", per-item read, persists across reload. | 3, fixed |
| S9 Sign in | See section 9 | Messages and lockout are clear. | Role defaults to Admin for everyone. | 2 |

### Teacher (1440x900 first, then 375x812)

| Task | Steps | Outcome | Friction observed | Sev |
|---|---|---|---|---|
| T1 Mark a scheduled period | Attendance > pick date (Fri 13 Nov) > pick period > tap A on one student > Save (4 clicks) | Toast "Attendance updated - 6 present, 0 late, 2 absent". Same on both sizes. Mark buttons were 40x36 on desktop and 44x40 on a phone. | Save was only above the roster. **Fixed:** second Save at the bottom. Everyone defaults to Present. | 2, fixed |
| T2 Extra or substitute class | Pick a date with no class > roster shows at once > mark > Save | Works ("Attendance saved - 7 present, 1 late"). Picking a period that another subject already recorded shows a warning "Saving will replace it". | A roster of 8 students is pre-filled and Save-able on a day with no class (Saturday), which invites accidents. Overwrite was silent in the button label. **Fixed:** the button turns red and reads "Replace <subject> record". | 2, partly fixed |
| T3 Students below 75% | My students | Badge colours per student, but no filter. | **Fixed:** "Below 75% (n)" chip and a clearer column title. | 2, fixed |
| T4 Report a broken projector | Requests > Report an issue > title + location > Submit (3 clicks) | Toast "PR-1006 sent to your HOD". Empty submit shows 2 field errors. | None | 0 |
| T5 Apply for leave | Requests > Leave > Apply for leave > reason > Apply (1 day) | Toast "Leave application sent to your HOD". The HOD gets a sticky toast. | Date defaults to the next working day. | 0 |
| T6 Message a class | Chat > class group > type > Send | The student received a toast "Prof. Ravi Shankar in CSE - Year 1 - Sec A". | None | 0 |
| T7 Next class | Dashboard "Up next" | Shows "Starts in 1 d 13 h" with the subject, room and period. | On Saturday "Classes today: 0" is correct but easy to misread. | 1 |
| T8 Purchase over the limit | Requests > New request > cost 30,000 > Submit | The modal says "Approval route: Your HOD, then management". After HOD approval the teacher saw "Awaiting management". | None | 0 |

### HOD

| Task | Steps | Outcome | Friction observed | Sev |
|---|---|---|---|---|
| H1 Approve a repair | Click the sticky toast > card > note > Approve (3 clicks) | Lands on the right tab, toast "PR-1006 approved". The teacher gets "approved by HOD". | None | 0 |
| H1b Approve a purchase over the limit | Approvals > Approve | Toast "PR-1007 forwarded to management". The teacher sees "Awaiting management". | None | 0 |
| H2 Approve a leave with a note | Approvals > Leave > note > Approve | The teacher's leave table shows the quoted note and "Dr. Anita Krishnan". | Opening Approvals directly landed on the empty "Equipment and repairs" tab while Leave (2) waited. **Fixed:** opens the first tab with work. | 3, fixed |
| H3 Approve a profile change | Approvals > Student profiles > note > Approve | The student got a sticky toast and the new phone shows. | None | 0 |
| H4 Department overview | Department | KPIs, faculty today, attendance by class, department requests. On Saturday every row says "0 classes". | On a phone the Approvals tab strip clips "Student profiles". | 1 |
| H5 Reject | Same card | Reject stays disabled until a note is typed. | No message says why the button is disabled; only the field placeholder hints. | 2 |

## 6. Multi-actor flow findings

Run in one browser context with three live tabs.

| Flow | Does each actor learn what happened? | Notes |
|---|---|---|
| Teacher raises repair (PR-1006) > HOD approves > teacher | Teacher: toast "sent to your HOD". HOD: sticky toast "Approval needed" plus bell entry, link goes to the correct tab. Teacher: sticky toast "approved by HOD", card badge changes to Approved. | Good. |
| Purchase over limit (PR-1007) | Teacher: route text "Your HOD, then management". HOD: "forwarded to management". Teacher: status "Awaiting management" plus a toast. | Good. The management step was not tested (outside my scope). |
| Leave > HOD approves with note | Teacher: toast, quoted note in the leave table. HOD: sticky toast "Leave request". | The text says "1 day(s)". |
| Student profile change > HOD > student | Student: "Sent to your HOD for approval", pending card with a Withdraw button. HOD: sticky toast. Student after approval: sticky toast, new phone value, "Recent decisions" card. | Good. Student phone is stored as typed ("98765 43210"). |
| Student chat > teacher > reply > class message | All received a toast with sender and text, and unread counts. | Good. |

## 7. Heuristic evaluation (Nielsen)

| # | Heuristic | Finding | Sev | Fix or recommendation |
|---|---|---|---|---|
| 1 | Visibility of status | Toasts, bell and badges are strong. The bell badge could never go down. | 3 | Fixed (mark read). |
| 1 | Visibility | The mobile tab bar showed Home for pages under More. | 3 | Fixed. |
| 2 | Match with real world | "Awaiting you" on the student help desk is unclear. "1 day(s)" in notices. | 1 | Reword to "Needs your reply"; use plural logic. |
| 3 | User control | Profile change can be withdrawn. Leave can be withdrawn. Attendance has no unsaved-changes guard when switching period or date. | 2 | Recommend a "discard changes?" guard. |
| 4 | Consistency | Both a desktop and a mobile bell render a popover (both open in the DOM). Date inputs vs chips differ between pages. | 1 | None needed now. |
| 5 | Error prevention | Phone fields accepted any text. Attendance defaults every student to Present. A period of another subject can be overwritten. | 3 | Phone validated (fixed). Overwrite button turns red (fixed). Recommend requiring one explicit touch or a "mark all present" step. |
| 6 | Recognition over recall | Approvals tabs show counts. Student profile decisions show the HOD's note. | 0 | Good. |
| 7 | Flexibility | Ctrl+K search; Create menu; HOD can approve from the toast. Staff have no bulk "mark all absent" or keyboard shortcut for the roster. | 1 | Recommend roll-number keyboard entry. |
| 8 | Minimalist design | Student help-desk page puts 4 stat tiles and 2 chip rows before the first ticket on a phone. | 2 | Recommend a compact summary on phones. |
| 9 | Error messages | Login errors are specific and safe ("Incorrect ID or password. 2 attempts left..."). Form errors name the problem. Reject disabled with no explanation. | 2 | Add a hint "Add a note to reject" under the disabled button. |
| 10 | Help | Demo hints on login. Forgot password asks for an email while students sign in with a roll number. | 2 | Allow roll number on the forgot-password form. |
| First-time experience | Login opens on "Admin" with admin email prefilled for every visitor. | 2 | Remember the last role used on this device (not changed: the login page is shared with the auth review). |

Forms and validation timing: required fields are validated on first Submit and then live; the profile form validates live while typing (email, phone). Destructive actions (cancel registration, withdraw request) are single-click with a toast and no confirm. Tables on a phone become horizontally scrolling regions; no page-level horizontal overflow on any of the 21 staff and student pages at 375px.

## 8. Accessibility (WCAG 2.2 AA)

### axe-core counts

| | Before fixes | After fixes |
|---|---|---|
| Page-runs with at least one violation | 66 of 66 | 0 of 66 |
| `label-content-name-mismatch` | 210 nodes on 33 pages (brand link, bell, avatar button, profile chip, calendar mini-days) | 0 |
| `aria-progressbar-name` | 18 nodes, 4 pages | 0 |
| `color-contrast` | 15 nodes, 3 pages (tab bar labels at 3.6:1 over a hero card in the light theme) | 0 |
| `scrollable-region-focusable` | 6 nodes, 2 pages (tables, timetable) | 0 |

Both themes were scanned. The same counts appear in dark and light except the contrast violation, which only showed in light.

### Keyboard-only

- Before: 18 tab stops before the first page control and no skip link. After: "Skip to main content" is the first tab stop and moves focus to the main region.
- Dialogs trap focus correctly (12 extra Tab presses stayed inside). Escape closes. Before: focus fell to `<body>` after closing. After: focus returns to the button that opened it ("Pay now").
- Attendance buttons had `role=radio` with all 3 buttons tabbable and no arrow-key support (tabindex 0 on each). Now plain toggle buttons (`aria-pressed`, accessible names Present / Late / Absent).
- Bell popover opens on Enter and closes on Escape, but focus stays on the bell rather than the first item (minor, left).
- Focus outline is visible on all tested controls (2px solid).

### Touch targets (student pages at 375px)

- Before: 110 interactive elements under 44px; 1 under 24px (the "use college default" link at 21px high).
- After: CSS for coarse pointers sets 44px minimum on small buttons, chips, icon buttons, round buttons, segmented buttons, links in buttons and the calendar mini-days. 76 remaining (measured before the last CSS pass) were mostly 34-44px; the one under 24px is fixed.
- Remaining non-compliant sizes I saw: the brand link is 36px high; "Details" link is 44x29.

### Screen-reader semantics

I did not run a screen reader. Semantics reviewed through axe and the DOM: form fields have visible labels; errors use `role="alert"`; dialogs are Radix dialogs with titles; the primary nav has `aria-label`; the main region is now a `<main>`. Receipt amounts and attendance donut are visual; the donut has a text label next to it.

## 9. Permission and role tests

| # | Test | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | Student opens `#/staff` | Redirect to student home | `#/student` | Pass |
| 2 | Student opens `#/staff/approvals` | Redirect | `#/student` | Pass |
| 3 | Student opens `#/admin`, `#/admin/students` | Redirect | `#/student` | Pass |
| 4 | Student opens `#/accountant` | Redirect | `#/student` | Pass |
| 5 | Student opens `#/super` | Not the college console | `#/super/login` | Pass |
| 6 | Staff opens `#/student`, `#/student/fees` | Redirect to staff home | `#/staff` | Pass |
| 7 | Staff opens `#/admin`, `#/admin/staff`, `#/accountant` | Redirect | `#/staff` | Pass |
| 8 | Non-HOD opens Department | No content | "Only heads of department can see this page" | Pass |
| 9 | Non-HOD opens Approvals | No content | "Approvals are for HODs and management" | Pass |
| 10 | Non-HOD nav | No Department or Approvals link | Overview, Calendar, Attendance, Timetable, My students, Requests, Chat | Pass |
| 11 | ECE HOD's Approvals | Only ECE items | Only PR-1003 (ECE). No CSE names in requests, leave or profile tabs | Pass |
| 12 | ECE HOD's Department page | ECE only | Electronics & Communication; no CSE faculty | Pass |
| 13 | ECE HOD's Mark attendance subjects | Only own subjects | ECE101, ECE104, ECE203 | Pass |
| 14 | Teacher's Mark attendance subjects | Only own | CSE102, CSE105, CSE201, CSE204 | Pass |
| 15 | Extra or substitute class path | Works, warns on clash | Saved on a no-class day; clash warning shown | Pass |
| 16 | Student 25CSE004 sees own attendance and profile | Own data | 36.7%, roll 25CSE004 | Pass |
| 17 | Student 25CSE001 sees own fees | Own data | Total payable 8,000 | Pass |
| 18 | Student deep-links to another student's chat | No messages | No leak, no composer | Pass |
| 19 | Student deep-links to another student's tickets | No content | List shows only own tickets | Pass |
| 20 | Anonymous complaint seen by staff | Hidden | Teacher's queries list and deep link do not show it | Pass |
| 21 | Anonymous complaint seen by admin | Shown as anonymous | "Anonymous student" | Pass |
| 22 | Student starts a chat with arbitrary people | Only teachers, HOD, office | 3 CSE teachers, HOD, Administrator; no New group | Pass |
| 23 | Sign out ends access | Back and deep link go to login | `#/login` for all three | Pass |
| 24 | Wrong password, lockout, OTP, trust, forgot | See below | See below | Pass |

Sign-in security UX, observed at 375px:

- Wrong password and unknown ID give the same text ("Incorrect ID or password."). The third failure adds "2 attempts left before a temporary lock", then "1 attempt left".
- The fifth failure locks the account with a live countdown ("Try again in 4m 59s"). The countdown keeps running, and a correct password while locked is refused with the same countdown.
- A wrong OTP says "That code is not right. 4 tries left." The code screen shows a masked email, a 5-minute expiry and a 30-second resend countdown. The trust checkbox is unchecked by default. After a trusted sign-in the next sign-in skipped the OTP.
- Forgot password: empty or malformed input shows "Enter the email address on your account". A known email shows "If an account exists ... a reset link is on its way. It works for 1 hour".

Caveat on privacy at the data layer: the demo database stores the real `from.userId` on anonymous tickets (for example `tkt-4` records `stu-21`). The UI hides it correctly. A backend must not return it to non-authorised readers.

## 10. Fixes made

| File | Change |
|---|---|
| `src/components/Layout.tsx` | Tab bar: Home highlights only on the exact home path; other pages light up More. |
| `src/components/Layout.tsx` | Bell: per-person read state (localStorage), "Mark all read", click marks one read, label "N unread notifications", count badge hidden from assistive tech, menu items marked as `menuitem`. |
| `src/components/Layout.tsx` | Skip link, `<main id="main-content">`; brand link and profile chip names come from their visible text; avatar button label includes initials. |
| `src/lib/utils.ts` | New `isValidPhone` (Indian 10-digit mobile with optional +91/0, or international with +). |
| `src/pages/shared/Profile.tsx` | Phone and guardian phone validated live; Submit disabled while invalid; `autoComplete` set. |
| `src/pages/shared/Approvals.tsx` | With no tab in the URL, opens the first tab that has something waiting. |
| `src/pages/shared/AttendanceMarker.tsx` | Second Save button under the roster; red "Replace <subject> record" button on a clash; toggle-button semantics and accessible names for P/L/A. |
| `src/pages/staff/Students.tsx` | "Below 75% (n)" filter chip; clearer column title. |
| `src/pages/student/Timetable.tsx` | "Today" or "Next teaching day" list above the weekly grid. |
| `src/components/ui.tsx` | `Progress` gets an accessible name and value text; `Modal` returns focus to the opener. |
| `src/pages/shared/CalendarPage.tsx` | Mini-calendar day buttons named "1 Sunday November 2026" (contains the visible number). |
| `src/pages/student/Attendance.tsx`, `Fees.tsx`, `staff/Students.tsx`, `staff/Department.tsx`, `shared/Requests.tsx`, `shared/eventsUi.tsx`, `shared/TimetableGrid.tsx` | Scrollable tables and the timetable are keyboard-focusable named regions. |
| `src/index.css` | 44px touch targets for coarse pointers; near-opaque light-theme tab bar (contrast); skip-link styles. |

Final checks: `npx tsc -b` passes, `npx oxlint` reports nothing, `npm test` passes (35 tests).

## 11. Open issues, ranked

1. **Anonymous complaints keep the sender in the stored record** (high for the backend phase). Strip it server-side and audit who can ever re-identify.
2. **Staff "My students" shows every student's phone and guardian phone** to any teacher of that class. Purpose limitation (DPDP) says show contact details only on demand, and log it.
3. **Attendance defaults to everyone Present** and a roster is shown on days with no class. Consider requiring an explicit start and an unsaved-changes guard.
4. **Forgot password asks for an email**, while students sign in with a roll number and may not remember the college email.
5. **Login opens on Admin** with the demo email prefilled. Remember the last role per device.
6. **Student help desk on a phone**: four stat tiles before the first ticket. Replace with a one-line summary.
7. **Reject is disabled without explanation**; add a visible hint.
8. **Approvals tab strip clips** on a phone; consider a select or wrapped tabs.
9. **Read state for notifications is per browser** and calendar reminders stay read once read. Needs a server-side read flag.
10. **Phone is stored as typed**; normalise to +91 and digits.
11. **Stacked toasts**: a teacher saw four at once after a burst of events.
12. **Overwriting another subject's attendance** still succeeds after the red warning; a block or second confirmation would be safer.
13. **Bell popover** does not move focus to its first item.
14. Student attendance advice for very low percentages ("Attend the next 46 classes") is correct but demoralising; show it per subject.

## 12. Recommended next features

- Student leave and on-duty requests approved by a class advisor, feeding attendance.
- A "Today" view on the student home that combines classes, fees due and anything needing a reply.
- Attendance entry by roll number with keyboard, plus "mark rest present", plus an undo toast.
- Substitute arrangement: when a leave is approved, suggest free faculty for the uncovered periods ("Classes to cover: 9 periods" already shows).
- Parent read-only login with SMS alerts for absences and dues.
- Push notifications and a server-side notification centre with read state.
- Marks and results, which the needs analysis already ranks as the biggest academic gap.
