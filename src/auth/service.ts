import { pbkdf2, randomCode, randomToken, safeEqual, secureCryptoAvailable, sha256 } from './crypto'
import { checkPassword, maskEmail } from './policy'
import { loadAuthDb, saveAuthDb } from './storage'
import { AuthError } from './types'
import type { Account, AccountRole, AuthDb, AuthEvent, AuthMail, AuthSession, Challenge, ChallengeKind, Directory, Person } from './types'

/**
 * Authentication service. Every exported function maps onto one REST endpoint of the planned backend
 * (POST /auth/sign-in, /auth/otp/verify, /auth/otp/resend, /auth/email/verify, /auth/password/forgot,
 * /auth/password/reset, /auth/activate, /auth/password/change) — see docs/backend-plan.md.
 * The UI only talks to these functions, so swapping this file for HTTP calls changes nothing else.
 */

/** Demo builds pre-provision accounts with this password. Set VITE_AUTH_DEMO=false to use invite-only activation. */
export const AUTH_DEMO: boolean = import.meta.env.VITE_AUTH_DEMO !== 'false'
export const DEMO_PASSWORD = 'Demo@1234'

const ITERATIONS = 120_000
const OTP_TTL = 5 * 60_000
const OTP_MAX_ATTEMPTS = 5
const OTP_RESEND_WAIT = 30_000
const OTP_MAX_SENDS = 5
const RESET_TTL = 60 * 60_000
const VERIFY_TTL = 24 * 60 * 60_000
const INVITE_TTL = 72 * 60 * 60_000
const LOCK_AFTER = 5
const LOCK_MS = 5 * 60_000

export type SignInResult =
  | { status: 'ok'; session: AuthSession; remember: boolean; deviceToken?: string }
  | { status: 'otp'; challengeId: string; sentTo: string; expiresAt: number; resendAfter: number }
  | { status: 'unverified'; email: string }
  | { status: 'invited'; email: string }

export interface SignInInput {
  role: AccountRole
  identifier: string
  password: string
  remember: boolean
  deviceToken: string | null
}

const nowIso = () => new Date().toISOString()

function requireSecureContext() {
  if (!secureCryptoAvailable()) throw new AuthError('insecure_context', 'Secure sign-in needs an HTTPS connection. Open this portal with https:// in the address bar.')
}
const uid = (p: string) => `${p}-${randomToken(9)}`

function audit(db: AuthDb, type: AuthEvent['type'], accountId: string | null, detail?: string) {
  db.audit.push({ at: nowIso(), accountId, type, detail })
}

async function hashPassword(pw: string) {
  const salt = randomToken(16)
  return { salt, iterations: ITERATIONS, passwordHash: await pbkdf2(pw, salt, ITERATIONS) }
}

async function passwordMatches(a: Account, pw: string) {
  return safeEqual(await pbkdf2(pw, a.salt, a.iterations), a.passwordHash)
}

const secretHash = (salt: string, secret: string) => sha256(`${salt}:${secret}`)

async function issue(db: AuthDb, account: Account, kind: ChallengeKind, ttl: number, secret: string, remember = false, previous?: Challenge) {
  const salt = randomToken(12)
  const c: Challenge = previous ?? {
    id: uid('ch'),
    accountId: account.id,
    kind,
    secretHash: '',
    salt,
    expiresAt: 0,
    attempts: 0,
    sends: 0,
    lastSentAt: 0,
    consumedAt: null,
    remember,
  }
  c.salt = salt
  c.secretHash = await secretHash(salt, secret)
  c.expiresAt = Date.now() + ttl
  c.attempts = 0
  c.sends += 1
  c.lastSentAt = Date.now()
  if (!previous) db.challenges.push(c)
  return c
}

