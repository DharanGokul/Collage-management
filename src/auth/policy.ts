/** Password rules and display helpers shared by the sign-up, reset and profile forms. */

export const PASSWORD_MIN = 8

export interface PasswordCheck {
  ok: boolean
  /** 0 (empty) – 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4
  rules: { id: string; label: string; ok: boolean }[]
}

const COMMON = new Set(['password', 'password1', 'password123', 'qwerty123', '12345678', '123456789', 'iloveyou', 'admin123', 'welcome1', 'college123', 'demo1234'])

export function checkPassword(pw: string, personal: string[] = []): PasswordCheck {
  const lower = pw.toLowerCase()
  const rules = [
    { id: 'len', label: `At least ${PASSWORD_MIN} characters`, ok: pw.length >= PASSWORD_MIN },
    { id: 'case', label: 'Upper and lower case letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { id: 'num', label: 'A number', ok: /\d/.test(pw) },
    { id: 'sym', label: 'A symbol (e.g. @ # ! %)', ok: /[^A-Za-z0-9]/.test(pw) },
    {
      id: 'common',
      label: 'Not a common or personal password',
      ok: pw.length > 0 && !COMMON.has(lower) && !personal.some((p) => p.length >= 4 && lower.includes(p.toLowerCase())),
    },
  ]
  const required = rules.filter((r) => r.id === 'len' || r.id === 'case' || r.id === 'num' || r.id === 'common').every((r) => r.ok)
  const passed = rules.filter((r) => r.ok).length
  const score = (pw.length === 0 ? 0 : Math.min(4, Math.max(1, passed - (pw.length < 10 ? 1 : 0)))) as PasswordCheck['score']
  return { ok: required, score, rules }
}

export const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const

export function maskEmail(email: string): string {
  const [user, host] = email.split('@')
  if (!host) return email
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${host}`
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}
