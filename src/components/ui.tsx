import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { pillRect, useLiquidBlob, useLiquidHover } from './LiquidNav'
import { X, CheckCircle2, AlertCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { initials } from '../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ink'

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

/** Counts open modals/sheets; while any are open the toaster moves to the top so it never covers their buttons. */
let overlays = 0
export function overlayOpen(delta: 1 | -1) {
  overlays = Math.max(0, overlays + delta)
  document.body.classList.toggle('overlay-open', overlays > 0)
}

/**
 * Accessible dialog on Radix: focus is trapped and restored, Escape and outside click close it, the page behind
 * is inert and scroll-locked, and the title is announced. Styling stays with the Caesar `.modal*` classes.
 */
export function Modal({ open, title, onClose, children, footer, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    overlayOpen(1)
    return () => overlayOpen(-1)
  }, [open])
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-backdrop">
          <Dialog.Content
            className={`modal ${wide ? 'modal-wide' : ''}`}
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => {
              // Mouse/keyboard: start in the first field. Touch: focus the dialog itself so no soft keyboard pops up.
              e.preventDefault()
              const box = e.currentTarget as HTMLElement
              const first = window.matchMedia('(pointer: fine)').matches ? box.querySelector<HTMLElement>('.modal-body input, .modal-body select, .modal-body textarea') : null
              ;(first ?? box).focus()
            }}
          >
            <header className="modal-head">
              <Dialog.Title asChild><h3>{title}</h3></Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-btn" aria-label="Close"><X size={18} /></button>
              </Dialog.Close>
            </header>
            <div className="modal-body">{children}</div>
            {footer && <footer className="modal-foot">{footer}</footer>}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
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

/** Tabs with a liquid underline that glides between tabs and follows hover. */
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: string; icon?: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const ink = useRef<HTMLSpanElement>(null)
  const active = items.findIndex((i) => i.id === value)
  const { lit, item, group } = useLiquidHover(active)
  useLiquidBlob(ref, ink, lit, pillRect)
  return (
    <div className="tabs" role="tablist" ref={ref} {...group}>
      <span className="tab-ink" ref={ink} aria-hidden />
      {items.map((it, i) => (
        <button key={it.id} data-liquid role="tab" aria-selected={value === it.id} className={`tab ${value === it.id ? 'active' : ''} ${i === lit ? 'lit' : ''}`} onClick={() => onChange(it.id)} {...item(i)}>
          {it.icon}
          {it.label}
        </button>
      ))}
    </div>
  )
}

/** Single-choice pill switch with a liquid fill that follows hover. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  kind = 'radio',
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: ReactNode; icon?: ReactNode; aria?: string }[]
  label: string
  kind?: 'radio' | 'tab'
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  const active = options.findIndex((o) => o.id === value)
  const { lit, item, group } = useLiquidHover(active)
  useLiquidBlob(ref, blob, lit, pillRect)
  return (
    <div ref={ref} className={`segmented liquid-seg ${className}`} role={kind === 'radio' ? 'radiogroup' : 'tablist'} aria-label={label} {...group}>
      <span className="seg-blob" ref={blob} aria-hidden />
      {options.map((o, i) => (
        <button
          key={o.id}
          type="button"
          data-liquid
          role={kind}
          aria-checked={kind === 'radio' ? value === o.id : undefined}
          aria-selected={kind === 'tab' ? value === o.id : undefined}
          aria-label={o.aria}
          className={`${value === o.id ? 'active' : ''} ${i === lit ? 'lit' : ''}`}
          onClick={() => onChange(o.id)}
          {...item(i)}
        >
          {o.icon}
          {o.label}
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

/** Client-side pagination; resets to page 1 whenever the filtered list changes. */
export function usePaged<T>(rows: T[], size = 25) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  // Back to page 1 when the result set changes size (filter/search) - not when a row is merely edited.
  const [prevLen, setPrevLen] = useState(rows.length)
  if (prevLen !== rows.length) {
    setPrevLen(rows.length)
    setPage(0)
  }
  const p = Math.min(page, pages - 1)
  return { items: rows.slice(p * size, p * size + size), page: p, pages, setPage, total: rows.length, size }
}

export function Pager({ page, pages, setPage, total, size }: { page: number; pages: number; setPage: (n: number) => void; total: number; size: number }) {
  if (total <= size) return null
  return (
    <div className="pager">
      <span className="muted tiny">
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </span>
      <button className="icon-btn" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}>
        <ChevronLeft size={18} />
      </button>
      <span className="tiny">
        {page + 1} / {pages}
      </span>
      <button className="icon-btn" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