/** A link token is `<challengeId>.<secret>`; only the hash of the secret is stored. */
async function redeem(db: AuthDb, token: string, kind: ChallengeKind): Promise<{ challenge: Challenge; account: Account }> {
  const [id, secret] = token.split('.')
  const challenge = db.challenges.find((c) => c.id === id && c.kind === kind)
  if (!challenge || !secret || challenge.consumedAt || challenge.expiresAt < Date.now()) throw new AuthError('invalid_link', 'This link is invalid or has expired. Request a new one.')
  if (!safeEqual(await secretHash(challenge.salt, secret), challenge.secretHash)) throw new AuthError('invalid_link', 'This link is invalid or has expired. Request a new one.')
  const account = db.accounts.find((a) => a.id === challenge.accountId)
  if (!account) throw new AuthError('invalid_link', 'This link is invalid or has expired. Request a new one.')
  return { challenge, account }
}

function link(dir: Directory, path: string, id: string, secret: string) {
  return `${dir.linkBase}#/${path}?token=${encodeURIComponent(`${id}.${secret}`)}`
}

async function send(dir: Directory, to: string, kind: AuthMail['kind'], subject: string, lines: string[], extra: { code?: string; link?: string } = {}) {
  const body = [...lines, '', `— ${dir.brand.name}`, dir.brand.supportEmail ? `Need help? ${dir.brand.supportEmail}` : ''].filter((l, i, a) => l || a[i - 1]).join('\n')
  await dir.deliver({ id: uid('mail'), at: nowIso(), to, subject: `${subject} · ${dir.brand.name}`, body, kind, ...extra })
}

function expires(ms: number) {
  const m = Math.round(ms / 60_000)
  return m >= 120 ? `${Math.round(m / 60)} hours` : `${m} minutes`
}

/* ------------------------------------------------------------------ accounts */

async function ensureAccount(db: AuthDb, role: AccountRole, person: Person): Promise<{ account: Account; created: boolean }> {
  const found = db.accounts.find((a) => a.role === role && a.subjectId === person.subjectId)
  if (found) {
    // Keep the e-mail in step with the directory; a changed address must be verified again.
    if (found.email.toLowerCase() !== person.email.toLowerCase()) {
      found.email = person.email
      found.emailVerified = AUTH_DEMO
    }
    found.name = person.name
    return { account: found, created: false }
  }
  // Demo: new people can sign in with the demo password. Otherwise they must activate through an invite link.
  const hp = await hashPassword(AUTH_DEMO ? DEMO_PASSWORD : randomToken(24))
  const account: Account = {
    id: uid('acc'),
    role,
    subjectId: person.subjectId,
    email: person.email,
    name: person.name,
    ...hp,
    status: AUTH_DEMO ? 'active' : 'invited',
    emailVerified: AUTH_DEMO,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: nowIso(),
  }
  db.accounts.push(account)
  return { account, created: true }
}

function startSession(db: AuthDb, account: Account, remember: boolean): AuthSession {
  const ms = remember ? db.policy.rememberDays * 86_400_000 : db.policy.sessionHours * 3_600_000
  account.lastLoginAt = nowIso()
  account.failedAttempts = 0
  account.lockedUntil = null
  audit(db, 'sign_in', account.id)
  return { role: account.role, userId: account.subjectId, name: account.name, aid: account.id, exp: Date.now() + ms }
}

async function sendOtp(dir: Directory, db: AuthDb, account: Account, remember: boolean, previous?: Challenge) {
  const code = randomCode(6)
  const c = await issue(db, account, 'otp', OTP_TTL, code, remember, previous)
  audit(db, 'otp_sent', account.id)
  await send(dir, account.email, 'otp', 'Your sign-in code', [`Hi ${account.name.split(' ')[0]},`, '', `Your verification code is ${code}.`, `It expires in ${expires(OTP_TTL)}. If this wasn't you, change your password.`], { code })
  return c
}

async function sendVerification(dir: Directory, db: AuthDb, account: Account) {
  const secret = randomToken(24)
  const c = await issue(db, account, 'email_verify', VERIFY_TTL, secret)
  const url = link(dir, 'verify-email', c.id, secret)
  await send(dir, account.email, 'email_verify', 'Verify your email address', [`Hi ${account.name.split(' ')[0]},`, '', 'Confirm this email address to finish setting up your account:', url, '', `The link works for ${expires(VERIFY_TTL)}.`], { link: url })
}

