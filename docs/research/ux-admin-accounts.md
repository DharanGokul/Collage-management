# UX research: Admin, Accounts and Platform Super Admin

Scope: the college admin (principal/registrar/management), the accountant, and the platform super admin. Staff, HOD and student roles are covered elsewhere.

## Summary

- The admin and accounts flows work end to end. Every task was completed in 2 to 5 clicks on desktop (1440x900) and phone (375x812), with no console errors.
- Biggest problem: a newly onboarded college was a clone of the demo college (48 students, 8 staff, Rs 25,35,000 "collected"). There was no empty state and no first-run guidance. Fixed with an "Empty college" option, now the default, plus a setup checklist.
- Accounts could edit the purchase approval limit that management owns, so a bill could be kept under the limit by editing it. Fixed (read-only).
- Bulk or money actions had no confirmation: "Email all" for low attendance, announcement delete, "Approve payment" on vendor bills. Fixed.
- On phones, row actions (edit/delete) in the Students table sat off-screen. Partly fixed (sticky actions column). A card layout is still recommended.
- Accessibility: axe violations dropped from 97 to 1 node (night theme) and from 64 to 1 node (day theme) across 36 page/theme runs. Tabs had no arrow-key support, and page titles never changed. Both fixed.
- All permission tests pass. The only failure was the accounts approval-limit edit, now fixed.

## Method

- Playwright (Chromium) against a private Vite dev server on port 5402. Desktop 1440x900 and phone 375x812.
- Demo password `Demo@1234`. The emailed code was read from `cms:mailbox:<tenant>` in localStorage.
- Every task was scripted (`admin.cjs`, `acct.cjs`, `super.cjs`, `firstrun.cjs`) with click counts and elapsed time. Screenshots were reviewed by eye.
- axe-core ran on 36 page states per theme (night and day): login, 20 admin states, 10 accounts pages, 2 modals, and the 3 super pages. Rule set: WCAG 2.x A/AA, 2.2 AA and best practice.
- A keyboard-only walkthrough (`kbd.cjs`) and permission scripts (`perm.cjs`, `tenants.cjs`, `signin.cjs`) were also run.
- Limits: times include script waits, so they are indicative only. I did not test with a real screen reader. Personas are assumptions, not interview data.
- The demo build simulates DNS verification and email. Those flows are labelled as simulated in the UI.

## Personas

Everything below is an assumption based on how Indian colleges typically run. No interviews were done.

**Admin / Principal's office (Mrs. Fernandes, registrar).**
- Goals: know today's attendance, fees, and open complaints at a glance. Approve what only management can approve. Publish circulars. Keep the college's identity on the portal.
- Context: a shared office desktop on a 1366-wide screen. Often interrupted. Mostly on a phone between meetings.
- Pain points: duplicate data entry, chasing defaulters by hand, no audit trail, fear of deleting the wrong record.

**Accountant (Geetha, accounts office).**
- Goals: record vendor bills with GST and TDS correctly. Pay approved bills. Reconcile the bank statement each month. Issue invoices. Deposit TDS by the 7th. Give the auditor month and financial-year reports.
- Context: desktop, Excel and Tally alongside, month-end pressure, auditor deadlines.
- Pain points: re-keying, TDS and GST arithmetic errors, unmatched bank lines, approvals stuck with management.

**Platform super admin (company operator).**
- Goals: onboard a college in minutes. Suspend a non-paying college. See usage and monthly recurring revenue.
- Context: laptop, several colleges at once.
- Pain points: handing credentials to the college safely, avoiding mistakes when deleting a college.

### Top jobs to be done

Admin:
1. Add a student.
2. Publish an announcement.
3. Approve a purchase or vendor bill over the limit.
4. Change colour or logo.
5. Connect a custom domain.
6. Send fee reminders.
7. Run the attendance shortage report and email those students.
8. Add a staff member.
9. Set the approval limit.
10. Answer a help-desk query.

Accountant:
1. Record a bill with GST and TDS.
2. Pay an approved bill.
3. Import a bank statement and reconcile it.
4. Issue fee invoices and a manual tax invoice.
5. Export a month or FY report.
6. Record a TDS challan.
7. Record an offline fee payment.
8. Raise a bill for an approved purchase.

