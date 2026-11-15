# Product review: design, UX research and market needs

**Date:** 15 November 2026 · **Scope:** the whole product (admin, staff and HOD, student, accountant, platform super admin) · **Status:** front-end prototype

This is the combined result of four independent reviews run against the working application:

| Reviewer | Document | What they did |
|---|---|---|
| Product designer | [product-design.md](research/product-design.md) | Measured the contrast of every colour in both themes and with 16 brand colours; researched colour guidance; reviewed visual consistency; fixed what failed |
| UX researcher (admin, accounts, platform) | [ux-admin-accounts.md](research/ux-admin-accounts.md) | Personas, top tasks run end to end on desktop and phone, heuristics, accessibility, permission tests, first-run experience; fixed what broke |
| UX researcher (staff, HOD, student) | [ux-staff-student.md](research/ux-staff-student.md) | Same, plus multi-person flows (request → HOD → requester) and 24 role/permission tests |
| Market needs manager | [market-needs.md](research/market-needs.md) | Indian college software landscape, regulation, needs-to-product mapping, demo test, prioritised roadmap, pricing review |

Everything below is traceable to those documents or to a test that was run. Where something could not be verified, it says so (section 9).

---

## 1. Executive summary

**The product works end to end for every role.** All main tasks were completed in a real browser in 2 to 5 clicks on desktop and on a phone. Role guards, department scoping, chat policy and anonymous complaints held up in every permission test (24 staff/student tests, plus the admin/accounts matrix). People who need to know about something are told, live.

**It is not yet something a college can buy.** It is a front-end prototype: data, sign-in, one-time codes, payments, domain certificates and role enforcement live in or are simulated by the browser. A buyer's first questions ("where is our data, who can see it, is there an audit log, can I pay fees online for real") cannot be answered yet. [Backend plan](backend-plan.md) covers it; the market review ranks it first.

**What the reviews changed in the product** (details in section 2):

- **Colour and contrast:** text-contrast failures went from **54 to 0** on the default colour and from **401 to 0** across 16 brand colours, in both themes. The colour picker now shows measured contrast and suggests a safe alternative.
- **A new college no longer starts as a copy of the demo college.** It starts empty with a setup checklist.
- **Segregation of duties:** Accounts can no longer change the approval limit that controls it; management can now add and remove accounts users.
- **Accessibility:** automated violations dropped from 97 to 1 (admin, Night) and from 66 of 66 page-runs to 0 of 66 (staff/student). Dialogs, tabs, skip link, focus handling, touch targets and page titles were fixed.
- **Money safety:** confirmations on bulk sends and payment approvals; money figures no longer count up through wrong values.

**Where the market review says to go:** start with private self-financing affiliated arts and science colleges, lead with the accounts office plus HOD approvals (not "another college ERP"), and build in this order: backend and trust → payments and fees (concessions, instalments, parents) → academics and accreditation (marks, exams, NAAC/NIRF).

---

## 2. What changed in the code because of the reviews

### Colour and visual design
| Change | Where |
|---|---|
| Every derived colour role now guarantees contrast (accent as text, accent as shape, on-colour text, deep variants for gradients); pale and near-black brands are handled | `src/lib/theme.ts`, `src/lib/color.ts`, `src/index.css` |
| Colour picker shows button-text, Day-page and Night-page contrast live and offers "use suggested" for near-black and very pale colours | `src/components/ColorPicker.tsx` |
| Input and secondary-button borders darkened to pass 3:1 (night 3.49 → 5.38, day 3.04 → 4.55 on white) | `src/index.css` |
| Black removed from the presets (it is invisible on the Night page); **Crimson `#cf2541`** replaces it and is now the default for new colleges; a mid-tone preset row added | `src/lib/theme.ts` |
| Event cards: framed panel with a curved notch holding the date, filled with a primary-colour gradient that stays readable on any brand colour | `src/pages/shared/EventsBoard.tsx`, `src/index.css` |
| KPI figures no longer wrap mid-number; clipped "WORKSHOP" label fixed; opaque sticky table column on phones; tab-bar indicator clipped at the screen edge | `src/index.css` |

