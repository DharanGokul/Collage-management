import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Eye, EyeOff, Inbox, Mail, MapPin, Phone, X } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Field, Logo } from '../../components/ui'
import { ThemeToggle } from '../../components/Layout'
import { AUTH_DEMO } from '../../auth/service'
import { checkPassword, STRENGTH_LABEL } from '../../auth/policy'
import { clearMailbox } from '../../auth/storage'
import type { AuthMail } from '../../auth/types'

/** Split-screen frame shared by every college auth page: brand panel on the left, the form on the right. */
export function AuthShell({ children }: { children: ReactNode }) {
  const { db, tenant } = useStore()
  const b = db.branding
  return (
    <div className="login">
      <div className="login-hero">
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
            {b.supportEmail && <span><Mail size={14} /> {b.supportEmail}</span>}
            {b.supportPhone && <span><Phone size={14} /> {b.supportPhone}</span>}
            {b.address && <span><MapPin size={14} /> {b.address}</span>}
          </div>
        </div>
      </div>
      <main className="login-panel">
        <div className="login-top"><ThemeToggle /></div>
        <div className="login-card auth-card">
          <div className="login-card-logo"><Logo size={40} /></div>
          {children}
        </div>
      </main>
      {AUTH_DEMO && <DemoMailbox scope={tenant.id} />}
    </div>
  )
}

