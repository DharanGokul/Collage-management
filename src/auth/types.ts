import type { Role } from '../types'

/** `super` is the platform operator; everyone else belongs to one college (tenant). */
export type AccountRole = Role | 'super'

/**
 * Stored shapes. They deliberately mirror what a backend `accounts`, `auth_challenges`
 * and `trusted_devices` table would hold (see docs/backend-plan.md), so the UI never
 * depends on where the data lives.
 */
export interface Account {
  id: string
  role: AccountRole
  /** Id of the person in the college directory (student id, staff id, 'admin'…). */
  subjectId: string
  email: string
  name: string
  passwordHash: string
  salt: string
  iterations: number
  /** `invited` accounts have no usable password until the activation link is used. */
  status: 'active' | 'invited' | 'disabled'
  emailVerified: boolean
  failedAttempts: number
  lockedUntil: number | null
  lastLoginAt: string | null
  passwordChangedAt: string | null
  createdAt: string
}

export type ChallengeKind = 'otp' | 'email_verify' | 'password_reset' | 'invite'

export interface Challenge {
  id: string
  accountId: string
  kind: ChallengeKind
  /** SHA-256 of `salt + secret`; the secret itself is only ever sent to the user. */
  secretHash: string
  salt: string
  expiresAt: number
  attempts: number
  sends: number
  lastSentAt: number
  consumedAt: number | null
  /** Carried from the sign-in so the session length is decided once. */
  remember: boolean
}

export interface TrustedDevice {
  accountId: string
  tokenHash: string
  expiresAt: number
}

export interface AuthEvent {
  at: string
  accountId: string | null
  type: 'sign_in' | 'sign_in_failed' | 'locked' | 'otp_sent' | 'otp_failed' | 'email_verified' | 'password_reset_requested' | 'password_changed' | 'activated' | 'sign_out'
  detail?: string
}

export interface AuthPolicy {
  /** `new_device`: ask for a code unless this browser was trusted before. */
  otp: 'off' | 'new_device' | 'always'
  sessionHours: number
  rememberDays: number
  trustDeviceDays: number
}

export interface AuthDb {
  v: 1
  accounts: Account[]
  challenges: Challenge[]
  devices: TrustedDevice[]
  policy: AuthPolicy
  audit: AuthEvent[]
}

export interface AuthSession {
  role: AccountRole
  userId: string
  name: string
  /** Account id, so a password change can be checked against the right record. */
  aid: string
  /** Expiry, ms since epoch. */
  exp: number
}

/** The person as the college directory knows them. */
export interface Person {
  subjectId: string
  name: string
  email: string
  active: boolean
}

export interface AuthMail {
  id: string
  at: string
  to: string
  subject: string
  body: string
  kind: ChallengeKind | 'notice'
  /** Shown in the demo inbox so the flow can be tried without a mail server. */
  code?: string
  link?: string
}

/** What the auth service needs from the college it is running for. */
export interface Directory {
  scope: string
  /** Base for links inside emails: the college's own domain when it has one. */
  linkBase: string
  brand: { name: string; supportEmail: string }
  find(role: AccountRole, identifier: string): Person | null
  findByEmail(email: string): { role: AccountRole; person: Person } | null
  deliver(mail: AuthMail): Promise<void>
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'locked'
  | 'inactive'
  | 'invalid_code'
  | 'code_expired'
  | 'too_many_attempts'
  | 'resend_wait'
  | 'resend_limit'
  | 'invalid_link'
  | 'weak_password'
  | 'wrong_password'
  | 'not_found'

export class AuthError extends Error {
  code: AuthErrorCode
  /** Seconds until the user may try again (locked / resend_wait). */
  retryAfter?: number
  attemptsLeft?: number
  constructor(code: AuthErrorCode, message: string, extra: { retryAfter?: number; attemptsLeft?: number } = {}) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.retryAfter = extra.retryAfter
    this.attemptsLeft = extra.attemptsLeft
  }
}
