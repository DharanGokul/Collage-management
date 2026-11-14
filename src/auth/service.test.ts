// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthMail, Directory } from './types'
import { AuthError } from './types'

const STRONG = 'Campus#2026x'

function makeDir() {
  const mails: AuthMail[] = []
  const person = { subjectId: 's1', name: 'Stu Dent', email: 'stu@x.test', active: true }
  const dir: Directory = {
    scope: 't1',
    linkBase: 'https://portal.x.test/',
    brand: { name: 'X College', supportEmail: 'help@x.test' },
    find: (role, id) => (role === 'student' && id.toLowerCase() === '25x001' ? person : null),
    findByEmail: (e) => (e.toLowerCase() === person.email ? { role: 'student', person } : null),
    deliver: async (m) => { mails.push(m) },
  }
  const last = (kind: AuthMail['kind']) => [...mails].reverse().find((m) => m.kind === kind)
  return { dir, mails, last, person }
}

/** Load a fresh copy of the service so VITE_AUTH_DEMO is read again. */
async function load(demo: boolean) {
  vi.resetModules()
  vi.stubEnv('VITE_AUTH_DEMO', demo ? 'true' : 'false')
  return { svc: await import('./service'), storage: await import('./storage') }
}

const attempt = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e as AuthError)
const signIn = (svc: typeof import('./service'), dir: Directory, password: string, deviceToken: string | null = null) => svc.signIn(dir, { role: 'student', identifier: '25X001', password, remember: false, deviceToken })

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

describe('sign-in with one-time code (demo accounts)', () => {
  it('asks for a code on a new device, then issues a session', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    expect(res.status).toBe('otp')
    if (res.status !== 'otp') return
    expect(res.sentTo).toMatch(/@x\.test$/)
    const code = last('otp')!.code!
    expect(code).toMatch(/^\d{6}$/)
    const out = await svc.verifyOtp(dir, { challengeId: res.challengeId, code, trustDevice: false })
    expect(out.session).toMatchObject({ role: 'student', userId: 's1', name: 'Stu Dent' })
    expect(out.session.exp).toBeGreaterThan(Date.now())
  })

  it('never stores the password or the code in readable form', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    await signIn(svc, dir, svc.DEMO_PASSWORD)
    const stored = localStorage.getItem('cms:auth:t1')!
    expect(stored).toContain('passwordHash')
    expect(stored).not.toContain(svc.DEMO_PASSWORD)
    expect(stored).not.toContain(last('otp')!.code!)
  })

  it('gives unknown IDs and wrong passwords the same message', async () => {
    const { svc } = await load(true)
    const { dir } = makeDir()
    const wrong = await attempt(signIn(svc, dir, 'Wrong#Pass1'))
    const unknown = await attempt(svc.signIn(dir, { role: 'student', identifier: 'nobody', password: 'Wrong#Pass1', remember: false, deviceToken: null }))
    expect(wrong?.code).toBe('invalid_credentials')
    expect(unknown?.code).toBe('invalid_credentials')
    expect(unknown?.message).toBe(wrong?.message)
  })

  it('locks the account after 5 wrong passwords, even for the right one', async () => {
    const { svc } = await load(true)
    const { dir } = makeDir()
    for (let i = 0; i < 4; i++) expect((await attempt(signIn(svc, dir, 'Wrong#Pass1')))?.code).toBe('invalid_credentials')
    const fifth = await attempt(signIn(svc, dir, 'Wrong#Pass1'))
    expect(fifth?.code).toBe('locked')
    expect(fifth?.retryAfter).toBeGreaterThan(0)
    expect((await attempt(signIn(svc, dir, svc.DEMO_PASSWORD)))?.code).toBe('locked')
  })

  it('unlocks after the lock period', async () => {
    const { svc } = await load(true)
    const { dir } = makeDir()
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 0; i < 5; i++) await attempt(signIn(svc, dir, 'Wrong#Pass1'))
    vi.setSystemTime(Date.now() + 6 * 60_000)
    expect((await signIn(svc, dir, svc.DEMO_PASSWORD)).status).toBe('otp')
  })
})

describe('one-time code rules', () => {
  it('counts wrong codes and kills the challenge after 5', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    if (res.status !== 'otp') throw new Error('expected otp')
    const real = last('otp')!.code!
    const wrong = real === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code: wrong, trustDevice: false })))?.code).toBe('invalid_code')
    expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code: wrong, trustDevice: false })))?.code).toBe('too_many_attempts')
    expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code: real, trustDevice: false })))?.code).toBe('too_many_attempts')
  })

  it('expires after 5 minutes', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    vi.useFakeTimers({ toFake: ['Date'] })
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    if (res.status !== 'otp') throw new Error('expected otp')
    vi.setSystemTime(Date.now() + 6 * 60_000)
    expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code: last('otp')!.code!, trustDevice: false })))?.code).toBe('code_expired')
  })

  it('cannot be used twice', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    if (res.status !== 'otp') throw new Error('expected otp')
    const code = last('otp')!.code!
    await svc.verifyOtp(dir, { challengeId: res.challengeId, code, trustDevice: false })
    expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code, trustDevice: false })))?.code).toBe('code_expired')
  })

  it('limits resending: cooldown first, then a fresh code that replaces the old one', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    vi.useFakeTimers({ toFake: ['Date'] })
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    if (res.status !== 'otp') throw new Error('expected otp')
    const first = last('otp')!.code!
    expect((await attempt(svc.resendOtp(dir, res.challengeId)))?.code).toBe('resend_wait')
    vi.setSystemTime(Date.now() + 31_000)
    await svc.resendOtp(dir, res.challengeId)
    const second = last('otp')!.code!
    if (first !== second) expect((await attempt(svc.verifyOtp(dir, { challengeId: res.challengeId, code: first, trustDevice: false })))?.code).toBe('invalid_code')
    expect((await svc.verifyOtp(dir, { challengeId: res.challengeId, code: second, trustDevice: false })).session.userId).toBe('s1')
  })
})