### Admin, accounts and platform
| Change | Severity found |
|---|---|
| New colleges start **empty** (with a "Sample data" option) and show a "Set up your college" checklist | 4 |
| Purchase approval limit is read-only for Accounts (management owns it) | 3 |
| **Accounts team** screen: management adds, deactivates and reactivates accounts users (a new college had no way to create one) | 3 |
| Confirmations added for "Email all" (low attendance), announcement delete and vendor-bill approval; CSV export of the low-attendance report | 2–3 |
| Lockout message counts down; expired-session explanation; duplicate suspended-college message removed | 2 |
| Required markers and linked error text on every form field; phone fields use the telephone input | 2 |
| Tabs respond to arrow keys; page titles change per page; the platform sign-in heading is now an `h1` | 2 |

### Staff, HOD and student
| Change |
|---|
| Mobile tab bar highlights **More** (not Home) on pages under More |
| Notification bell: "Mark all read" and per-item read state that survives reload |
| Phone and guardian phone validated |
| HOD Approvals opens on the first tab that has work waiting |
| Mark attendance: second Save at the bottom, red "Replace record" when it would overwrite another subject's record, proper toggle semantics |
| "My students": "Below 75%" filter; phone numbers are tap-to-call |
| Student timetable: a Today / Next teaching day list above the grid |
| Skip link and `<main>` landmark; dialogs return focus to the button that opened them; 44px touch targets; chart and progress accessible names |

### Sign-in (found while consolidating)
| Change |
|---|
| Sign-in opens on the **role last used** in this browser instead of always on Admin |
| Forgot password accepts an **email, roll number or employee ID** (students sign in with a roll number) and mails the address on file; unknown IDs get the same answer and send nothing |

### Market-review copy fixes
Plan labels now read "up to 3,000 students"; the over-limit note and revenue tile ("per month") are clearer; the GST note no longer claims all education fees are exempt.

---

## 3. Test results (final run, this commit)

_The final full run is in progress as this commit is made; the exact numbers are added in the next commit. Last confirmed results before it started: functional suite 62/62 at 1440, 768 and 375px; responsive audit 263 combinations with 0 problems; 35 unit tests; lint and type-check clean._

How to run: `npm run check` (type-check, lint, unit tests) and the browser suites described in the README. Browser tests use a preload that switches the one-time code off for the default college so scripted logins stay simple; the real code flow is covered separately by the auth suite.

---

## 4. Colour research and recommendations

Full detail, tables and sources: [product-design.md](research/product-design.md).

**Findings**
- The structural causes of failures were: text coloured with a token that is only 60% opaque in Day mode; white text on gradients built from the raw brand colour (fails on yellow, white, mint); the accent used as a *shape* against the near-black Night page (Burgundy is 1.67:1 there); and input/secondary-button borders under 3:1.
- Standards applied: WCAG 2.2 text contrast (4.5:1, 3:1 large), non-text contrast (3:1 for controls and meaningful graphics), and "colour is never the only signal".
- **Colour psychology is weak evidence and the review says so.** The claim that red impairs test performance did not survive a 2020 meta-analysis; no good evidence was found that a particular hue improves learning, trust in a finance product or adoption. Choose colour for legibility, hierarchy and the college's own identity.
- India: saffron, white, green and red carry strong national, religious and festive associations that vary by region; treat as a caution when proposing defaults, not as a rule.

**Recommendations**
1. Keep the default Burgundy for identity; offer Crimson as the brighter "red" option (done).
2. The picker warns but never blocks: a college has the right to use its logo colour, and the app adapts around it (done).
3. Derive the secondary colour more calmly: the current +32° hue shift gives a vivid orange next to burgundy; cap its chroma at about 70% of the primary's, or default to the "mono" harmony (open).
4. Semantic colours (ok/warn/danger/info) must always pair with an icon or label (partly done; needs a colour-vision-deficiency simulation, not yet run).
5. The mid-tone presets were chosen by contrast calculation and have **not** been reviewed by a designer or simulated for colour blindness.

---

## 5. Role-by-role findings

