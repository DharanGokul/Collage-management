import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { prefetch } from '../routes'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, Users, GraduationCap, Ban, Calculator, MailCheck, UserCheck } from 'lucide-react'
import { getTenant } from '../lib/tenant'
import { useStore } from '../store/AppStore'
import { Button, Field, Segmented } from '../components/ui'
import { useAuth } from '../auth/useAuth'
import { AUTH_DEMO, DEMO_PASSWORD } from '../auth/service'
import { AuthError, type AuthSession } from '../auth/types'
import { formatSeconds } from '../auth/policy'
import { loadAuthDb } from '../auth/storage'
import { AuthShell, PasswordField, StatusHead } from './auth/parts'
import { OtpStep, type OtpChallengeInfo } from './auth/OtpStep'
import type { Role } from '../types'

const ROLES: { id: Role; label: string; icon: ReactNode }[] = [
  { id: 'admin', label: 'Admin', icon: <ShieldCheck size={16} /> },
  { id: 'staff', label: 'Staff', icon: <Users size={16} /> },
  { id: 'student', label: 'Student', icon: <GraduationCap size={16} /> },
  { id: 'accountant', label: 'Accounts', icon: <Calculator size={16} /> },
]

type Step = { kind: 'credentials' } | { kind: 'otp'; challenge: OtpChallengeInfo; remember: boolean } | { kind: 'notice'; reason: 'unverified' | 'invited'; email: string; identifier: string }

export default function Login() {
  const { db, session, startSession, tenant, suspended } = useStore()
  const auth = useAuth()
  const nav = useNavigate()
  const adminEmail = getTenant(tenant.id)?.adminEmail
  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [role, setRole] = useState<Role>('admin')
  const [identifier, setIdentifier] = useState(() => adminEmail ?? 'admin@college.edu')
  const [password, setPassword] = useState(AUTH_DEMO ? DEMO_PASSWORD : '')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Warm the selected role's dashboard chunk while the user types their credentials.
  useEffect(() => prefetch(`/${role}`), [role])

  const demoUsers = useMemo(
    () =>
      role === 'staff'
        ? db.staff.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${s.name} (${s.department}${db.departments.some((d) => d.hodId === s.id) ? ' · HOD' : ''})`, login: s.email }))
        : role === 'accountant'
          ? db.accountants.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${s.name} (${s.designation})`, login: s.email }))
          : role === 'student'
            ? db.students.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${s.name} – ${s.rollNo}`, login: s.rollNo }))
            : [],
    [role, db.staff, db.students, db.accountants, db.departments],
  )

  if (session && !suspended) return <Navigate to={`/${session.role}`} replace />

  const switchRole = (r: Role) => {
    setRole(r)
    setError(null)
    setIdentifier(r === 'admin' ? (adminEmail ?? 'admin@college.edu') : r === 'staff' ? (db.staff[0]?.email ?? '') : r === 'accountant' ? (db.accountants[0]?.email ?? '') : (db.students[0]?.rollNo ?? ''))
  }

  const finish = (s: AuthSession, keep: boolean) => {
    startSession(s, keep)
    nav(`/${s.role}`, { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    if (suspended) return setError('This college portal is suspended. Please contact the platform administrator.')
    if (!identifier.trim()) return setError('Enter your ID or email.')
    if (!password) return setError('Enter your password.')
    setBusy(true)
    try {
      const res = await auth.signIn({ role, identifier, password, remember })
      if (res.status === 'ok') return finish(res.session, res.remember)
      if (res.status === 'otp') return setStep({ kind: 'otp', challenge: res, remember })
      setStep({ kind: 'notice', reason: res.status, email: res.email, identifier })
    } catch (err) {
      if (err instanceof AuthError) {
        const wait = err.retryAfter ? ` Try again in ${formatSeconds(err.retryAfter)}.` : ''
        const left = err.attemptsLeft !== undefined && err.attemptsLeft <= 2 ? ` ${err.attemptsLeft} ${err.attemptsLeft === 1 ? 'attempt' : 'attempts'} left before a temporary lock.` : ''
        setError(err.message + wait + left)
      } else setError('Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (step.kind === 'otp') {
    const { challenge } = step
    return (
      <AuthShell>
        <OtpStep
          challenge={challenge}
          trustDays={loadAuthDb(tenant.id).policy.trustDeviceDays}
          onVerify={async (code, trust) => {
            const res = await auth.verifyOtp({ challengeId: challenge.challengeId, code, trustDevice: trust })
            finish(res.session, res.remember)
          }}
          onResend={() => auth.resendOtp(challenge.challengeId)}
          onBack={() => { setStep({ kind: 'credentials' }); setPassword(AUTH_DEMO ? DEMO_PASSWORD : '') }}
        />
      </AuthShell>
    )
  }

  if (step.kind === 'notice') {
    const invited = step.reason === 'invited'
    return (
      <AuthShell>
        <div className="stack">
          <StatusHead icon={invited ? <UserCheck size={24} /> : <MailCheck size={24} />} title={invited ? 'Activate your account' : 'Verify your email'}>
            {invited ? <>Your account is ready to set up. We sent an activation link to <strong>{step.email}</strong>.</> : <>Confirm <strong>{step.email}</strong> to finish signing in. We just sent you a verification link.</>}
          </StatusHead>
          <div className="alert alert-info">The link works for {invited ? '72 hours' : '24 hours'}. Check your spam folder if it does not arrive.</div>
          <Button variant="secondary" onClick={() => auth.resendVerification(step.email).then(() => setStep({ ...step }))}>Resend email</Button>
          <p className="tiny center"><button type="button" className="link" onClick={() => setStep({ kind: 'credentials' })}>← Back to sign in</button></p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form className="stack" onSubmit={submit} noValidate>
        <div>
          <h2>Sign in</h2>
          <p className="muted">Choose your role to continue</p>
        </div>
        <Segmented label="Role" value={role} onChange={switchRole} options={ROLES.map((r) => ({ id: r.id, label: r.label, icon: r.icon }))} />

        <Field label={role === 'admin' ? 'Email' : role === 'staff' || role === 'accountant' ? 'Email or employee ID' : 'Roll number or email'}>
          {(id) => <input id={id} className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />}
        </Field>
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <div className="row between">
          <label className="check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
          <Link to="/forgot-password" className="link tiny">Forgot password?</Link>
        </div>

        {AUTH_DEMO && demoUsers.length > 0 && (
          <Field label="Demo account" hint="Pick any seeded user to sign in as them.">
            {(id) => (
              <select id={id} className="input" value={demoUsers.find((u) => u.login.toLowerCase() === identifier.toLowerCase())?.id ?? ''} onChange={(e) => setIdentifier(demoUsers.find((u) => u.id === e.target.value)?.login ?? '')}>
                <option value="">— select —</option>
                {demoUsers.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
              </select>
            )}
          </Field>
        )}

        {suspended && <div className="alert alert-error" role="alert"><Ban size={16} /> This college portal is currently suspended.</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Button type="submit" className="w-full" loading={busy}>Sign in as {ROLES.find((r) => r.id === role)?.label}</Button>
        <p className="tiny muted center">
          {AUTH_DEMO ? <>Demo mode · password <code>{DEMO_PASSWORD}</code> · codes appear in the Demo inbox</> : <>Protected sign-in with email verification</>}
          {tenant.via !== 'default' && <> · tenant <code>{tenant.slug}</code></>}
        </p>
        <p className="tiny center"><Link to="/super/login" className="link">Platform super admin →</Link></p>
      </form>
    </AuthShell>
  )
}