async function sendInvite(dir: Directory, db: AuthDb, account: Account) {
  const secret = randomToken(24)
  const c = await issue(db, account, 'invite', INVITE_TTL, secret)
  const url = link(dir, 'activate', c.id, secret)
  await send(dir, account.email, 'invite', 'Activate your account', [`Hi ${account.name.split(' ')[0]},`, '', `An account has been created for you on ${dir.brand.name}. Choose a password to activate it:`, url, '', `The link works for ${expires(INVITE_TTL)}.`], { link: url })
}

/* ------------------------------------------------------------------ sign-in */

export async function signIn(dir: Directory, input: SignInInput): Promise<SignInResult> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const person = dir.find(input.role, input.identifier)
  const generic = new AuthError('invalid_credentials', 'Incorrect ID or password.')

  if (!person) {
    await pbkdf2(input.password, 'x'.repeat(16), ITERATIONS) // same cost as a real check: no user enumeration by timing
    throw generic
  }
  const { account } = await ensureAccount(db, input.role, person)

  if (account.status === 'invited') {
    await sendInvite(dir, db, account)
    saveAuthDb(dir.scope, db)
    return { status: 'invited', email: account.email }
  }
  if (account.lockedUntil && account.lockedUntil > Date.now()) {
    throw new AuthError('locked', 'Too many attempts. Try again later.', { retryAfter: Math.ceil((account.lockedUntil - Date.now()) / 1000) })
  }
  if (!(await passwordMatches(account, input.password))) {
    account.failedAttempts += 1
    audit(db, 'sign_in_failed', account.id)
    if (account.failedAttempts >= LOCK_AFTER) {
      account.lockedUntil = Date.now() + LOCK_MS
      account.failedAttempts = 0
      audit(db, 'locked', account.id)
      saveAuthDb(dir.scope, db)
      throw new AuthError('locked', 'Too many attempts. Try again later.', { retryAfter: LOCK_MS / 1000 })
    }
    saveAuthDb(dir.scope, db)
    throw new AuthError('invalid_credentials', 'Incorrect ID or password.', { attemptsLeft: LOCK_AFTER - account.failedAttempts })
  }
  if (!person.active || account.status === 'disabled') {
    saveAuthDb(dir.scope, db)
    throw new AuthError('inactive', 'This account is inactive. Contact your college office.')
  }
  if (!account.emailVerified) {
    await sendVerification(dir, db, account)
    saveAuthDb(dir.scope, db)
    return { status: 'unverified', email: account.email }
  }

  const deviceHash = input.deviceToken ? await sha256(input.deviceToken) : null
  const trusted = !!deviceHash && db.devices.some((d) => d.accountId === account.id && d.expiresAt > Date.now() && safeEqual(d.tokenHash, deviceHash))
  const needsOtp = account.role === 'super' || db.policy.otp === 'always' || (db.policy.otp === 'new_device' && !trusted)
  if (needsOtp) {
    const c = await sendOtp(dir, db, account, input.remember)
    saveAuthDb(dir.scope, db)
    return { status: 'otp', challengeId: c.id, sentTo: maskEmail(account.email), expiresAt: c.expiresAt, resendAfter: c.lastSentAt + OTP_RESEND_WAIT }
  }
  const session = startSession(db, account, input.remember)
  saveAuthDb(dir.scope, db)
  return { status: 'ok', session, remember: input.remember }
}