| Role | Tasks run | Permission tests | Fixed in this round | Biggest open issues |
|---|---|---|---|---|
| **Admin** | add student, announce, approve over-limit purchase, branding, custom domain, reminders, attendance report | pass (all rows) | empty first run, confirmations, forms, accessibility | no undo for deletes; wide tables on phones need a card layout; no table sorting |
| **Platform super admin** | onboard, suspend, delete a college | pass (suspended college cannot sign in; colleges isolated) | sign-in messages, onboarding default | open tabs ignore suspension until reload |
| **Accountant** | record bill (GST/TDS), pay, invoice, bank import and reconcile, TDS challan, FY export | pass after the approval-limit fix | read-only limit, bill-approval confirmation, accounts-team screen | "Use sample" in bank import writes fake lines into the real ledger; no bulk reconcile rules |
| **Staff / HOD** | mark attendance, below-75% list, leave, repair request, class chat, approvals | 24/24 pass | attendance semantics and second Save, approvals landing tab, below-75% filter | teachers see every student's phone numbers; attendance defaults to everyone Present |
| **Student** | timetable, attendance, pay a fee and receipt, event apply, anonymous complaint, profile change, chat | pass | tab-bar highlight, phone validation, Today list, notification read state | anonymous complaints still store the sender in the data layer (a backend must strip it) |

All research notes are labelled: personas are assumptions informed by common Indian college practice, and timings are scripted browser times, not human times.

---

## 6. Market needs

Full detail, sources and the RICE scoring: [market-needs.md](research/market-needs.md).

**Honest limits.** The reviewer could run web searches but could not open competitor websites (blocked), so competitor facts come from search-result summaries and are labelled that way. **No citable Indian college-software price, review quote or rupee market size was found; the document says "unknown" in those places.**

**Positioning (a hypothesis to test in customer interviews):** "the white-label college portal that puts fee collection, HOD approvals and GST/TDS-ready accounts in one place under the college's own name and domain." Start with private self-financing **affiliated arts and science colleges** (the university runs their exams, so no marks engine is needed); engineering and autonomous colleges follow once marks and accreditation packs exist.

**Roadmap (RICE, from the market review; scores are judgement, not measurement)**

| Release | Theme | Contents |
|---|---|---|
| 1 | **Trust and money** | Backend, real authentication, audit log, backups, India data location; real payment gateway with webhooks; DPDP kit (consent log, retention, requests, breach register); Tally export |
| 2 | **Fees and families** | Concessions, scholarships and instalments; parent portal with DLT-registered SMS/WhatsApp; confidential anti-ragging/ICC case workflow; APAAR/ABC fields |
| 3 | **Academics and accreditation** | Marks and results; exam cell; NAAC/NIRF/AISHE data packs; CO-PO attainment for engineering |
| Later | | Payroll, admissions, library/hostel/transport (partners) |

**Pricing review (current plans: ₹4,999 / ₹14,999 / ₹39,999 per month for up to 500 / 3,000 / unlimited students).** The plans cannot be benchmarked. The structure has two weaknesses: plans differ only by student cap, and a college with 520 students pays three times the Starter price. Tie Enterprise to features (single sign-on, audit export, data-residency options, priority support, multiple campuses) and test per-student-per-year pricing with a floor equal to Starter at two or three pilot colleges before fixing numbers. Prices are unchanged in code.

**Compare honestly:** established vendors are clearly stronger on production maturity, exams and results, accreditation tooling and installed base. The product's unusual strength is accounts-office depth; competitors may offer similar finance features that could not be verified.

---

## 7. Corrections and things the reviews got wrong or half-right

These were investigated, and the record should say what turned out to be false.

1. **"Four screens show four different totals" was not a data bug.** The figures were captured while KPI numbers were still counting up. After the animation, the dashboard, Fees page, admin Finance and accountant Reports all show exactly ₹25,35,000 (the sum of the 39 successful payments). The real problem was that money passed through never-true values while animating, so **money is no longer animated** (counts and percentages still animate; reduced-motion users see everything at once). The market report was corrected and its top roadmap item withdrawn.
2. **Intermittent 375px test failures were not flakiness.** Two event tests failed on every run on the "new dialogs + old card layout" build and passed on the builds before and after. Root cause: with smooth scrolling on, the browser could leave a button hidden behind the fixed tab bar, so the button kept "moving" and could not be clicked. Real accessibility gap (keyboard focus could be obscured by the fixed bars, WCAG 2.2 "Focus Not Obscured"); fixed with scroll padding for the header and tab bar.
3. **A bug I introduced and then caught:** in a newly provisioned college, `admin@college.edu` (the seed address) could start an admin sign-in. Now only that college's own admin email works; a functional test failed on it, so it is covered.
4. **Test expectations that went stale on purpose:** page titles are now per-page ("Overview · College"), the platform sign-in heading is an `h1`, payment approval asks for confirmation, and the red "Replace record" button appears on attendance conflicts. Tests were updated; behaviour is the intended improvement.
5. **A responsive finding that was real but harmless:** the tab-bar indicator briefly overshoots the screen edge while it glides. Clipped at the edge so it can never extend past the screen.