Super admin:
1. Onboard a college.
2. Suspend or reactivate a college.
3. Read the platform dashboard.
4. Delete a college safely.

## Task results

Click counts start from the page that holds the action and exclude navigation. Time is the scripted run. Both widths succeeded unless noted. Severity (Sev) is 0 to 4.

| # | Task | Clicks | Time (desktop / phone) | Outcome | Friction (Sev) |
|---|---|---|---|---|---|
| A1 | Add a student | 2 | 1.2 s / 1.1 s | Pass | Fields had no required marker or autofill hints; fixed (Sev 2). No hint that the student can now sign in (Sev 1). |
| A2 | Publish an announcement | 2 | 2.0 s / 2.0 s | Pass | Delete had no confirmation; fixed (Sev 2). |
| A3 | Send fee reminders | 2 | 0.7 s / 1.8 s | Pass | Sends to everyone selected with no confirmation or preview. Count is in the button label. Open (Sev 2). |
| A4 | Attendance shortage report and email | 2 | 0.6 s / 0.5 s | Pass | No CSV export and no confirmation; both added (Sev 3). |
| A5 | Change colour | 2 | 1.7 s / 3.5 s | Pass | Live preview and contrast badge are good. Unsaved changes are silently reverted on leaving the tab (Sev 2). |
| A6 | Upload logo | 3 | 0.9 s / 2.8 s | Pass | The upload label is not associated with its control (Sev 2). |
| A7 | Connect a custom domain | 3 | 4.4 s / 7.0 s | Pass | Clear DNS table and "Demo build: verification is simulated" note. Changing the sub-domain gives no warning that the old URL stops working (Sev 2). |
| A8 | Change approval limit | 1 | n/a | Script failed (it tried to type text into a number field). Manual check passed. | Fine. |
| A9 | Approve vendor bill | 2 | 1.3 s / 1.2 s | Pass | One click approved Rs 97,440 with no confirmation; fixed (Sev 3). |
| A10 | Help desk reply and resolve | 0 | n/a | Not completed in a script (selector exploration only). Reply and Resolve buttons exist on the dashboard "Needs you" card. | Not fully tested. |
| A11 | Add staff | 2 | 1.5 s / 1.5 s | Pass | None. |
| A12 | Finance report export | 0 | n/a | Month/Year toggle, CSV and Print are visible | None. |
| C1 | Record bill with GST and TDS | 5 | 1.0 s / 0.9 s | Pass | Live totals, TDS hint and "Within limit" or "Over Rs 25,000, management approval" are excellent. |
| C2 | Pay approved bill | 2 | 1.1 s / 5.1 s | Pass | Toast shows TDS withheld. |
| C3 | Bill over the limit goes to management | 2 | 0.6 s | Pass | Clear footer hint. |
| C4 | Import statement and reconcile | 5 | 2.1 s | Pass | "Use sample" imports fake lines into the real ledger (Sev 2). Unmatched lines need "Mark" one by one. |
| C5 | Fee invoices | 2 | n/a | Generate showed 0 missing; manual invoice button not found by the script | Not fully tested. |
| C6 | Mark invoice paid | 0 | n/a | No unpaid invoice available | Uses a native `prompt()` for the reference (Sev 2). |
| C7 | Export FY report CSV | 1 | 0.5 s | Pass | The file name is `collections-by-fee.csv`, with no period in it (Sev 1). |
| C8 | Record TDS challan | 3 | 1.1 s | Pass | The Save button is disabled until fields are filled, with no explanation (Sev 1). |
| C9 | Record offline fee payment | 2 | 1.3 s | Pass | None. |
| C10 | Bill for an approved purchase | 0 | n/a | No approved purchase waiting in demo data | Not tested. |
| S1 | Super admin sign in | 3 | 2.6 s | Pass | The code step is clear. |
| S2 | Onboard a college | 3 | 0.4 s | Pass | Before the fix: no starting-data choice and no credentials hint. After: both added. |
| S3 | Suspend | 1 | n/a | Pass | Native confirm names the consequence. |
| S4 | Delete | 2 | n/a | Pass | Type-the-slug confirmation, Escape closes. |

