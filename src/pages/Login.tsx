import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { prefetch } from '../routes'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, Users, GraduationCap, Mail, Phone, MapPin, Ban } from 'lucide-react'
import { getTenant } from '../lib/tenant'
import { useStore } from '../store/AppStore'
import { Button, Field, Logo } from '../components/ui'
import { ThemeToggle } from '../components/Layout'
import type { Role } from '../types'

const ROLES: { id: Role; label: string; icon: ReactNode }[] = [
  { id: 'admin', label: 'Admin', icon: <ShieldCheck size={16} /> },
  { id: 'staff', label: 'Staff', icon: <Users size={16} /> },
  { id: 'student', label: 'Student', icon: <GraduationCap size={16} /> },
]

export default function Login() {
  const { db, session, login, tenant, suspended } = useStore()
  const adminEmail = getTenant(tenant.id)?.adminEmail
  const nav = useNavigate()
  const [role, setRole] = useState<Role>('admin')
  const [identifier, setIdentifier] = useState(() => getTenant(tenant.id)?.adminEmail ?? 'admin@college.edu')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState<string | null>(null)
  const b = db.branding
  // Warm the selected role's dashboard chunk while the user types their credentials.
  useEffect(() => prefetch(`/${role}`), [role])

  const demoUsers = useMemo(
    () =>
      role === 'staff'
        ? db.staff.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${s.name} (${s.department})`, login: s.email }))
        : role === 'student'
          ? db.students.filter((s) => s.status === 'active').map((s) => ({ id: s.id, label: `${s.name} – ${s.rollNo}`, login: s.rollNo }))
          : [],
    [role, db.staff, db.students],
  )

  if (session && !suspended) return <Navigate to={`/${session.role}`} replace />

  const switchRole = (r: Role) => {
    setRole(r)
    setError(null)
    setIdentifier(r === 'admin' ? (adminEmail ?? 'admin@college.edu') : r === 'staff' ? (db.staff[0]?.email ?? '') : (db.students[0]?.rollNo ?? ''))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (suspended) return setError('This college portal is suspended. Please contact the platform administrator.')
    if (password.length < 4) return setError('Enter your password (any 4+ characters in this demo).')
    const id = identifier.trim().toLowerCase()
    if (role === 'admin') {
      if (!id) return setError('Enter the admin email.')
      if (adminEmail && id !== adminEmail) return setError('This email is not the administrator for this college.')
      login('admin', 'admin')
      return nav('/admin')
    }
    if (role === 'staff') {
      const s = db.staff.find((x) => x.email.toLowerCase() === id || x.empId.toLowerCase() === id)
      if (!s) return setError('No staff account found with that email or employee ID.')
      if (s.status !== 'active') return setError('This account is inactive. Contact the administrator.')
      login('staff', s.id)
      return nav('/staff')
    }
    const s = db.students.find((x) => x.rollNo.toLowerCase() === id || x.email.toLowerCase() === id)
    if (!s) return setError('No student found with that roll number or email.')
    if (s.status !== 'active') return setError('This account is inactive. Contact the administrator.')
    login('student', s.id)
    nav('/student')
  }

  return (
    <div className="login">
      <div className="login-hero" aria-hidden={false}>
        {/* Caesar slabs: Black 3 : Accent 2 : White 1 */}
        <div className="slab slab-black" />
        <div className="slab slab-accent"><span className="slab-word">{(b.shortName || b.collegeName).split(' ')[0]}</span></div>
        <div className="slab slab-white" />
        <div className="login-hero-inner">
          <div className="login-brand">
            <Logo size={48} />
            <div>
              <h2>{b.collegeName}</h2>
              <p>{b.tagline}</p>
            </div>
          </div>
          <h1>{b.loginHeadline}</h1>
          <ul className="login-points">
            <li>Online fee payment with instant receipts</li>
            <li>Period-wise attendance for every class</li>
            <li>Events, exams and a help desk in one calendar</li>
          </ul>
          <div className="login-contact">
            {b.supportEmail && (
              <span>
                <Mail size={14} /> {b.supportEmail}
              </span>
            )}
            {b.supportPhone && (
              <span>
                <Phone size={14} /> {b.supportPhone}
              </span>
            )}
            {b.address && (
              <span>
                <MapPin size={14} /> {b.address}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-top">
          <ThemeToggle />
        </div>
        <form className="login-card" onSubmit={submit} noValidate>
          <div className="login-card-logo">
            <Logo size={40} />
          </div>
          <h2>Sign in</h2>
          <p className="muted">Choose your role to continue</p>
          <div className="segmented" role="radiogroup" aria-label="Role">
            {ROLES.map((r) => (
              <button type="button" key={r.id} role="radio" aria-checked={role === r.id} className={role === r.id ? 'active' : ''} onClick={() => switchRole(r.id)}>
                {r.icon}
                {r.label}
              </button>
            ))}
          </div>

          <Field label={role === 'admin' ? 'Email' : role === 'staff' ? 'Email or employee ID' : 'Roll number or email'}>
            {(id) => <input id={id} className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />}
          </Field>
          <Field label="Password">
            {(id) => <input id={id} type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          </Field>

          {demoUsers.length > 0 && (
            <Field label="Demo account" hint="Pick any seeded user to sign in as them.">
              {(id) => (
                <select id={id} className="input" value={demoUsers.find((u) => u.login.toLowerCase() === identifier.toLowerCase())?.id ?? ''} onChange={(e) => setIdentifier(demoUsers.find((u) => u.id === e.target.value)?.login ?? '')}>
                  <option value="">— select —</option>
                  {demoUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {suspended && (
            <div className="alert alert-error" role="alert">
              <Ban size={16} /> This college portal is currently suspended.
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full">
            Sign in as {ROLES.find((r) => r.id === role)?.label}
          </Button>
          <p className="tiny muted center">
            Demo mode · any password works{tenant.via !== 'default' && <> · tenant <code>{tenant.slug}</code> via {tenant.via}</>}
          </p>
          <p className="tiny center">
            <Link to="/super/login" className="link">Platform super admin →</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