---

## 8. Consolidated open issues (ranked)

**Security and privacy (need the backend)**
1. Anonymous complaints keep the real sender in the stored record. The server must strip it and audit any re-identification.
2. Teachers see every student's phone and guardian phone on "My students". Show on demand and log access (DPDP purpose limitation).
3. Accounts, sessions, codes and payments live in browser storage; anyone with the browser profile can read or change them.
4. Open tabs ignore session expiry and college suspension until reload.
5. No audit log of approvals, deletions and permission changes.

**Correctness and data safety**
6. Deletes have no undo; deleting a student also deletes their payment history. Use soft delete with restore.
7. "Use sample" in bank import writes fake lines into the real ledger.
8. Other-income invoices count GST as income instead of a liability; no TDS threshold or no-PAN 20% rate; invoice numbers follow the calendar year rather than April–March (from the accountant review in the previous round).
9. Changing the sub-domain gives no warning that the old address stops working.
10. Overwriting another subject's attendance still succeeds after the red warning; consider a second confirmation.

**Usability**
11. Wide tables on phones (Students, fees) still need a card layout; the sticky actions column hides a column.
12. No table sorting or column choice; native `confirm` dialogs are inconsistent with the app's own dialogs.
13. Attendance defaults to everyone Present and shows a roster even on days with no class.
14. First invalid field does not receive focus on a failed submit; reject buttons are disabled without a visible reason; Approvals tab strip clips on a phone.
15. Students see four stat tiles before their first ticket on a phone; very-low-attendance advice ("attend the next 46 classes") is correct but discouraging, so show it per subject.

**Design**
16. Secondary colour derivation is louder than the brand; mid-tone presets need designer review and a colour-vision simulation.
17. 18 distinct font sizes; no type-scale or radius tokens; some tap targets under 32px remain.

**Market**
18. Marks/results, exam cell, parent alerts, NAAC/NIRF packs, concessions and instalments, anti-ragging case workflow, Tally export and payroll are not built (see roadmap).
19. Plan pricing has no evidence base; test before changing.

---

## 9. What was not verified

- **No real users, screen reader or phone.** All UX results come from automated browsers and heuristic review; personas are assumptions; times are scripted.
- **Colour:** the audit sampled seeded demo data; modals, toasts in transit and the super admin console were not scanned. WCAG pages on w3.org could not be fetched, so the standards are cited from search summaries.
- **Market:** competitor facts are second-hand (vendor sites were unreachable); no prices, reviews or market sizes were citable. Regulation and tax statements (POSH/ICC duties, GST on education, TDS) are marked "from memory" or "ask a CA" and must be checked by a professional.
- **Real HTTPS certificates, DNS and a deployed server:** custom-domain behaviour was tested on real `https://` origins served by the test browser, not on a deployed host.
- A few admin tasks (A10, C5, C6, C10) were not fully exercised because the scripts missed the controls or the demo data had nothing to act on.

---

## 10. Recommended next steps

1. **Start the backend** (`docs/backend-plan.md`): tenancy with row-level security, server-side auth and sessions, audit log. Most of the open security items disappear with it.
2. **Run five customer interviews** with principals and accounts heads at private affiliated colleges to test the positioning and the pricing structure before changing either.
3. **Soft delete with restore, a card layout for tables on phones, and table sorting**: the three most-reported usability gaps.
4. **Designer pass on colour**: review the mid-tone presets, simulate colour-vision deficiencies on status colours and charts, and calm the secondary colour.
5. **Integrate a payment gateway and add concessions and instalments** once the backend exists.

---

### Document index
- `docs/product-review.md` (this file)
- `docs/research/product-design.md`, `ux-admin-accounts.md`, `ux-staff-student.md`, `market-needs.md`
- `docs/backend-plan.md`, `docs/auth.md`, `docs/college-needs-analysis.md`
