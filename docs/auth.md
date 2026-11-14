# Authentication (front-end phase)

Sign-in works end to end in the browser so the whole experience can be built, tested and demonstrated before a backend exists. Everything is behind `src/auth/service.ts`, whose functions mirror the future REST endpoints one-to-one (table in [backend-plan.md §5](backend-plan.md#5-authentication-and-authorisation)). Replacing that file with HTTP calls changes no page.

## What it does

| Flow | Pages | Behaviour |
|---|---|---|
| Sign in | `/login` | Role, ID or email, password. "Keep me signed in" lengthens the session. |
| One-time code | step 2 of `/login` | 6-digit code emailed on a new browser. 5 minutes, 5 tries, 30 s resend cooldown, 5 sends. "Trust this browser for 30 days". |
| Email verification | `/verify-email?token=` | Unverified addresses cannot sign in; a link is sent. Single use, 24 h. |
| Forgot / reset password | `/forgot-password`, `/reset-password?token=` | Always answers "check your email" (no account enumeration). Single use, 1 h. Resetting signs out trusted browsers. |
| Account activation | `/activate?token=` | People added by an admin get an invite link to choose a password (production mode). 72 h. |
| Change password | Profile → Password | Needs the current password; live strength checklist; confirmation email. |
| Platform console | `/super/login` | Same service in its own `platform` scope; a code is always required. |

## Security properties

- **Passwords** are hashed with PBKDF2-SHA256 (120,000 iterations, random 128-bit salt) through WebCrypto. They are never stored or logged in readable form.
- **Codes and link tokens** come from a CSPRNG, are stored only as salted SHA-256 hashes, expire, and can be used once.
- **Lockout:** 5 wrong passwords lock the account for 5 minutes. Unknown IDs and wrong passwords return the same message and cost the same time.
- **Password rules:** 8+ characters, upper and lower case, a number, not a common or personal password. The checklist is shown while typing.
- **Sessions** carry an expiry (12 h, or 14 days with "Keep me signed in") and end by themselves.
- **Audit trail:** sign-ins, failures, locks, code sends, resets and password changes are recorded in the auth store.
- **Plain HTTP:** hashing needs a secure context. Over `http://` (except localhost) the sign-in page explains that HTTPS is required instead of failing silently.

## Where data lives

One JSON document per college in `localStorage`:

| Key | Content |
|---|---|
| `cms:auth:<tenantId>` | `{ v, accounts[], challenges[], devices[], policy, audit[] }` (hashes only) |
| `cms:session:<tenantId>` | Current session; `sessionStorage`, or `localStorage` with "Keep me signed in" |
| `cms:device:<tenantId>` | This browser's trusted-device token |
| `cms:mailbox:<scope>` | Demo inbox (demo mode only) |

The document shapes in `src/auth/types.ts` are the intended database tables. This is a stand-in: anyone with access to the browser profile can read or edit it, which is why production moves it to the server (httpOnly cookies, server-side sessions, Argon2id).

## Demo mode

`VITE_AUTH_DEMO=true` (default):

- Every person in the college directory can sign in with the password **`Demo@1234`** on first use.
- Emails are not sent. Codes and links appear in the **Demo inbox** button on the sign-in pages.
- Policy default: a code is required on any browser that has not been trusted.

`VITE_AUTH_DEMO=false` (production-like):

- First sign-in of a person with no account sends an **activation link**; the person chooses a password.
- No demo inbox. If the college has configured real email (Settings → Email sending), codes and links go out through it.

## Policy

`policy.otp` is `off`, `new_device` (default) or `always`; session, remember-me and trusted-device lengths are in the same object (`src/auth/storage.ts`, `DEFAULT_POLICY`). A settings screen for this is a small follow-up.

## Tests

`src/auth/service.test.ts` exercises the real service with real WebCrypto: code issuing and expiry, attempt limits, resend cooldown, lockout and unlock, trusted devices, reset and activation links, email verification, and that no secret is stored readably. Run with `npm test`.