describe('trusted devices', () => {
  it('skips the code on a trusted browser until the password changes', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    if (res.status !== 'otp') throw new Error('expected otp')
    const done = await svc.verifyOtp(dir, { challengeId: res.challengeId, code: last('otp')!.code!, trustDevice: true })
    expect(done.deviceToken).toBeTruthy()

    const again = await signIn(svc, dir, svc.DEMO_PASSWORD, done.deviceToken!)
    expect(again.status).toBe('ok')

    await svc.changePassword(dir, { aid: done.session.aid }, svc.DEMO_PASSWORD, STRONG)
    const after = await signIn(svc, dir, STRONG, done.deviceToken!)
    expect(after.status).toBe('otp')
  })
})

describe('forgot and reset password', () => {
  it('sends nothing for an unknown address', async () => {
    const { svc } = await load(true)
    const { dir, mails } = makeDir()
    await svc.requestPasswordReset(dir, 'nobody@x.test')
    expect(mails).toHaveLength(0)
  })

  it('resets with a strong password, once, and kills the old password', async () => {
    const { svc, storage } = await load(true)
    const { dir, last } = makeDir()
    await svc.requestPasswordReset(dir, 'stu@x.test')
    const link = last('password_reset')!.link!
    expect(link.startsWith('https://portal.x.test/#/reset-password?token=')).toBe(true)
    const token = decodeURIComponent(new URL(link.replace('#/', '')).searchParams.get('token')!)

    expect((await attempt(svc.resetPassword(dir, token, 'password1')))?.code).toBe('weak_password')
    await svc.resetPassword(dir, token, STRONG)
    expect((await attempt(svc.resetPassword(dir, token, 'Another#Pass9')))?.code).toBe('invalid_link')

    storage.saveAuthDb('t1', { ...storage.loadAuthDb('t1'), policy: { ...storage.loadAuthDb('t1').policy, otp: 'off' } })
    expect((await attempt(signIn(svc, dir, svc.DEMO_PASSWORD)))?.code).toBe('invalid_credentials')
    expect((await signIn(svc, dir, STRONG)).status).toBe('ok')
    expect(last('notice')?.subject).toContain('password was changed')
  })

  it('rejects tampered or expired tokens', async () => {
    const { svc } = await load(true)
    const { dir, last } = makeDir()
    vi.useFakeTimers({ toFake: ['Date'] })
    await svc.requestPasswordReset(dir, 'stu@x.test')
    const token = decodeURIComponent(new URL(last('password_reset')!.link!.replace('#/', '')).searchParams.get('token')!)
    expect((await attempt(svc.inspectToken(dir, token.slice(0, -2) + 'xx', 'password_reset')))?.code).toBe('invalid_link')
    vi.setSystemTime(Date.now() + 61 * 60_000)
    expect((await attempt(svc.inspectToken(dir, token, 'password_reset')))?.code).toBe('invalid_link')
  })
})

describe('invite-only accounts (production mode)', () => {
  it('sends an activation link on first sign-in, then accepts the chosen password', async () => {
    const { svc, storage } = await load(false)
    const { dir, last } = makeDir()
    const first = await signIn(svc, dir, 'anything')
    expect(first.status).toBe('invited')
    const token = decodeURIComponent(new URL(last('invite')!.link!.replace('#/', '')).searchParams.get('token')!)

    expect((await attempt(svc.activateAccount(dir, token, 'weak')))?.code).toBe('weak_password')
    await svc.activateAccount(dir, token, STRONG)

    const db = storage.loadAuthDb('t1')
    storage.saveAuthDb('t1', { ...db, policy: { ...db.policy, otp: 'off' } })
    expect((await signIn(svc, dir, STRONG)).status).toBe('ok')
  })
})

describe('email verification', () => {
  it('blocks sign-in until the address is verified', async () => {
    const { svc, storage } = await load(true)
    const { dir, last } = makeDir()
    await signIn(svc, dir, svc.DEMO_PASSWORD) // creates the account
    const db = storage.loadAuthDb('t1')
    db.accounts[0].emailVerified = false
    storage.saveAuthDb('t1', db)

    const res = await signIn(svc, dir, svc.DEMO_PASSWORD)
    expect(res.status).toBe('unverified')
    const token = decodeURIComponent(new URL(last('email_verify')!.link!.replace('#/', '')).searchParams.get('token')!)
    await svc.verifyEmail(dir, token)
    expect((await signIn(svc, dir, svc.DEMO_PASSWORD)).status).toBe('otp')
    expect((await attempt(svc.verifyEmail(dir, token)))?.code).toBe('invalid_link')
  })
})
