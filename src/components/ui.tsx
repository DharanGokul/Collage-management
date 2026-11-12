import { useEffect, useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { initials } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; icon?: ReactNode; loading?: boolean }) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={loading || rest.disabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children && <span>{children}</span>}
    </button>
  )
}

export function Card({ title, actions, children, className = '', pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, hint, icon, tone = 'primary' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'primary' | 'green' | 'amber' | 'red' | 'blue' }) {
  return (
    <div className="stat card">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  )
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'primary'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Avatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  return src ? (
    <img src={src} alt="" className="avatar" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  )
}

export function Progress({ value, tone }: { value: number; tone?: 'green' | 'amber' | 'red' }) {
  const t = tone ?? (value >= 85 ? 'green' : value >= 75 ? 'amber' : 'red')
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar tone-bg-${t}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function Field({ label, hint, error, children, span }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; span?: 2 }) {
  const id = useId()
  return (
    <div className={`field ${span === 2 ? 'span-2' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <small className="field-error">{error}</small> : hint ? <small className="muted">{hint}</small> : null}
    </div>
  )
}

export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} className={`tab ${value === i.id ? 'active' : ''}`} onClick={() => onChange(i.id)}>
          {i.icon}
          {i.label}
        </button>
      ))}
    </div>
  )
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind === 'success' ? <CheckCircle2 size={18} /> : t.kind === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
          <span>{t.text}</span>
          <button className="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Logo({ size = 36 }: { size?: number }) {
  const { db } = useStore()
  const b = db.branding
  return b.logo ? (
    <img src={b.logo} alt={`${b.collegeName} logo`} className="brand-logo" style={{ height: size, maxWidth: size * 4 }} />
  ) : (
    <span className="brand-mark" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden>
      {(b.shortName || b.collegeName).trim()[0]?.toUpperCase() ?? 'C'}
    </span>
  )
}