export async function verifyOtp(dir: Directory, input: { challengeId: string; code: string; trustDevice: boolean }): Promise<{ session: AuthSession; remember: boolean; deviceToken?: string }> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const c = db.challenges.find((x) => x.id === input.challengeId && x.kind === 'otp')
  const account = c && db.accounts.find((a) => a.id === c.accountId)
  if (!c || !account || c.consumedAt) throw new AuthError('code_expired', 'This code is no longer valid. Sign in again.')
  if (c.expiresAt < Date.now()) throw new AuthError('code_expired', 'This code has expired. Request a new one.')
  if (c.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError('too_many_attempts', 'Too many wrong codes. Request a new code.')
  const code = input.code.replace(/\s+/g, '')
  if (!safeEqual(await secretHash(c.salt, code), c.secretHash)) {
    c.attempts += 1
    audit(db, 'otp_failed', account.id)
    saveAuthDb(dir.scope, db)
    const left = OTP_MAX_ATTEMPTS - c.attempts
    throw new AuthError(left > 0 ? 'invalid_code' : 'too_many_attempts', left > 0 ? `That code is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong codes. Request a new code.', { attemptsLeft: left })
  }
  c.consumedAt = Date.now()
  let deviceToken: string | undefined
  if (input.trustDevice) {
    deviceToken = randomToken(24)
    db.devices.push({ accountId: account.id, tokenHash: await sha256(deviceToken), expiresAt: Date.now() + db.policy.trustDeviceDays * 86_400_000 })
  }
  const session = startSession(db, account, c.remember)
  saveAuthDb(dir.scope, db)
  return { session, remember: c.remember, deviceToken }
}

export async function resendOtp(dir: Directory, challengeId: string): Promise<{ expiresAt: number; resendAfter: number }> {
  const db = loadAuthDb(dir.scope)
  const c = db.challenges.find((x) => x.id === challengeId && x.kind === 'otp')
  const account = c && db.accounts.find((a) => a.id === c.accountId)
  if (!c || !account || c.consumedAt) throw new AuthError('code_expired', 'This sign-in has expired. Start again.')
  const wait = c.lastSentAt + OTP_RESEND_WAIT - Date.now()
  if (wait > 0) throw new AuthError('resend_wait', `Wait ${Math.ceil(wait / 1000)}s before asking for another code.`, { retryAfter: Math.ceil(wait / 1000) })
  if (c.sends >= OTP_MAX_SENDS) throw new AuthError('resend_limit', 'Too many codes requested. Sign in again later.')
  const next = await sendOtp(dir, db, account, c.remember, c)
  saveAuthDb(dir.scope, db)
  return { expiresAt: next.expiresAt, resendAfter: next.lastSentAt + OTP_RESEND_WAIT }
}

/* ------------------------------------------------------------ email verification */

export async function verifyEmail(dir: Directory, token: string): Promise<{ email: string }> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const { challenge, account } = await redeem(db, token, 'email_verify')
  challenge.consumedAt = Date.now()
  account.emailVerified = true
  audit(db, 'email_verified', account.id)
  saveAuthDb(dir.scope, db)
  return { email: account.email }
}

/** Always resolves, so the response never reveals whether an address has an account. */
export async function resendVerification(dir: Directory, email: string): Promise<void> {
  requireSecureContext()
  const hit = dir.findByEmail(email)
  if (!hit) return
  const db = loadAuthDb(dir.scope)
  const { account } = await ensureAccount(db, hit.role, hit.person)
  if (!account.emailVerified && account.status !== 'invited') await sendVerification(dir, db, account)
  else if (account.status === 'invited') await sendInvite(dir, db, account)
  saveAuthDb(dir.scope, db)
}

/* ------------------------------------------------------------- password reset */

export async function requestPasswordReset(dir: Directory, email: string): Promise<void> {
  requireSecureContext()
  const hit = dir.findByEmail(email)
  if (!hit || !hit.person.active) return
  const db = loadAuthDb(dir.scope)
  const { account } = await ensureAccount(db, hit.role, hit.person)
  const secret = randomToken(24)
  const c = await issue(db, account, 'password_reset', RESET_TTL, secret)
  audit(db, 'password_reset_requested', account.id)
  const url = link(dir, 'reset-password', c.id, secret)
  await send(dir, account.email, 'password_reset', 'Reset your password', [`Hi ${account.name.split(' ')[0]},`, '', 'Use this link to choose a new password:', url, '', `It works for ${expires(RESET_TTL)} and only once. If you didn't ask for this, ignore this email.`], { link: url })
  saveAuthDb(dir.scope, db)
}

/** Reads a token without spending it, so the page can show the right form (or an error) first. */
export async function inspectToken(dir: Directory, token: string, kind: 'password_reset' | 'invite'): Promise<{ email: string; name: string }> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const { account } = await redeem(db, token, kind)
  return { email: maskEmail(account.email), name: account.name }
}

async function setPassword(db: AuthDb, account: Account, password: string) {
  const issues = checkPassword(password, [account.email.split('@')[0], account.name])
  if (!issues.ok) throw new AuthError('weak_password', 'Choose a stronger password.')
  Object.assign(account, await hashPassword(password), { passwordChangedAt: nowIso(), failedAttempts: 0, lockedUntil: null })
  // Every trusted browser and pending code is revoked when the password changes.
  db.devices = db.devices.filter((d) => d.accountId !== account.id)
  for (const c of db.challenges) if (c.accountId === account.id && c.kind === 'otp') c.consumedAt = Date.now()
}

export async function resetPassword(dir: Directory, token: string, password: string): Promise<void> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const { challenge, account } = await redeem(db, token, 'password_reset')
  await setPassword(db, account, password)
  challenge.consumedAt = Date.now()
  audit(db, 'password_changed', account.id, 'reset')
  await send(dir, account.email, 'notice', 'Your password was changed', [`Hi ${account.name.split(' ')[0]},`, '', 'Your password was just changed. If this was not you, reset it again and contact your college office.'])
  saveAuthDb(dir.scope, db)
}

