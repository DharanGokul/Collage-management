# Backend plan

What it takes to turn this front-end prototype into a production multi-tenant college platform. The front-end was built so that most of this is a swap, not a rewrite: the auth layer is already an API-shaped service, every page reads one store, and tenants are resolved from the host name.

**Contents:** [1 Principles](#1-principles) · [2 Architecture](#2-architecture) · [3 Multi-tenancy](#3-multi-tenancy) · [4 Custom domains](#4-custom-domains-white-label) · [5 Authentication](#5-authentication-and-authorisation) · [6 API](#6-api) · [7 Data model](#7-data-model) · [8 Realtime](#8-realtime) · [9 Files, email, SMS](#9-files-email-sms) · [10 Payments](#10-payments) · [11 Security and compliance](#11-security-and-compliance) · [12 Front-end migration](#12-front-end-migration) · [13 Infrastructure](#13-infrastructure-and-operations) · [14 Roadmap](#14-roadmap) · [15 Decisions needed](#15-decisions-needed-from-you)

---

## 1. Principles

1. **The server is the only authority.** Every rule the UI enforces today (who may approve a purchase, who sees a complaint, what a student may edit) must be enforced again on each API call. The UI only hides buttons.
2. **Tenant isolation is a database property, not a code habit.** A forgotten `WHERE tenant_id = ?` must not be able to leak another college's data (row-level security, below).
3. **Money is exact.** Integer paise, never floats; payments are idempotent; ledgers are append-only.
4. **Everything important leaves a trail.** Approvals, fee changes, deletions, sign-ins and permission changes are written to an audit log that application users cannot edit.
5. **Boring technology.** One database, one cache/queue, one object store, one deployable monolith with clear module boundaries. Split services only when a real bottleneck appears.

## 2. Architecture

```
                        ┌────────────────────────────┐
 tnkportal.com ─┐       │  Edge: CDN + TLS + WAF     │  custom-domain certificates issued here (§4)
 college.app    ├──────▶│  static SPA  +  /api proxy │
 sub.platform   ─┘       └─────────────┬──────────────┘
                                       │
                         ┌─────────────▼──────────────┐
                         │  API (stateless, N pods)   │  REST /v1  +  WebSocket gateway
                         │  modules: auth, tenants,   │
                         │  people, academics, fees,  │
                         │  finance, workflow, chat,  │
                         │  notifications, files      │
                         └───┬────────┬───────────┬───┘
                             │        │           │
                  ┌──────────▼─┐  ┌───▼─────┐  ┌──▼──────────────┐
                  │ PostgreSQL │  │ Redis   │  │ Object storage  │
                  │ (RLS, PITR)│  │ cache,  │  │ photos, logos,  │
                  └──────┬─────┘  │ queues, │  │ receipts, CSVs  │
                         │        │ pub/sub │  └─────────────────┘
                         │        └───┬─────┘
                         │      ┌─────▼─────────────┐
                         └─────▶│ Workers           │  email, SMS, PDF, DNS checks,
                                │ (same codebase)   │  reminders, reports, imports
                                └───────────────────┘
```

**Recommended stack** (change if your team prefers another; the contracts below do not depend on it):

| Concern | Choice | Why |
|---|---|---|
| Language / runtime | TypeScript on Node.js 22 LTS | Shares types and validation with the front-end |
| HTTP framework | Fastify (or NestJS if you want enforced structure) | Fast, schema-first, good plugin ecosystem |
| Database | PostgreSQL 16 | Row-level security, strong constraints, `NUMERIC`, PITR backups |
| ORM / queries | Drizzle or Prisma + SQL migrations | Typed queries; migrations in version control |
| Validation | Zod schemas shared with the SPA | One definition for request, response and form |
| Cache, queues, pub/sub | Redis 7 (BullMQ for jobs) | Rate limits, OTP counters, job retries, realtime fan-out |
| Object storage | S3-compatible (S3, R2, GCS) | Signed uploads, lifecycle rules |
| Email | Amazon SES (or SendGrid/Mailgun) behind an interface | Per-tenant sender identities, bounce webhooks |
| Realtime | WebSocket (SSE as fallback) | Replaces the cross-tab `storage` event |

Alternatives that fit equally: Django + DRF, Spring Boot, Go. If the team is Python or Java, take that; keep the same schema and endpoints.

## 3. Multi-tenancy

- **Model:** shared database, shared schema, `tenant_id` on every business table. Cheapest to run and migrate; works for thousands of colleges. Offer schema-per-tenant or a dedicated database only for enterprise contracts that demand it.
- **Isolation:** PostgreSQL row-level security on every tenant table.

  ```sql
  ALTER TABLE students ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON students
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
  ```

  Each request opens a transaction and runs `SET LOCAL app.tenant_id = '<id>'` from the *authenticated* tenant, never from client input. The application database role must not own the tables or bypass RLS. Add an automated test that signs in as tenant A and requests tenant B's ids on every endpoint.
- **Resolution:** from the `Host` header. `tenant_domains` maps host → tenant (sub-domain or verified custom domain). Unknown host → a generic "college not found" page with no information about other tenants. This replaces `resolveTenant()` in `src/lib/tenant.ts`; the `?tenant=` preview parameter is kept for non-production only.
- **Platform (super admin) scope:** separate accounts, separate table, mandatory MFA, optional IP allow-list, every action audited. A super admin can suspend or provision a college but reads college data only through an explicit, logged "support access" grant.
- **Limits:** plan quotas (students, storage, emails per day) enforced server-side and shown in the platform console.

## 4. Custom domains (white-label)

Goal: a college that owns `tnkcollege.com` serves its portal on `tnkportal.com` (or `portal.tnkcollege.com`), and no platform name appears anywhere: pages, emails, links, certificates, sender address.

**Data**

```
tenant_domains(id, tenant_id, host UNIQUE, kind {platform_subdomain|custom}, is_apex bool,
               verify_token, verified_at, tls_status {pending|issued|failed}, tls_issued_at,
               www_alias bool, created_at)
```

**Flow**

1. Admin enters the domain in Settings → Domain (already built). API validates syntax, rejects platform domains and reserved names, and checks it is not claimed by another tenant.
2. API returns the records to create (the UI already renders them):
   - **Sub-domain** (`portal.tnkcollege.com`): `CNAME` → the tenant's platform host.
   - **Apex** (`tnkportal.com`): `A`/`AAAA` to the edge addresses, because DNS forbids a `CNAME` at the root. Some DNS hosts offer `ALIAS`/`ANAME` as an alternative. `www` → `CNAME`.
   - **Ownership:** `TXT _campus.<domain>` with a random per-domain token.
3. A worker checks DNS (A/CNAME and TXT) using the system resolver, retries with backoff for up to 72 hours and updates `verified_at`. The front-end's optional DNS-over-HTTPS check (`VITE_DNS_VERIFY=doh`) is only a convenience for the admin; the backend result is authoritative.
4. **TLS certificates** are issued automatically after verification. Pick one:
   - **Cloudflare for SaaS (Custom Hostnames)**: least work; handles apex, renewals, DDoS. Recommended to start.
   - **Caddy with on-demand TLS**: the `ask` endpoint answers "is this host verified?" so certificates are only issued for known domains. Good if you self-host.
   - **cert-manager + Let's Encrypt** or **AWS ACM + CloudFront** for Kubernetes/AWS setups.
5. Edge routes `Host: tnkportal.com` to the SPA and `/api`; the API maps the host to the tenant. HTTP redirects to HTTPS; `www` redirects to the canonical host; send HSTS once the certificate has been stable.
6. **Email from the college's domain:** create a sender identity per tenant (SES `CreateEmailIdentity` returns 3 DKIM `CNAME`s). Show those records in the same DNS table, plus SPF (`TXT`) and DMARC. Until verified, send from the platform address with the college name as display name and `Reply-To` set to the college.
7. **Links and cookies** are always built from the request host, never from the platform domain. Session cookies are host-only (no `Domain=` attribute), so they cannot be sent to another tenant's host.

**Abuse controls:** only verified hosts get certificates; rate-limit domain additions per tenant; re-verify periodically and drop certificates for domains that stop pointing at the platform; block domains on a deny-list (banks, big brands) pending manual review.

**Clean URLs:** the prototype uses hash routing (`/#/login`) so it works on any static host. With a server, switch to `BrowserRouter` (`/login`) and have the edge serve `index.html` for unknown paths. The auth e-mail links in `src/auth/service.ts` are the only places that build `#/` URLs and would change with it.

## 5. Authentication and authorisation

The front-end already calls an API-shaped service (`src/auth/service.ts`). Each function maps to one endpoint; the UI does not change when the implementation moves to the server.

| Front-end function | Endpoint | Notes |
|---|---|---|
| `signIn` | `POST /v1/auth/sign-in` | `{role, identifier, password, remember}` → `ok`, `otp_required`, `unverified`, or `invited` |
| `verifyOtp` | `POST /v1/auth/otp/verify` | `{challengeId, code, trustDevice}` |
| `resendOtp` | `POST /v1/auth/otp/resend` | 30 s cooldown, max 5 sends |
| `verifyEmail` | `POST /v1/auth/email/verify` | single-use token |
| `resendVerification` | `POST /v1/auth/email/resend` | always `202`, never reveals if the address exists |
| `requestPasswordReset` | `POST /v1/auth/password/forgot` | always `202` |
| `inspectToken` | `GET /v1/auth/tokens/{token}` | lets the page show the right form or an error before spending the token |
| `resetPassword` | `POST /v1/auth/password/reset` | revokes sessions and trusted devices |
| `activateAccount` | `POST /v1/auth/activate` | invite → set password; also verifies the email |
| `changePassword` | `POST /v1/auth/password/change` | needs the current password |
| *(new)* | `POST /v1/auth/sign-out`, `GET /v1/auth/me`, `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` | session management |

**Password storage.** Argon2id (OWASP minimum: 19 MiB memory, 2 iterations, 1 lane; use more if latency allows) with a per-user salt and a server-side pepper held in a secret manager. The prototype's PBKDF2 (120,000 iterations of SHA-256 through WebCrypto) is a browser-side stand-in. Check new passwords against a breach list using the k-anonymity range API (Have I Been Pwned) and reject common or personal passwords (the UI already shows a live checklist; the server must enforce it).

**Sessions.** Opaque session ID in an `HttpOnly; Secure; SameSite=Lax` cookie, stored server-side (Redis + Postgres) so it can be revoked. Idle timeout and absolute timeout from the tenant's policy (prototype defaults: 12 h, or 14 days with "Keep me signed in"). Rotate the ID on sign-in and privilege change. State-changing requests need a CSRF token (double-submit or header check). If you prefer JWTs, use 10-minute access tokens with rotating, revocable refresh tokens; never keep tokens in `localStorage`.

**One-time codes and links.** 6-digit codes and 192-bit link tokens, generated from a CSPRNG, stored only as salted hashes, single use, short expiry (code 5 min, reset link 1 h, verification link 24 h, invite 72 h). Codes allow 5 attempts, then the challenge dies. Email today; add SMS/WhatsApp (DLT-registered templates in India) and TOTP or passkeys (WebAuthn) as second factors, and recovery codes.

**Brute-force and enumeration.** Counters in Redis per account, per IP and per tenant; progressive lockout (prototype: 5 failures → 5 minutes); identical responses and equal timing for unknown and known accounts; CAPTCHA after repeated failures. Every sign-in, failure, lock, reset and password change goes to the audit log with IP and user agent; offer "new sign-in" emails.

**Trusted devices.** A random token in a cookie; the server stores its hash with expiry. Revoked on password change (the prototype already does this).

**SSO (later).** Google Workspace and Microsoft Entra via OIDC for colleges that have them; SAML for enterprise. Map the IdP identity to an existing person by verified email; keep the local password as a fallback unless the tenant disables it.

**Authorisation.** Role-based access plus scope rules, evaluated in one policy module that both the API and tests use:

| Role | Scope |
|---|---|
| `admin` | Whole tenant; can delegate narrower admin roles later (exam cell, deputy, read-only) |
| `staff` | Own profile; classes they teach; if HOD, their department's approvals, leave and requests |
| `student` | Own record, own class group chats |
| `accountant` | Finance module and fee data; read-only on people |
| `super` | Platform console only |

Rules that exist in the UI and must be re-implemented server-side: HOD approves their department's requests and leave; purchases or amounts over the approval limit also need management; students can only chat with their teachers, HOD and office; student profile changes need HOD approval; anonymous complaints hide the reporter from staff.

## 6. API

- **Style:** REST, JSON, versioned under `/v1`, documented with OpenAPI generated from the Zod schemas. Types and form validation are generated from the same source for the SPA.
- **Conventions:** cursor pagination (`?limit=&after=`), filters as query params, `ETag`/`If-Match` (or a `version` column) for optimistic concurrency so two admins cannot silently overwrite each other, and `Idempotency-Key` on payment and import endpoints.
- **Errors:** RFC 9457 problem details (`type`, `title`, `status`, `detail`, field errors); stable machine-readable codes (the front-end already uses codes such as `invalid_credentials`, `locked`, `code_expired`).
- **Resources** (each maps to a collection the SPA store uses today): `tenants`, `branding`, `domains`, `email-settings`, `students`, `staff`, `accountants`, `departments`, `subjects`, `timetable`, `attendance`, `fees`, `payments`, `invoices`, `bills`, `vendors`, `bank-accounts`, `bank-transactions`, `tds-deposits`, `events`, `registrations`, `tickets`, `requests`, `leaves`, `profile-changes`, `chats`, `messages`, `notifications`, `email-log`, `audit-log`, `reports/*`.
- **Bulk operations** (student import, fee generation, reminders, statement import) are jobs: `POST` returns `202` with a job id; the SPA watches progress over the realtime channel.
- **Rate limits** per tenant, per user and per IP, with `429` and `Retry-After`.

## 7. Data model

All tables carry `tenant_id`, `created_at`, `updated_at`, and (where records can be removed) `deleted_at` for soft deletion. Primary keys are UUIDv7 (time-ordered).

| Area | Tables (key columns) |
|---|---|
| Platform | `tenants` (name, slug, plan, status), `tenant_domains` (§4), `platform_admins`, `plans` |
| Identity | `accounts` (role, subject_id, email, password_hash, status, email_verified_at, locked_until), `auth_challenges` (kind, secret_hash, expires_at, attempts), `trusted_devices`, `sessions`, `audit_log` (append-only; actor, action, entity, before/after, ip) |
| People | `students` (roll_no, department, year, section, guardian_*), `staff` (emp_id, department, designation), `accountants`, `departments` (hod_id), `profile_changes` (JSON diff, status, decided_by) |
| Academics | `subjects`, `periods`, `timetable_slots`, `attendance_sessions`, `attendance_marks` (one row per student per session), `events`, `event_registrations` |
| Fees | `fee_items`, `fee_assignments`, `payments` (amount_paise, late_fee_paise, method, gateway_ref, status), `refunds`, `receipts` |
| Finance | `vendors` (gstin, state), `bills` + `bill_lines`, `invoices` + `invoice_lines`, `bank_accounts`, `bank_transactions` (matched_entity), `tds_deposits`, `tax_settings` |
| Workflow | `requests` (kind, status machine, estimated_cost, approver chain), `request_events` (timeline), `leaves` (type, from, to, days, approver), `leave_balances` |
| Communication | `chats`, `chat_members`, `messages`, `message_reads`, `notifications`, `tickets`, `ticket_comments`, `email_outbox`, `email_log` |
| Config | `branding`, `email_settings` (secrets encrypted), `auth_policy`, `settings` |

**Money:** `BIGINT` paise plus a currency code; GST and TDS computed in one tested module (the prototype's rules: fees treated as GST-inclusive and exempt by default; TDS on the pre-GST value; 194C 2%, 194J 10%, 194I 10%, 194H 2%, 194Q 0.1%; due on the 7th of the next month, 30 April for March; April–March financial year). Receipts and invoices get **gap-free numbering per financial year per tenant** from a locked sequence table. Plan a double-entry ledger (accounts, journal entries) as the finance module matures.

**Constraints that replace UI checks:** unique `(tenant_id, roll_no)`, `(tenant_id, emp_id)`, `(tenant_id, lower(email))`; one HOD per department; attendance unique on `(session_id, student_id)`; request status transitions enforced in a single state-machine function with a database `CHECK` as a backstop.

## 8. Realtime

Today a `storage` event copies the database between browser tabs. In production:

- **Transport:** WebSocket gateway (SSE fallback). The client connects after sign-in and subscribes to its own member channel (`tenant:{id}:member:{role}:{userId}`) and the channels of its chats. Authorisation is checked on subscribe and on every publish.
- **Fan-out:** the API writes the notification/message in the database transaction and an **outbox** row; a worker publishes it to Redis pub/sub; gateway pods forward it. This guarantees a message is never delivered unless it was saved, and never lost if a pod restarts.
- **Reconnect:** clients send their last seen event id and receive anything missed.
- **Offline users:** the same notification is stored for the bell, and sent as web push / email according to preference. "Important" notifications stay persistent until acknowledged (existing behaviour).
- **Presence and typing** stay ephemeral in Redis.

## 9. Files, email, SMS

- **Uploads (photos, logo, favicon, statements):** the API issues a short-lived signed upload URL; the browser uploads directly to object storage; a worker validates type by content (not extension), strips EXIF, resizes, scans for malware, and writes the final key. Serve via the CDN with long cache lifetimes and content-hashed names. Replace the prototype's base64-in-database approach.
- **Email:** a provider interface (`send(message)`), a queue with retries and dead-letter handling, and webhooks for bounces and complaints that update `email_log` and suppress bad addresses. Templates are versioned and rendered server-side. Authentication mails (codes, links) bypass bulk queues and have their own high-priority lane. Tenants may bring their own SMTP/provider credentials (encrypted at rest) or use the platform sender.
- **SMS / WhatsApp:** fee due, absence and exam alerts through a provider abstraction; DLT template registration for India; per-tenant opt-in and quiet hours.

## 10. Payments

Razorpay, PayU or Stripe behind a `PaymentGateway` interface. Create an order server-side with an idempotency key; the SPA opens the gateway's checkout; **the webhook (signature verified) is the source of truth**, not the browser redirect. Store gateway reference, status history and raw payload; reconcile daily against the gateway's settlement report; support partial payments, instalments and refunds; generate the receipt PDF on a worker and email it. Never store card data.

## 11. Security and compliance

- **Baseline:** OWASP ASVS Level 2 as the checklist; dependency and container scanning in CI; secret management (no secrets in env files or the repo); least-privilege database roles; TLS everywhere; encryption at rest; HSTS; strict CSP; `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; WAF and bot protection at the edge; regular pen-tests before launch.
- **India DPDP Act 2023:** record consent and purpose; collect the minimum; retention schedule and deletion on request; breach notification process; a named grievance officer; guardian consent for minors (students under 18); keep data in an Indian region. Maintain a processing register.
- **Sensitive workflows:** anti-ragging and ICC (POSH) complaints need restricted visibility, extended retention and a tamper-evident audit trail; anonymous reports store the reporter's identity only as a hashed reference under break-glass access (today the demo still stores the name client-side).
- **Audit log:** append-only table (revoke `UPDATE`/`DELETE`), hash-chained rows or streamed to write-once storage; viewable by admins with filters; covers approvals, fee and payment changes, deletions, permission changes and every authentication event.
- **Backups and recovery:** continuous WAL archiving (point-in-time recovery), daily snapshots copied to another region, quarterly restore drills. Targets: RPO ≤ 5 min, RTO ≤ 1 h.
- **Privacy by design:** tenant data export and deletion endpoints; per-tenant encryption keys for secrets; logs free of passwords, codes and tokens.

## 12. Front-end migration

The goal is to change data sources without touching page components.

1. **Types** move to a shared package (`/packages/shared`) with Zod schemas. `src/types.ts` becomes generated or re-exported.
2. **Auth:** implement `src/auth/service.ts` over HTTP (same function signatures). Remove `storage.ts`, the demo mailbox and `VITE_AUTH_DEMO`. Session loading becomes `GET /v1/auth/me`.
3. **Store:** `AppStore` today holds one big database object and `update(draft => ...)` mutations. Replace it incrementally with per-resource hooks (`useStudents()`, `useFees()`), backed by TanStack Query with optimistic updates for the actions that must feel instant (attendance marks, chat, approvals). Keep `notify()` call sites as server events.
4. **Realtime:** replace the `storage` listener with a WebSocket client that invalidates or patches the query cache.
5. **Tenant resolution:** `resolveTenant()` calls `GET /v1/tenants/resolve?host=` once at boot; keep the `?tenant=` override for non-production.
6. **Files:** swap `readImage` base64 handling for signed uploads.
7. **Contract tests:** run the existing Playwright suites against a mock server first (MSW) and then against the real API in CI. The suites already cover the approval chain, chat, notifications, bills and reports.
8. **Rollout:** ship behind a feature flag per tenant, migrate a pilot college, keep the localStorage adapter for demos and tests.

Migrating real data from the demo is not needed; onboarding uses CSV import (students, staff, fee structures) and the invitation flow (`activateAccount`), which already exists.

## 13. Infrastructure and operations

- **Environments:** local (Docker Compose: Postgres, Redis, MinIO, Mailpit), staging, production; infrastructure as code (Terraform); one pipeline: lint, type-check, unit, integration (Testcontainers), contract, Playwright, build, scan, deploy; database migrations run as a separate, reviewed step with expand/contract so deploys never break the running version.
- **Hosting:** managed Postgres and Redis in an Indian region (e.g. AWS ap-south-1 or GCP asia-south1); containers on ECS/Fargate, Cloud Run or Kubernetes; the SPA from object storage + CDN.
- **Observability:** structured logs with request and tenant ids; OpenTelemetry traces; metrics and alerts on error rate, latency, queue depth, failed emails, payment webhook failures, certificate expiry; Sentry for the SPA and API; uptime checks per tenant host.
- **SLOs (starting point):** 99.9% monthly availability, p95 API latency under 300 ms, email codes delivered under 30 s at p95.
- **Cost shape (very rough, one small region):** managed Postgres + Redis + 2 API pods + CDN + email: a few hundred USD per month for the first dozens of colleges; storage and email volume dominate afterwards.

## 14. Roadmap

Estimates assume a team of 3–4 engineers plus part-time design and QA.

| Phase | Weeks | Outcome |
|---|---|---|
| 0. Foundations | 2 | Repo, CI, environments, Docker Compose, schema skeleton, shared types, OpenAPI, observability |
| 1. Identity and tenancy | 4 | Tenants, hostname resolution, accounts, full auth flows from §5 (password, OTP, email verification, reset, invite, sessions, audit), RLS and isolation tests, super-admin console |
| 2. Custom domains | 2 | Domain records, DNS verification worker, automatic TLS, per-tenant email identities |
| 3. Core academics | 5 | People, departments and HOD, timetable, attendance, events, help desk, profile changes, file uploads |
| 4. Fees and finance | 6 | Fee structures, payment gateway and webhooks, receipts, invoices, bills, GST/TDS, bank import and reconciliation, reports, audit trail |
| 5. Workflow and communication | 4 | Requests and leave approvals, chat, realtime gateway, notifications, email/SMS queue |
| 6. Hardening and pilot | 4 | Pen-test fixes, load test, backups and restore drill, DPDP checklist, pilot college, support runbook |
| 7. Next modules | ongoing | Marks and results, exam cell, payroll, parent portal, admissions, certificates, NAAC/NIRF data packs |

Phases 1–2 can ship to a pilot behind the existing UI as soon as they are done: the sign-in, verification and domain pages are already built.

## 15. Decisions needed from you

1. **Hosting and region:** AWS, GCP, Azure or an Indian provider; Indian data residency required?
2. **Stack:** TypeScript/Node (recommended for shared types) or your team's existing stack?
3. **Email and SMS providers:** SES/SendGrid/Mailgun; an SMS vendor with DLT support; WhatsApp Business?
4. **Payment gateway:** Razorpay, PayU or Stripe; settlement per college or to the platform?
5. **Custom-domain TLS:** Cloudflare for SaaS (simplest) or self-hosted Caddy / cert-manager?
6. **Second factor policy:** email code only, or also SMS/TOTP/passkeys, and should some roles (admin, accounts) be forced?
7. **SSO:** which colleges need Google or Microsoft sign-in at launch?
8. **Pricing model:** per student, per college or per module; this drives the quota enforcement design.
9. **Compliance owner:** who is the grievance officer and data protection contact for the platform?