/** Round icon + heading used by the result screens (check your email, verified, expired link…). */
export function StatusHead({ icon, tone = 'accent', title, children }: { icon: ReactNode; tone?: 'accent' | 'ok' | 'warn' | 'danger'; title: string; children?: ReactNode }) {
  return (
    <div className="auth-status">
      <span className={`auth-icon tone-${tone}`} aria-hidden>{icon}</span>
      <h2 tabIndex={-1} data-autofocus>{title}</h2>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

/** Seconds left until `until` (ms epoch), ticking once a second. */
export function useCountdown(until: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [until])
  return Math.max(0, Math.ceil((until - now) / 1000))
}

/** Six single-digit boxes that behave like one field: paste, backspace, arrows and OS one-time-code autofill all work. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, length = 6 }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; invalid?: boolean; length?: number }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')
  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length)
    onChange(clean)
    if (clean.length === length) onComplete?.(clean)
  }
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault()
      set(value.slice(0, i - 1))
      focus(i - 1)
    } else if (e.key === 'ArrowLeft') focus(i - 1)
    else if (e.key === 'ArrowRight') focus(i + 1)
  }
  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault()
    set(e.clipboardData.getData('text'))
    focus(length - 1)
  }
  return (
    <div className={`otp ${invalid ? 'invalid' : ''}`} role="group" aria-label="One-time code" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className="otp-box"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${length}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => onKey(i, e)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (!v) return set(value.slice(0, i) + value.slice(i + 1))
            if (v.length > 1) return set(v) // browser autofill dropped the whole code in one box
            set(value.slice(0, i) + v + value.slice(i + 1))
            focus(i + 1)
          }}
        />
      ))}
    </div>
  )
}

/** Password input with a show/hide toggle and optional live strength meter and rule checklist. */
export function PasswordField({ label, value, onChange, autoComplete, meter, personal, error, hint }: { label: string; value: string; onChange: (v: string) => void; autoComplete: 'current-password' | 'new-password'; meter?: boolean; personal?: string[]; error?: string | null; hint?: ReactNode }) {
  const [show, setShow] = useState(false)
  const rulesId = useId()
  const check = meter ? checkPassword(value, personal) : null
  return (
    <div className="stack-s">
      <Field label={label} error={error} hint={hint}>
        {(id) => (
          <div className="input-wrap">
            <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} spellCheck={false} autoCapitalize="none" aria-describedby={meter && value ? rulesId : undefined} />
            <button type="button" className="input-toggle" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}
      </Field>
      {check && value.length > 0 && (
        <div className="pw-feedback" id={rulesId}>
          <div className="pw-meter" role="progressbar" aria-label="Password strength" aria-valuemin={0} aria-valuemax={4} aria-valuenow={check.score} aria-valuetext={STRENGTH_LABEL[check.score]}>
            {[1, 2, 3, 4].map((n) => <span key={n} className={n <= check.score ? `on s${check.score}` : ''} />)}
            <b>{STRENGTH_LABEL[check.score]}</b>
          </div>
          <ul className="pw-rules">
            {check.rules.map((r) => (
              <li key={r.id} className={r.ok ? 'ok' : ''}>{r.ok ? <Check size={12} aria-hidden /> : <X size={12} aria-hidden />} {r.label}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- demo inbox */

const subscribe = (cb: () => void) => {
  window.addEventListener('cms:mailbox', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('cms:mailbox', cb)
    window.removeEventListener('storage', cb)
  }
}

/**
 * Demo-only mailbox. There is no mail server in this build, so "sent" emails (codes, verification and reset links)
 * appear here. It is never rendered when VITE_AUTH_DEMO=false.
 */
export function DemoMailbox({ scope }: { scope: string }) {
  const nav = useNavigate()
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(`cms:mailbox:${scope}`) ?? '[]')
  const mails = useMemo<AuthMail[]>(() => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] } }, [raw])
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [seen, setSeen] = useState(0)
  const count = mails.length
  const unread = Math.max(0, count - seen)
  const toggle = useCallback(() => setOpen((o) => { if (!o) setSeen(count); return !o }), [count])
  useEffect(() => { if (open) setSeen(count) }, [open, count])
  useEffect(() => {
    if (!open) return
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard blocked: the code is still visible */ }
    setCopied(id)
    setTimeout(() => setCopied(null), 1400)
  }
  const follow = (m: AuthMail) => {
    if (!m.link) return
    const hash = new URL(m.link).hash.replace(/^#/, '')
    setOpen(false)
    nav(hash)
  }

  return (
    <>
      <button className="mailbox-fab" onClick={toggle} aria-expanded={open} aria-controls="demo-mailbox">
        <Inbox size={16} aria-hidden /> Demo inbox{unread > 0 && <span className="badge-dot" aria-label={`${unread} new`}>{unread}</span>}
      </button>
      {open && (
        <aside id="demo-mailbox" className="mailbox" aria-label="Demo inbox">
          <header>
            <div><strong>Demo inbox</strong><small>No mail server in this build. Emails the portal would send appear here.</small></div>
            <button className="icon-btn" aria-label="Close inbox" onClick={() => setOpen(false)}><X size={16} /></button>
          </header>
          {mails.length === 0 ? <p className="muted tiny pad">Nothing yet. Sign in or reset a password to see codes and links.</p> : (
            <ul>
              {[...mails].reverse().map((m) => (
                <li key={m.id}>
                  <div className="mail-meta"><strong>{m.subject}</strong><small className="muted">To {m.to} · {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></div>
                  {m.code && (
                    <div className="mail-code">
                      <code aria-label={`Code ${m.code.split('').join(' ')}`}>{m.code}</code>
                      <button className="btn btn-secondary btn-sm" onClick={() => copy(m.code!, m.id)}>{copied === m.id ? <Check size={14} /> : <Copy size={14} />}<span>{copied === m.id ? 'Copied' : 'Copy'}</span></button>
                    </div>
                  )}
                  {m.link && <button className="btn btn-secondary btn-sm" onClick={() => follow(m)}><span>Open link</span></button>}
                  {!m.code && !m.link && <p className="tiny muted">{m.body.split('\n').slice(2, 3).join(' ')}</p>}
                </li>
              ))}
            </ul>
          )}
          {mails.length > 0 && <footer><button className="link" onClick={() => clearMailbox(scope)}>Clear inbox</button></footer>}
        </aside>
      )}
    </>
  )
}
