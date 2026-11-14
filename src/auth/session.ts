import type { AuthSession } from './types'

/**
 * Where a signed-in session lives in the browser.
 * "Keep me signed in" uses localStorage; otherwise the session ends with the tab.
 * Production replaces this with an httpOnly, SameSite cookie issued by the backend, which script cannot read.
 */
const key = (scope: string) => `cms:session:${scope}`

export function loadSession(scope: string): AuthSession | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(key(scope))
      if (!raw) continue
      const s = JSON.parse(raw) as AuthSession
      if (s?.exp && s.exp > Date.now() && s.aid) return s
      store.removeItem(key(scope))
    } catch {
      /* unreadable → treat as signed out */
    }
  }
  return null
}

export function saveSession(scope: string, s: AuthSession, remember: boolean) {
  clearSession(scope)
  try {
    ;(remember ? localStorage : sessionStorage).setItem(key(scope), JSON.stringify(s))
  } catch {
    /* storage blocked: the in-memory session still works for this page view */
  }
}

export function clearSession(scope: string) {
  for (const store of [sessionStorage, localStorage]) {
    try {
      store.removeItem(key(scope))
    } catch {
      /* ignore */
    }
  }
}
