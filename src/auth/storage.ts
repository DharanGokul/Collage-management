import type { AuthDb, AuthPolicy } from './types'

/**
 * JSON auth store — one document per scope (college id, or `platform`).
 * Front-end stand-in for the backend `accounts` / `auth_challenges` tables.
 * Passwords and codes are only ever stored as salted hashes.
 */

export const DEFAULT_POLICY: AuthPolicy = { otp: 'new_device', sessionHours: 12, rememberDays: 14, trustDeviceDays: 30 }

const key = (scope: string) => `cms:auth:${scope}`
const memory = new Map<string, string>()

function emptyDb(): AuthDb {
  return { v: 1, accounts: [], challenges: [], devices: [], policy: { ...DEFAULT_POLICY }, audit: [] }
}

export function loadAuthDb(scope: string): AuthDb {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key(scope))
  } catch {
    raw = memory.get(scope) ?? null
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AuthDb
      if (parsed?.v === 1 && Array.isArray(parsed.accounts)) return { ...emptyDb(), ...parsed, policy: { ...DEFAULT_POLICY, ...parsed.policy } }
    } catch {
      /* corrupt: start clean rather than lock everyone out with an exception */
    }
  }
  return emptyDb()
}

export function saveAuthDb(scope: string, db: AuthDb) {
  const now = Date.now()
  // Drop spent material so the document stays small.
  db.challenges = db.challenges.filter((c) => c.expiresAt > now - 86_400_000 && !(c.consumedAt && c.consumedAt < now - 3_600_000)).slice(-200)
  db.devices = db.devices.filter((d) => d.expiresAt > now)
  db.audit = db.audit.slice(-200)
  const json = JSON.stringify(db)
  try {
    localStorage.setItem(key(scope), json)
  } catch {
    memory.set(scope, json)
  }
}

export function removeAuthDb(scope: string) {
  try {
    localStorage.removeItem(key(scope))
  } catch {
    /* ignore */
  }
  memory.delete(scope)
}

/* ---- Demo mailbox: where "sent" emails land so the flows can be tried without a mail server ---- */

import type { AuthMail } from './types'
const mailKey = (scope: string) => `cms:mailbox:${scope}`

export function readMailbox(scope: string): AuthMail[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(mailKey(scope)) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function pushMailbox(scope: string, mail: AuthMail) {
  try {
    localStorage.setItem(mailKey(scope), JSON.stringify([...readMailbox(scope), mail].slice(-25)))
    window.dispatchEvent(new CustomEvent('cms:mailbox', { detail: scope }))
  } catch {
    /* ignore */
  }
}

export function clearMailbox(scope: string) {
  try {
    localStorage.removeItem(mailKey(scope))
    window.dispatchEvent(new CustomEvent('cms:mailbox', { detail: scope }))
  } catch {
    /* ignore */
  }
}

/** Trusted-device token lives in this browser only (the server keeps its hash). */
const deviceKey = (scope: string) => `cms:device:${scope}`
export function readDeviceToken(scope: string): string | null {
  try {
    return localStorage.getItem(deviceKey(scope))
  } catch {
    return null
  }
}
export function writeDeviceToken(scope: string, token: string | null) {
  try {
    if (token) localStorage.setItem(deviceKey(scope), token)
    else localStorage.removeItem(deviceKey(scope))
  } catch {
    /* ignore */
  }
}