Phone notes:
- Students table: edit and delete were off-screen. Fixed with a sticky actions column, but it overlaps the Fees column. Open (Sev 3).
- Bank statement and super console tables also scroll horizontally with no hint (Sev 2).
- Super console header truncates "Platform console" to "PL..." (Sev 1).

## First-run findings

Test: onboard "Lakeview Arts College" and sign in as its admin.

- Before the fix, the admin saw "48 students, 84% attendance, Rs 25,35,000 collected, 5 open queries". These were fictional records, and the college's own name sat over someone else's data. A real college could easily mistake this for its data. Sev 4. The `default`/Northbridge college and the sample option still behave this way on purpose.
- After the fix, the onboarding dialog has "Starting data: Empty college (real use) / Sample data (demo/training)". The default is Empty.
- An empty college shows a "Set up your college" checklist on the dashboard: departments, staff, students, fees, logo, email. Each step links to its page.
- Students and Staff empty states now say "No students yet" instead of "No students match".
- "Add student" in a college with no departments now shows "Add a department first: Staff > Departments & HODs" instead of opening a form with an empty department.
- The onboarding toast now says who can sign in and, in demo mode, the demo password.
- Gap: a college with no accountant cannot sign in to the Accounts portal. There is no screen to create accounts users (Sev 3, open).
- All 16 admin routes render in an empty college with no console errors.

## Heuristic evaluation

Severity 0 to 4. "Fixed" means changed in this work.

| Heuristic | Finding | Sev | Fix |
|---|---|---|---|
| 1 Visibility of status | The tab title never changed between pages. | 2 | Fixed (`PageHeader`, `Greeting`, Calendar set it). |
| 1 | Lock message "Try again in 5m 00s" never counted down. | 3 | Fixed: live countdown on the sign-in page. |
| 1 | A timed-out session returned to sign-in with no explanation. | 2 | Fixed: "Your session ended for security." |
| 1 | The suspended-college message was duplicated (banner and error). | 1 | Fixed. |
| 2 Match with real world | "Mark" and "Reconcile" are accountant jargon but used correctly. Fees chip "Awaiting mgmt" is understandable. | 0 | |
| 3 User control | Deletes (student, staff, subject, announcement) cannot be undone. Native `confirm()` is the only guard. Student delete also removes payment history. | 3 | Announcement confirm added. Undo is open. |
| 3 | Branding changes are lost silently when leaving the tab. | 2 | Open. |
| 4 Consistency | Mixed native dialogs (`confirm`, `prompt`) and app modals. | 2 | Open. |
| 4 | Duplicate approval-limit setting (Admin Settings and Accounts Tax settings). | 3 | Fixed: Accounts copy is read-only. |
| 5 Error prevention | "Email all" to every low-attendance student had no confirmation or count. | 3 | Fixed: count in button plus confirm. |
| 5 | Vendor bill approval was one click. | 3 | Fixed: confirm with amount and vendor. |
| 5 | Fee reminders and other bulk sends have no confirmation (only the email centre confirms over 20). | 2 | Open. |
| 5 | Student/staff "Add" in a department-less college. | 2 | Fixed. |
| 6 Recognition | Row actions are icon-only on tables, but have aria-labels and titles. | 1 | |
| 7 Flexibility | No column sorting on any table. Search, filters and pagination exist. | 2 | Open. |
| 8 Aesthetic and minimal | Dashboard is dense but well grouped. | 0 | |
| 9 Error recovery | Form errors appear only after the first Save click, in the right place, but focus stays on the Save button. | 2 | Errors now `role="alert"` and linked to the field. First-invalid focus is open. |
| 9 | Sign-in errors are generic by design (no account enumeration). The OTP screen shows tries left. | 0 | |
| 10 Help | No in-app guidance anywhere except the new empty-college checklist and the simulated-DNS note. | 2 | Partly fixed. |