export async function activateAccount(dir: Directory, token: string, password: string): Promise<void> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const { challenge, account } = await redeem(db, token, 'invite')
  await setPassword(db, account, password)
  account.status = 'active'
  account.emailVerified = true // receiving the invite proves control of the address
  challenge.consumedAt = Date.now()
  audit(db, 'activated', account.id)
  saveAuthDb(dir.scope, db)
}

export async function changePassword(dir: Directory, session: Pick<AuthSession, 'aid'>, current: string, next: string): Promise<void> {
  requireSecureContext()
  const db = loadAuthDb(dir.scope)
  const account = db.accounts.find((a) => a.id === session.aid)
  if (!account) throw new AuthError('not_found', 'Your account could not be found. Sign in again.')
  if (!(await passwordMatches(account, current))) throw new AuthError('wrong_password', 'Your current password is not right.')
  if (current === next) throw new AuthError('weak_password', 'Choose a password you have not used just now.')
  await setPassword(db, account, next)
  audit(db, 'password_changed', account.id, 'profile')
  await send(dir, account.email, 'notice', 'Your password was changed', [`Hi ${account.name.split(' ')[0]},`, '', 'Your password was just changed from your profile. If this was not you, reset it right away.'])
  saveAuthDb(dir.scope, db)
}

export function recordSignOut(scope: string, aid: string) {
  const db = loadAuthDb(scope)
  audit(db, 'sign_out', aid)
  saveAuthDb(scope, db)
}

/** Whether an account is known and verified — used by the guard to drop sessions of removed accounts. */
export function isSessionValid(scope: string, s: Pick<AuthSession, 'aid' | 'exp'>): boolean {
  if (s.exp < Date.now()) return false
  const a = loadAuthDb(scope).accounts.find((x) => x.id === s.aid)
  return !!a && a.status === 'active'
}

export function getPolicy(scope: string) {
  return loadAuthDb(scope).policy
}

export function setPolicy(scope: string, patch: Partial<AuthDb['policy']>) {
  const db = loadAuthDb(scope)
  db.policy = { ...db.policy, ...patch }
  saveAuthDb(scope, db)
}

export function recentAuthEvents(scope: string, limit = 20) {
  return loadAuthDb(scope).audit.slice(-limit).reverse()
}
