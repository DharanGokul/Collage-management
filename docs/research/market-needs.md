# Market needs review: does this product meet what Indian colleges need?

Prepared 14 Nov 2026 by the market needs manager role. Every external claim carries a source number [S#] that maps to the source list at the end. The date seen for every source is 2026-11-14.

## 1. Executive summary

1. **Where the product is strong.** It already covers the day-to-day running of a self-financing college unusually well for a prototype: four role portals, HOD approvals, fee collection with late fees, attendance with the 75% rule, timetable clash detection, a help desk with anonymous complaints, and an accounts module (GST/TDS bills, bank reconciliation, FY reports). Of the products I could verify, this accounts-office depth is the least common feature among college-focused ERPs, but I could not prove competitors lack it (see section 2).
2. **Where it is not yet sellable.** It is a front-end prototype. Data lives in browser storage, payment, email, SMS, custom-domain TLS and role enforcement are simulated or UI-only, and there is no audit log, no backup service and no stated data location. A buyer who asks "where is our data and who can see it" cannot be answered today. The DPDP Rules were notified on 14 Nov 2025 and most duties apply about 18 months later (about May 2027) [S12, secondary sources], so that question will be asked in every serious sale.
3. **Biggest product gaps against demand.** Marks/results and exam cell (needed by autonomous and engineering colleges, much less by affiliated colleges whose university runs exams), parent portal with DLT-registered SMS/WhatsApp, scholarships/instalments, NAAC/NIRF/AISHE data packs, ABC/APAAR support, a confidential anti-ragging/ICC case workflow, Tally export, payroll.
4. **Recommended order.** Release 1 "Trust": backend, real authentication, audit log, real payment gateway, DPDP kit, fix demo data consistency. Release 2 "Fees and families": concessions/instalments, parent portal with SMS/WhatsApp, ICC/anti-ragging workflow, ABC/APAAR fields, Tally export. Release 3 "Academics and accreditation": marks and results, exam cell, NAAC/NIRF/AISHE packs.
5. **Go-to-market.** Start with private self-financing affiliated arts and science colleges (fee, attendance and accounts pain, no need for a marks engine), then engineering and autonomous colleges once marks and accreditation packs ship. Lead with the accounts-office and HOD-approval story, not "a college ERP".
6. **Pricing.** I could not find any citable Indian college-ERP price, so I cannot say the three plans are "right". I can say the structure has two weaknesses: plans differ only by student cap (no feature or support difference), and the jump from 500 to 3,000 students triples the price. Recommendations are in section 9.
7. **Fixes made in code now** (copy only): plan names in the onboarding form now read "up to 3,000 students" and "unlimited students"; the over-limit warning reads "over the 500-student limit"; the revenue tile says "per month"; the Taxes note no longer says all education fees are exempt from GST.

## 2. Method and limits (read before trusting any claim)

- **What worked.** WebSearch returned result lists and short summaries. I ran about 22 searches. The app was read from code and docs and run in a real browser (Chromium via Playwright) on a local dev server with demo data.
- **What did not.** WebFetch could not open vendor sites (teachmint.com, camu.in, mastersofterp.in, entab.in, creatrixcampus.com, fedena.com all failed DNS: the session network allowlist blocks them). So **I did not read any vendor pricing page or product page directly**. Competitor facts below come from search-result summaries of vendor pages and directories (Capterra, GetApp, SoftwareAdvice, Techjockey), and are labelled "search summary, page not opened". Primary government documents (naac.gov.in, nirfindia.org, ugc.gov.in, meity.gov.in, pib.gov.in) were also seen only as search results or snippets, not opened. Anything I cite as a date or number from them should be checked against the gazette or PDF.
- **No reviews were verified.** The Camu review search returned nothing relevant. I found no first-hand principal or registrar survey. Section 4 persona complaints therefore combine a few cited academic and vendor-blog themes with my own inference, and I label which is which.
- **Not verifiable, said plainly:** any competitor price in rupees for a full college deployment; market size in rupees; Indian college-ERP adoption rate (one promotional blog says under 0.5%, unverified [S19]); NAAC accreditation counts under the new framework; Entab, Quick eSchool and Classter college coverage beyond what is noted.
- **From memory, unverified** is used where I rely on prior knowledge: DLT SMS rules, the POSH Act ICC duty, the GST exemption wording for recognised qualifications, TDS section behaviour.
- **Browser testing scope.** I loaded and read every main page of the Admin, Accounts, Student and HOD portals (plus the super admin console, onboarding modal, admin Settings tabs, and the student checkout), and checked a phone-width screenshot. I did **not** re-run every interaction (clash detection, CSV bank import, the multi-step approval chain). For those the repo's earlier QA scripts exist, but I treat them as "page present, interaction not re-verified by me" in section 6.

## 3. Market landscape

### 3.1 Size indicators (the only ones I will cite)
- AISHE 2021-22: 1,168 universities and university-level institutions, 45,473 colleges and 12,002 standalone institutions registered; about 4.33 crore (43.3 million) students enrolled; about 15.98 lakh faculty [S1, search summary of the Ministry of Education report, PDF not opened].
- Colleges are the large pool: 45,473 colleges plus 12,002 standalone institutions. A rupee market size is **unknown**; to verify, use a paid research report or compute from a segment list times a cited price, and no cited price exists yet.

### 3.2 Competitors I could verify exist and serve (or may serve) colleges

All entries are search summaries; vendor pages not opened.

| Product | Serves colleges? | What it claims | Deployment | Pricing found | Notes |
|---|---|---|---|---|---|
| MasterSoft (Nagpur) | Yes: universities, affiliated colleges, colleges [S2] | Self-reports 2,000+ institutions; University product (UAIMS) 23+ core modules incl. affiliation, admissions, exams, finance, HR, library, hostel, placement; College ERP 25+ modules; OBE, alumni, payroll integrations [S2] | Cloud or university's own data centre [S2] | None found | Broadest module count; the most direct competitor for affiliated and autonomous colleges |
| Creatrix Campus | Yes: higher education | Admissions, curriculum, timetabling, accreditation (NAAC, NBA, plus international bodies) [S3] | Not verified | None found | Accreditation is a stated strength (vendor claim) |
| Edumerge | Yes | College ERP with separate NAAC and NBA submodules, CO-PO matrices [S3] | Not verified | None found | Shows accreditation tooling is a competitor feature |
| IITMS | Yes: college and university ERP [S2] | Cloud-based College ERP | Cloud | None found | Only the listing seen |
| Teachmint | Lists schools, higher education, coaching [S4] | ERP plus classroom tools; reviews mostly from schools | SaaS | Third-party listing: from $5 per user per year (unverified; "user" unclear); India figure of INR 12,711 per classroom per year from year 2 in a hardware bundle [S4, S20] | Higher-ed depth (credits, affiliation, transcripts) unconfirmed |
| CAMU (Octoze, Chennai) | Higher education digital campus per directory listings [S5] | Not verified in detail | Cloud | Directory shows INR 25 start, billing unit unclear; another listing says N/A [S5] | Cannot be used as a price anchor |
| Fedena | Mainly schools per listings; college use unverified | Listings | SaaS | Conflicting: about $999 to $1,300 per year base, per-feature in one listing [S6] | Weak anchor |
| Classter | Has a college module [S7] | Quote-based by size, users and features [S7] | SaaS | None (quote only) | International, not India-first |
| Zoho Campus | Listed in directories | n/a | SaaS | Techjockey shows "Lite from INR 99, yearly" with the unit unclear [S7] | Weak anchor |
| Quick Campus | Listed | n/a | n/a | Quote-based; last updated Jan 2024 on a directory [S7] | Old |
| Entab | **No evidence**: school ERP (CampusCare), 2,500+ schools self-reported [S8] | School-focused | SaaS | None | Treat as a school vendor, not a college competitor |

**Integrations seen across competitors (self-reported):** payroll, library, alumni, OBE [S2], accreditation dashboards [S3]. No summary I saw mentioned Tally export, GST/TDS bill handling or bank reconciliation; absence from a search summary is **not proof** they lack them. To verify, request a demo or the feature PDF from each vendor.

### 3.3 Deployment and charging patterns
Quote-based pricing is the norm for college products (Classter, Quick Campus, MasterSoft and Creatrix showed no public price) [S2, S3, S7]. That is a positioning opportunity: a published price is itself a differentiator for small private colleges, but only if the price is right and the compliance questions are answered.

## 4. Buyer personas (who decides, what they want)

Evidence level: cited themes are from [S18, S19], a vendor blog, an academic paper abstract and a 2012 case study found in one search; everything else is my inference and marked (inference). Interview 8 to 10 buyers to confirm before committing to the roadmap.

| Persona | Role in the decision | What they want | Pain themes |
|---|---|---|---|
| Trustee / management / secretary | Economic buyer; often the real decider in private colleges (inference) | Fee leakage control, one number for collections, expense control, accreditation score | A first ERP attempt at one Indian institute was dropped for lack of consensus and management communication [S18]; cost rises with each module [S19] |
| Principal | Champion or blocker; accountable for NAAC/NBA/NIRF and student discipline (inference) | NAAC and NIRF data without a scramble, anti-ragging and grievance record, parents satisfied | Staff resistance and training gaps are the cited adoption barriers [S18, S19] |
| Registrar / controller of exams | Owns admissions records and exams in autonomous colleges (inference) | Admissions, marks, results, certificates | Product has no marks or admissions yet |
| Accounts head | Daily user; strong veto on finance data (inference) | Fee receipts, bank reconciliation, GST/TDS, Tally export, audit trail | Wants numbers that agree across screens (see demo test) |
| IT head / admin | Technical gate (inference) | Data location, backups, SSO, uptime, DPDP | Data-security worries are a cited barrier [S18] |
| HOD | User with approval power; adoption driver (inference) | Faculty attendance, approvals, department data | Faculty workload and resistance [S18] |
| Faculty and students | End users | Fast attendance entry, mobile, fee payment, results | Poor usability for non-technical staff is a cited failure cause [S19] |

## 5. Regulation-driven demand

| Driver | What it says (source) | Demand it creates | Product status |
|---|---|---|---|
| **NAAC** | New two-stage model: binary accredited / not accredited, then Maturity-Based Graded Levels 1 to 5; rollout dates reported inconsistently (April-May 2025, later reports differ) [S9] | Evidence and data on staff, students, outcomes, finance | No NAAC data pack |
| **NBA** | Competitors market CO-PO attainment [S3] | CO-PO for engineering | Not built |
| **NIRF** | Colleges framework: TLR 0.40, Research 0.15, Graduation Outcomes 0.25, Outreach 0.10, Perception 0.10; data to be hosted on the college site after submission; 2025 window closed 31 Jan 2025 [S10] | Student strength, faculty-student ratio, faculty qualifications, financial resources use, placement and exam results | Students, staff, finance exist; no export in NIRF format; no results or placement |
| **AISHE** | Annual survey of 45k+ colleges [S1] | Annual data return | Not built |
| **AICTE** | Mandatory disclosure including fee approved by the State Fee Committee, payment schedule and refund policy; state fee regulation varies by state [S11, partly consultant sources] | Fee structure that mirrors approved fee; refund policy | Fee structures and refunds exist; no regulator-approved fee lock or disclosure export |
| **UGC ABC / APAAR / DigiLocker** | UGC directed colleges to upload credit data to the ABC portal (reported deadlines 31 Dec 2024 and 30 Jun 2026); Education Ministry FAQs say APAAR ID itself is not legally mandatory; PIB-style figures: 2,899 HEIs registered and about 4.79 crore APAAR IDs as of 2 Jul 2026; only about 30% of institutions could upload data in one report [S13] | ABC ID field, bulk upload, credit data | Not built |
| **DPDP Act 2023 and Rules 2025** | Rules notified 14 Nov 2025; core obligations apply 18 months after (about May 2027); breach notification duties; a "72-hour" figure appears only in a secondary summary and must be checked against the gazette [S12] | Consent, purpose limitation, retention, breach register, access logs, data-subject requests, India hosting stance | Not built; documented only in docs/backend-plan.md |
| **Anti-ragging** | UGC 2009 regulations, notified 4 Jul 2009: anti-ragging committee headed by the head of the institution; affidavits from students and parents at admission [S14] | Affidavit capture, committee workflow, complaint record | Help desk takes anonymous complaints; no committee workflow or affidavit capture |
| **ICC (POSH)** | From memory, unverified: the POSH Act 2013 requires an Internal Complaints Committee; UGC issued related regulations (2015). Search did not return the text [S14] | Confidential case handling | Not built |
| **GST on fees** | GST Council materials list higher education as a distinct service group; one blog says colleges are taxable at 18% [S15]. From memory, unverified: services by an educational institution to students are exempt where the course leads to a qualification recognised by law, while coaching and some other income are taxable. **The sources conflict; ask a CA.** | Correct invoice type (bill of supply vs tax invoice) | Product defaults to exempt/bill of supply, can raise GST tax invoices for other income. Copy now says "generally exempt for recognised qualifications; coaching may be taxable". A standalone coaching customer would need taxable fee invoices, which is a gap |
| **TDS** | The search returned nothing usable on 194C/194J for colleges [S15] | TDS on vendor payments | Product handles 194C/194J/194I/194H/194Q; **unverified by me against current law**, confirm with a CA |

## 6. Needs-to-product table

"Verified in app" means I saw it on screen in the running app on 14 Nov 2026. "Claim not true in practice" means the docs or UI imply something the prototype cannot do for a real college.

Priority: P0 blocks selling, P1 wins deals, P2 expands.

| # | Need | Who feels it | Evidence | Addressed today (verified in app) | Gap | Pri |
|---|---|---|---|---|---|---|
| 1 | Trustworthy data: hosting, backup, access control | IT head, trustee | Data-security is a cited barrier [S18]; DPDP [S12] | Settings > Data offers a JSON export and "Reset demo". **Claim not true in practice:** data sits in the browser (README says so); roles are enforced in the UI only; domain page promises a "free TLS certificate, issued automatically once verified" which needs the backend | Backend, real auth, audit log, backups, stated India hosting | P0 |
| 2 | Online fee payment | Students, accounts | UPI and gateway norms [S16] | Checkout page loads with UPI, Card, Netbanking tabs; footer states "Demo gateway - no real money is charged". **Not real** | Razorpay/PayU integration with webhooks and settlement reconciliation | P0 |
| 3 | Numbers that agree across screens | Accounts head, trustee | Demo test | **Not true in practice**: collected fees show as 25,35,000 (admin dashboard, platform console), 25,07,671 (Fees), 25,04,520.94 (Admin Finance reports), 24,97,094.02 (Accounts Reports); outstanding 9,11,071 (Fees) vs 9,25,050 (Accounts overview) vs 6,79,800 invoice outstanding (Invoices); student 25CSE001 showed "Total payable 7,909 / Total paid 64,264" in one session and 8,000 / 65,000 in a later one | Single source of truth and consistent definitions (some differences may be legitimate: invoices vs receipts) | P0 |
| 4 | Fee collection, late fee, refunds, receipts | Accounts, trustee | Core need in all personas | Verified: Fees page with billed/collected/outstanding, dues list, ledger, student pay and receipt | Scholarships, concessions, instalment plans (own docs list it as not built) | P1 |
| 5 | Accounts: GST, TDS, bank reconciliation, FY reports | Accounts head | Product docs; competitor summaries did not show it [S2, S3] | Verified pages exist: Invoices, Bills (GST, TDS, approval), Bank (opening balance, reconciled 89%, unmatched lines), Taxes (GST summary, TDS register), Reports with FY selector | Tally/ERP export, audit trail, payroll; tax rules need CA review | P1 |
| 6 | Attendance with 75% rule | Faculty, HOD, students | Standard university rule (inference; affiliating universities set thresholds) | Verified: admin class report, below-75% tab, student view says "You meet the 75% requirement", per-subject percentages | Rule is fixed at 75%, not per-university; no student leave/OD | P1 |
| 7 | HOD approvals: purchase, repair, leave, profile changes | HOD, principal, accounts | Product docs | Verified: Approvals inbox with HOD / Management / Ordered / Received stepper, tabs for leave, student profiles, vendor bills | Substitute arrangement; no audit trail | P1 |
| 8 | Timetable with clash detection | HOD, registrar | Product docs | Grid page loads for all classes; clash interaction not re-verified by me | None noted | P2 |
| 9 | Marks, internal assessment, results, hall tickets | Autonomous and engineering registrar | Competitors list exams, OBE [S2, S3] | **Not built** (docs say so). Exams exist only as calendar events | Biggest academic gap, matters less for affiliated colleges | P1 |
| 10 | NAAC / NBA / NIRF / AISHE data packs | Principal, IQAC | [S1, S9, S10]; competitors market it [S3] | **Not built** | Export from existing staff, student, finance data first | P1 |
| 11 | Parent alerts by SMS and WhatsApp | Parents, principal | WhatsApp now billed per message since 1 Jul 2025 [S17]; DLT needed for SMS (from memory, unverified) | Email only (Email Center works as a simulated outbox). No parent login | Parent portal, DLT templates, WhatsApp BSP | P1 |
| 12 | Anti-ragging and ICC workflows | Principal | UGC 2009 [S14] | Help desk shows an "Anonymous student" complaint on ragging, urgent. No committee, affidavits, or restricted access | Confidential case roles, affidavit capture, timelines | P1 |
| 13 | ABC / APAAR / DigiLocker | Registrar | [S13] | Not built | ID fields, bulk upload | P1 |
| 14 | DPDP readiness | IT head, trustee | [S12] | Not built; only in docs | Consent, retention, breach register, subject requests | P0 |
| 15 | White-label domain and branding | Trustee, resellers | Product positioning | Verified: Settings > Branding, Domain & URL with custom-domain field and DNS steps, Email sending tab, super console with plan, URL and suspend | Real DNS and TLS need the backend; DNS check is simulated by default | P1 |
| 16 | Multi-college platform console | Platform owner, resellers | Product docs | Verified: console shows college, URL, admin, plan, students, fees, status; onboarding modal with plan list | Single tenant in demo; no billing or invoicing for the platform itself | P2 |
| 17 | Chat and live notifications | Faculty, students | Product docs | Chat badges visible in every role. Live sync works across tabs only, not across users or devices (README) | Needs WebSocket/SSE backend | P2 |
| 18 | Mobile use | Students, faculty | Usage norm (inference) | Phone-width screenshot of the student overview rendered; no horizontal break seen in that one screenshot | Native app or PWA push | P2 |
| 19 | Payroll, admissions CRM, library, hostel, transport, placement, alumni | Various | MasterSoft's module breadth [S2] | Not built | Later, via partners or integrations | P2 |

## 7. Demo test

### 7.1 The 30-minute script (principal and accounts head together)

| Min | Step | Portal | What it proves | Result when I ran it |
|---|---|---|---|---|
| 0-3 | Open the college-branded sign-in, sign in as Admin (show custom colour, name) | Admin | White-label, no platform name | Worked. Overview loads with 48 students, attendance 84.0%, fees collected 73% |
| 3-8 | Principal's morning: dashboard, alerts, Help desk with the urgent anonymous ragging complaint, announcements | Admin | Principal sees problems without asking | Worked. The anonymous urgent complaint is shown first. Sceptical question: who else can read it, and is it logged? Not answerable (no audit log) |
| 8-12 | HOD approvals: switch to HOD (Anita Krishnan), approve a leave and a profile change, then Admin sees a 10-desktop purchase of 4,50,000 awaiting management | Staff/Admin | Delegated authority, a visible chain | Worked as pages. HOD "Equipment & repairs" tab empty with 2 other approvals waiting is fine. Department page shows "All present" and "Faculty today 0 classes" on a Saturday, which reads oddly |
| 12-16 | Student pays a fee: 25CSE001, Pay now, UPI, receipt | Student | Fee flow, receipts | Checkout opens. Footer says "Demo gateway - no real money is charged". Accounts head will ask for settlement reports and refunds against the gateway |
| 16-22 | Accounts head: overview, "Needs you", record a vendor bill with GST and TDS, bank import, reconcile, taxes | Accounts | The wedge | Pages and numbers present (reconciled 89%, TDS due, GST summary). **Numbers disagree across screens** (see table row 3), which an accounts head will notice at once |
| 22-26 | Reports: month and FY, export CSV, print | Accounts/Admin | Auditor-ready output | Reports load with FY selector. Admin and Accounts versions of "collected" differ by about 7,400 rupees |
| 26-28 | Platform console and plans | Super | Multi-college model | Console loads after emailed-code sign-in. Plan dropdown on the row shows names only, no limits (limits show only in the onboarding form) |
| 28-30 | Trust and compliance questions | n/a | Readiness | Cannot be shown: data location, backups, audit log, DPDP, SMS/WhatsApp, marks and results |

### 7.2 What broke or confused
- **Figures not reconciling** (row 3 in section 6): the largest demo risk.
- **Money formats vary:** Finance reports show paise (25,04,520.94) while the dashboard shows whole rupees (25,35,000).
- **"Faculty today: All present"** on the HOD page with zero classes today.
- **Console tile** said "Monthly recurring" with the hint "from active plans" (now "per month"). Plan names did not show limits (now "up to 3,000 students").
- **The super admin sign-in** needs the emailed code each time and the code field auto-submits on the sixth digit; a presenter who presses Verify as well gets confused (minor).
- **No console or page errors** were recorded across the pages I loaded (the page-error listener returned an empty list).

### 7.3 Questions a sceptical buyer will ask that the product cannot answer today
1. Where is our data stored, who can access it, can we leave with it? (backup is a browser JSON file)
2. Is there an audit log of who changed a fee or approved a bill?
3. Does it send SMS and WhatsApp to parents? Who registers the DLT templates?
4. Does it produce our NAAC/NIRF/AISHE data? Marks and results? Hall tickets?
5. Does it integrate with the affiliating university, ABC or DigiLocker?
6. Can the payment gateway settlements be reconciled to our bank statement automatically?
7. How do we get our existing student data in? (CSV import exists for students; not tested here)
8. What is the uptime, support model and price after the first year?

## 8. RICE-ranked roadmap

Scale: Reach 1-10 (share of target colleges this matters to within a year); Impact 0.25 / 0.5 / 1 / 2 / 3; Confidence as a fraction; Effort in person-months (rough, my estimate for a small team). RICE = Reach x Impact x Confidence / Effort. Scores are judgement, not measured; confidence is low where evidence is a vendor claim only.

| Rank | Item | R | I | C | E | RICE | Why these scores |
|---|---|---|---|---|---|---|---|
| 1 | Make demo and report numbers consistent (one source of truth) | 10 | 1 | 0.9 | 0.25 | 36.0 | Seen to break in the demo; tiny effort; every buyer sees it |
| 2 | Real payment gateway (Razorpay/PayU) with webhooks, settlement reconciliation | 9 | 3 | 0.85 | 2 | 11.5 | Fee collection is the daily money flow; gateway fee about 2% plus GST on Razorpay's standard plan per its own page [S16] |
| 3 | Tally / accounting export | 7 | 2 | 0.8 | 1 | 11.2 | Cheap; auditors expect it (from the repo's own analysis; verify with accountants) |
| 4 | Anti-ragging and ICC confidential case workflow | 8 | 2 | 0.7 | 1.5 | 7.5 | UGC regulation [S14]; builds on help desk |
| 5 | Scholarships, concessions, instalments | 9 | 2 | 0.8 | 2 | 7.2 | Common in private colleges (inference) |
| 6 | ABC / APAAR ID fields and bulk upload | 8 | 2 | 0.6 | 1.5 | 6.4 | UGC directive [S13]; confidence limited by conflicting reports |
| 7 | DPDP kit: consent log, retention, subject requests, breach register | 9 | 2 | 0.7 | 2 | 6.3 | Duties begin about May 2027 [S12]; needs backend |
| 8 | Exam cell: hall tickets, seating, invigilation | 7 | 2 | 0.7 | 2 | 4.9 | Needed by autonomous and engineering |
| 9 | Parent portal with SMS/WhatsApp alerts | 9 | 2 | 0.7 | 3 | 4.2 | Visible to families; running cost via WhatsApp per-message pricing [S17] |
| 10 | NAAC / NIRF / AISHE data packs | 7 | 2 | 0.6 | 2 | 4.2 | Principals care; format drift risk as NAAC changes [S9] |
| 11 | Marks, internal assessment, results | 9 | 3 | 0.8 | 6 | 3.6 | High impact where the college owns exams; low for affiliated colleges |
| 12 | Backend, real auth, audit log, backups | 10 | 3 | 0.9 | 10 | 2.7 | Low RICE only because it is big; it is a **prerequisite** for items 2, 7, 9 and for any production sale, so it goes first |
| 13 | CO-PO attainment (NBA) | 4 | 2 | 0.6 | 3 | 1.6 | Engineering only |
| 14 | Payroll | 6 | 2 | 0.6 | 4 | 1.8 | Large; partner or integrate first |
| 15 | Admissions CRM | 6 | 2 | 0.5 | 4 | 1.5 | Large, crowded |

### Three releases
- **Release 1 "Trust and money" (start now):** items 12, 1, 2, 7, 3. Exit test: a college can pay through a real gateway, the data is on a stated India host with backups and an audit log, and every screen agrees.
- **Release 2 "Fees and families":** items 5, 9, 4, 6. Plus a basic SMS alert on fee due and absence once DLT templates exist.
- **Release 3 "Academics and accreditation":** items 11, 8, 10, then 13 for engineering.
- **Later:** payroll, admissions, library/hostel/transport via partners.

### Quick wins
Shipped now (copy only): plan labels and over-limit text in the console; revenue tile text; GST exemption wording on Taxes.
Ship next (small, no new feature): seed the demo data so all totals agree; hide "All present" when there are no classes; show plan limits next to the plan selector in the console row; add a "Trust" page stating hosting, backup and audit-log intentions once real.

## 9. Positioning and pricing review

**Target segments, in order.**
1. Private self-financing **affiliated arts and science colleges**: fees, attendance, accounts, staff approvals are the pain; the university runs exams so no marks engine is needed. Price-sensitive.
2. **Engineering and polytechnic**: add marks, exam cell and NBA CO-PO before pitching (release 3).
3. **Autonomous colleges**: need marks, results and ABC (release 3).
4. **Standalone coaching**: the fees may be taxable under GST (see section 5), so the invoice flow needs work; defer.

**Wedge (hypothesis to test in interviews):** the accounts office plus HOD approvals plus fee collection, sold as "know every rupee and every approval", with a published price.

**Positioning statement:** For private colleges in India that run fees, approvals and accounts on spreadsheets and WhatsApp, this platform is the white-label college portal that puts fee collection, HOD approvals and GST/TDS-ready accounts in one place under the college's own name and domain, unlike broad ERPs that sell module lists on quotation.

### Plan review
Arithmetic from the code (SuperAdmin.tsx): Starter INR 4,999 per month for up to 500 students; Growth INR 14,999 for up to 3,000; Enterprise INR 39,999 unlimited.

| Plan | Annual price | Price per student per year at the cap |
|---|---|---|
| Starter | 59,988 | about 120 at 500 students |
| Growth | 1,79,988 | about 60 at 3,000; 180 at 1,000 |
| Enterprise | 4,79,988 | 48 at 10,000 students (my example size) |

- **Cannot be benchmarked.** No competitor college price was citable. Third-party listings show Teachmint from $5 per user per year (unverified, mostly schools), Fedena about $1,000 to $1,300 per year (conflicting), and an unestimated per-student rate in one blog of INR 50 to 600 for schools, which is a school estimate and not citable evidence [S4, S6, S20]. College ERPs I checked quote on request [S2, S3, S7].
- **Problems in the structure (my analysis):** (a) A college with 520 students pays three times the Starter price. Consider a 1,500-student tier or per-student overage. (b) Plans differ by student count only, nothing else, so Enterprise is hard to justify except for scale; tie it to features (SSO, audit export, data residency options, priority support, multiple campuses). (c) The platform does not enforce the cap, it only flags a red "over limit" note. (d) Gateway fees (Razorpay lists 2% plus GST on its standard plan [S16]) and WhatsApp costs [S17] must be passed through or priced in. (e) No setup or data-migration fee, which real onboarding needs.
- **Recommendation:** test per-student-per-year pricing with a minimum, e.g. a floor equal to Starter, and pilot at 2 or 3 colleges before fixing numbers. Keep prices **unchanged in code** until interviews support a change; I changed labels only.

### Reseller / partner model
The multi-tenant console, white-label domains and plan assignment already suit resellers (local IT firms, accreditation consultants, university-affiliated college associations). Needed: a reseller role in the console, per-reseller colleges and billing, margin rules (assumption: 20 to 30% to be tested), a support tier model, and a brand-free sign-in (exists on custom domains per the README). Without a platform billing module the console cannot invoice resellers.

### Trust and compliance messages a buyer needs (each must be true before it is said)
1. Data stored in India, named provider and region (not true yet).
2. Daily encrypted backups with restore test, export of all data on exit.
3. Audit log of fee, approval and role changes.
4. DPDP: consent, retention, breach process, a named contact (rules apply from about May 2027 [S12]).
5. Role-based access enforced on the server, anonymous complaints visible only to a named committee.
6. SMS via DLT-registered templates (from memory, unverified) and WhatsApp per-message cost explained [S17].
Until the backend exists, say "pilot" and do not promise any of these.

## 10. Competitor comparison (honest)

Entries from search summaries (pages not opened). "Not shown" means I did not see it in the summary, not that it is absent.

| Area | This product (verified in app) | MasterSoft | Creatrix / Edumerge | Teachmint | Entab |
|---|---|---|---|---|---|
| Serves colleges | Yes | Yes, claims 2,000+ institutions (self-reported) | Yes | Lists higher education; depth unconfirmed | No evidence |
| Module breadth | Medium: 4 portals, fees, attendance, timetable, accounts, approvals | Strongest: 23+ to 45+ modules incl. affiliation, exams, HR, hostel, placement | Strong in accreditation | Broad school ERP plus classroom | School-focused |
| Marks, exams, results | **Not built** | Yes (listed) | Yes (listed) | Exam scheduler listed | Yes for schools |
| NAAC / NBA tooling | **Not built** | OBE integration listed | NAAC/NBA modules listed | Not shown | Not shown |
| GST/TDS bills, bank reconciliation | **Yes in the prototype** | Finance listed; detail not shown | Not shown | Finance and expense tools listed | Not shown |
| White-label domain per college | Yes, in UI (DNS and TLS simulated) | Not shown | Not shown | Not shown | Not shown |
| Published price | Yes (3 plans, unverified market fit) | No | No | Third-party listings only | No |
| Production readiness | **Prototype**: no backend | Proven at scale (claim) | Proven (claim) | Proven | Proven in schools |
| Where competitors are clearly stronger | Production maturity, exams and results, accreditation, affiliation, installed base | | | | |

## 11. Risks

1. **Prototype risk:** no backend; selling before release 1 will fail on security questions or damage trust.
2. **Incumbent breadth:** MasterSoft and others cover exams, affiliation and accreditation; competing on module count loses.
3. **Compliance drift:** NAAC rules and rollout dates reported inconsistently [S9]; DPDP details to be checked against the gazette [S12]; GST and TDS rules need a CA's review.
4. **Evidence risk:** all competitor information is second-hand; real prices and features may differ.
5. **Adoption risk:** faculty resistance and training gaps are the recurring cited failure cause [S18]; the product needs onboarding, training and migration support priced in.
6. **Cost-to-serve:** SMS, WhatsApp, gateway and email costs scale with usage and are not in the plan price.
7. **Single-tenant demo:** multi-college behaviour is untested beyond one tenant.
8. **Pricing risk:** no benchmark; the 500 to 3,000 student step may lose mid-sized colleges.

## 12. Source list

All seen via WebSearch on 2026-11-14. "Summary" means the search tool's summary of the page; I did not open the page (WebFetch was blocked for vendor hosts). Treat figures as to-be-verified against the primary document.

| ID | URL | What it supports |
|---|---|---|
| S1 | https://education.gov.in/sites/upload_files/mhrd/files/statistics-new/AISHE%20Book_2021-22_4.pdf (also https://vikaspedia.in/news/ministry-of-education-releases-all-india-survey-on-higher-education-2021-2022) | AISHE 2021-22 counts and enrolment |
| S2 | https://azuremarketplace.microsoft.com/en-us/marketplace/apps/mastersofterpsolutionspvtltd.rf_campus ; https://www.mastersofterp.com/product/institute-management-software.aspx ; https://iitms.co.in/college-erp | MasterSoft and IITMS modules, client claims, deployment |
| S3 | https://creatrixcampus.com/accreditation-management-software ; https://www.edumerge.com/products/college-erp/accreditation-management | Creatrix and Edumerge accreditation features (vendor claims) |
| S4 | https://blog.teachmint.com/how-erp-solutions-can-help-colleges ; https://www.softwareadvice.com/student-engagement/teachmint-profile ; https://us.fitgap.com/products/021746/teachmint | Teachmint scope, third-party price listings |
| S5 | https://www.capterra.in/software/165862/camu ; https://www.getapp.sg/software/2048057/camu ; https://elearningindustry.com/directory/elearning-software/camu-digital-campus/pricing | CAMU vendor and conflicting price listings |
| S6 | https://www.capterra.com/p/126199/Fedena-Pro/ ; https://www.saasworthy.com/product/fedena/pricing | Fedena conflicting prices |
| S7 | https://www.classter.com/college/ ; https://www.techjockey.com/detail/zoho-campus ; https://www.spotsaas.com/product/quick-campus/pricing | Classter, Zoho Campus, Quick Campus pricing notes |
| S8 | https://entab.in/school-erp-software.html ; https://yourstory.com/2020/12/delhi-school-management-startup-entab | Entab is a school ERP |
| S9 | https://news.careers360.com/naac-revamps-accreditation-process-will-implement-maturity-based-grading-current-grades-until-april-may-2025 ; https://theprint.in/education-2/after-bribery-row-naac-set-to-roll-out-revamped-accreditation-system-with-stricter-grading-norms/2685638 | NAAC binary and graded levels, inconsistent timeline |
| S10 | https://www.nirfindia.org/nirfpdfcdn/2025/framework/Colleges.pdf | NIRF college weightages |
| S11 | https://aicte.gov.in/sites/default/files/MDisclosure.pdf ; https://aicte.gov.in/sites/default/files/Report_Fee_Committee.pdf | AICTE mandatory disclosure and fee committees |
| S12 | https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf ; https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/ ; https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months | DPDP Rules 2025 notified 14 Nov 2025, 18-month phasing |
| S13 | https://news.careers360.com/academic-bank-credits-abc-apaar-id-login-digilocker-1800-institutions-30-percent-upload-aadhaar-problems-ncrf-education-ministry ; https://news.careers360.com/apaar-id-12-digit-registration-form-consent-academic-bank-of-credits-abc-digilocker-login-cbse-ugc-udise-school-nep-2020-faqs ; https://static.pib.gov.in/WriteReadData/specificdocs/documents/2026/jul/doc202675912501.pdf | ABC, APAAR status and directives |
| S14 | https://iitg.ac.in/acad/admission/fresher/UGC-regulations-2009.pdf ; https://dme.ap.nic.in/rag/UGC_Anti%20Ragging_2009.pdf | UGC anti-ragging regulations 2009. POSH/ICC not found in search |
| S15 | https://www.gstcouncil.gov.in/sites/default/files/e-version-gst-flyers/GST_Education_Services.pdf ; https://cleartax.in/s/gst-educational-institutions | GST on education (sources conflict on colleges) |
| S16 | https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/ ; https://razorpay.com/upi-payment-gateway-india/ | Razorpay 2% platform fee plus GST on standard plan |
| S17 | https://developers.facebook.com/docs/whatsapp/pricing ; https://baat.ai/blog/whatsapp-api-pricing-india | WhatsApp per-message pricing since 1 Jul 2025 |
| S18 | https://issuu.com/irjet/docs/irjet-v11i1265 ; https://www.slideshare.net/slideshow/user-perceptions-motivations-and-implications-on-erp-usage-an-indian-higher-education-context/14600081 | ERP adoption barriers (academic, 2012 case study) |
| S19 | https://geekchamp.com/?p=247774 ; https://digitallearning.eletsonline.com/?p=47035 | Vendor-blog adoption themes; under 0.5% claim (promotional, unverified) |
| S20 | https://codingclave.com/guides/school-management-software-cost-india-2026 | A blog estimate of school ERP rates; not a reliable anchor |
| Internal | docs/college-needs-analysis.md, docs/backend-plan.md, docs/auth.md, README.md, src/pages/super/SuperAdmin.tsx | Product facts, plans |