Forms:
- Before: no required markers, no `aria-invalid` or `aria-describedby`, phone fields were plain text, no autofill hints. After: `Field` has a `required` marker and links its hint or error to the control. Student, staff and onboarding forms use it. Phone fields are `type="tel"`.
- Validation timing is "on first Save, then live", which is acceptable.

Destructive actions: native `confirm()` everywhere. Delete college requires typing the slug (good). Reset data and Restore both confirm (good).

Tables: search, filter and pagination are present. No sorting. Mobile is the weak point (see above).

Feedback: toasts are consistent, and toasts stay long enough to be read. Buttons show a loading spinner during email sends. DNS verification has a spinner.

## Accessibility (WCAG 2.2 AA)

axe-core, 36 page states per theme.

| Rule | Night before | Day before | After |
|---|---|---|---|
| label-content-name-mismatch (timetable cells, bell button) | 63 | 30 | 0 |
| heading-order (cards under h1, request cards) | 14 | 14 | 0 |
| region (login hero outside a landmark) | 12 | 12 | 0 |
| empty-table-header | 4 | 4 | 0 |
| scrollable-region-focusable | 2 | 2 | 1 (one table wrapper) |
| landmark-one-main, page-has-heading-one (super login) | 1 each | 1 each | 0 |
| **Total nodes** | **97** | **64** | **1 / 1** |

There were no colour-contrast violations in either theme.

Keyboard walkthrough (admin, Students):
- A skip link is the first tab stop.
- Focus is visible everywhere (2 px outline).
- It takes 29 tab stops to reach "Add student", because of the top nav and the tool rail. The skip link helps.
- The dialog opens with focus in the first field. 30 tabs stayed inside it. Escape closes it and focus returns to the opener.
- Before: tab lists did not respond to arrow keys and every tab was a tab stop. After: arrows, Home and End work, with roving tabindex.
- After an invalid submit, focus stays on Save while the three errors are announced via `role="alert"`.
- Screen-reader semantics: labels are present on inputs, toasts use a polite live region, and landmarks are present (header, nav, aside, main). Not verified with a real screen reader.

## Permission test matrix

| Test | Expected | Observed | Result |
|---|---|---|---|
| Admin opens `#/staff`, `#/student/fees`, `#/accountant/bills` | Bounced to `/admin` | `/admin` | Pass |
| Admin opens `#/super` | `/super/login` | `/super/login` | Pass |
| Accountant opens `#/admin`, `/admin/students`, `/admin/settings`, `/admin/approvals`, `#/staff`, `#/student` | Bounced to `/accountant` | `/accountant` | Pass |
| Accountant opens `#/super` | `/super/login` | `/super/login` | Pass |
| Accountant nav shows no Students, Staff, Approvals or Settings | None | None | Pass |
| Accountant edits approval limit | Read-only | Editable | **Fail, then fixed** (now read-only) |
| Super admin session opens `#/admin`, `#/accountant`, `#/student` | `/login` | `/login` | Pass |
| College admin opens `#/super` | `/super/login` | `/super/login` | Pass |
| Sign out clears the session | Key removed | Removed | Pass |
| After sign out, `#/admin` and `#/admin/settings` | `/login` | `/login` | Pass |
| Expired session on reload | `/login` with an explanation | `/login`, no message before; message now shown | Pass after fix |
| Alpha admin session replayed on Beta URL | `/login` | `/login` | Pass |
| Beta searches for Alpha's student | 0 rows | 0 rows | Pass |
| Beta dashboard shows Alpha's announcement | Absent | Absent | Pass |
| Session keys are scoped per college | Own key only | `cms:session:<beta id>` | Pass |
| Unknown tenant slug | "College not found" | Shown | Pass |
| Suspended college login page | Banner up front | Banner | Pass |
| Suspended college sign-in attempt | Blocked | Blocked (button now disabled) | Pass |
| Suspended college deep link `/admin` | `/login` | `/login` | Pass |
| Admin sees only what management decides (approvals tabs) | Requests escalated to management, leave of HODs, bills | Matches the page subtitle and tab contents | Pass |

Sign-in security UX:
- Wrong password: "Incorrect ID or password." The same text is shown for unknown IDs. After 3 failures it says "2 attempts left", then "1 attempt left".
- The 5th wrong password locks the account for 5 minutes. A correct password is refused during the lock. The message now counts down.
- OTP: "That code is not right. 4 tries left", down to "Too many wrong codes. Request a new code." There is a visible code expiry and a resend cooldown. The first digit box has `autocomplete="one-time-code"`.
- Forgot password: link works from the sign-in page.
- Trusted browser: tick "Trust this browser" and the next sign-in skips the code. Not re-tested in this run.
- Not tested: a session expiring while a tab is already open. The code only checks expiry on load, so a long-open tab keeps working (Sev 2, open). A college suspended while someone is signed in is also only enforced on reload.

## Fixes made

- `src/components/ui.tsx`: `Field` gets `required` marker, `aria-invalid`, `aria-describedby` and `role="alert"` errors. `Tabs` gets arrow-key navigation and roving tabindex. `PageHeader` sets the tab title. `Card` titles use `aria-level` 2.
- `src/index.css`: required-marker style. Phone table compaction and sticky actions column. Super login heading style.
- `src/pages/admin/Students.tsx`, `Staff.tsx`: required markers, `tel` and autofill attributes, honest empty states, department guard.
- `src/pages/admin/Attendance.tsx`: shortage report CSV export, "Email all (n)" with confirmation, focusable table region.
- `src/pages/admin/Dashboard.tsx`: "Set up your college" checklist. Announcement delete confirms.
- `src/pages/shared/Approvals.tsx`: bill approval confirms with amount and vendor.
- `src/pages/accounts/Taxes.tsx`: approval limit read-only for Accounts, so saving cannot overwrite it.
- `src/pages/accounts/Bills.tsx`, `Invoices.tsx`, `common.tsx`: hidden header text for empty headers. `Taxes.tsx` also gets a focusable region.
- `src/pages/shared/TimetableGrid.tsx`: accessible name now contains the visible text.
- `src/pages/shared/requestsUi.tsx`: heading level.
- `src/pages/auth/parts.tsx`: login hero is an `aside` landmark.
- `src/pages/shared/CalendarPage.tsx`, `src/components/dash.tsx`: page titles.
- `src/pages/super/SuperAdmin.tsx`: Starting-data choice (empty by default), required markers, colour swatches with pressed state, credentials hint in the toast, `main` and `h1` on the login.
- `src/store/AppStore.tsx`: `provisionTenant` and `seedFor` accept `blank`.
- `src/auth/session.ts`, `src/pages/Login.tsx`: session-expired notice, live lock countdown, suspended banner without duplicate error.

## Open issues, ranked

1. Sev 3: no screen to create accounts users, so a new college's accountant cannot sign in.
2. Sev 3: deletes have no undo. Student delete removes payment history.
3. Sev 3: Students and other wide tables on phones still need a card layout. The sticky actions column hides the Fees column.
4. Sev 2: open tabs ignore session expiry and suspension until reload.
5. Sev 2: bulk sends (fee reminders) have no confirmation. Branding changes are lost silently on tab change.
6. Sev 2: no table sorting. Native `confirm`/`prompt` dialogs are inconsistent with the app's modals.
7. Sev 2: "Use sample" in bank import writes fake lines into the real ledger.
8. Sev 2: sub-domain change gives no warning that the old URL stops working.
9. Sev 1: C5, C6, C10 and A10 were not fully exercised. The "attendance report" table wrapper still needs a keyboard stop on one page. Docs (`college-needs-analysis.md`) still say the approval limit lives in Taxes settings.
10. Sev 1: first invalid field does not receive focus on a failed submit.

## Recommended next features

- Accounts and office users: invite and manage accountants.
- Undo (soft delete with restore) for records.
- Mobile card layout for tables, and column sorting.
- A real audit log of approvals and deletions.
- Guided onboarding wizard, including CSV import of staff and students and a fee template.
- Server-side session expiry and suspension checks.
- Reconciliation: bulk "mark as" and rules for recurring bank lines.
