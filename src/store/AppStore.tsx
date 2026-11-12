import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Database, EmailLog, Role, Session } from '../types'
import { createSeed } from '../lib/seed'
import { applyTheme } from '../lib/theme'
import { getTenant, portalUrl, resolveTenant, upsertTenant, type ResolvedTenant, type TenantPlan } from '../lib/tenant'
import { sendEmail, type OutgoingEmail } from '../lib/email'
import { renderTemplate, uid } from '../lib/utils'

const SCHEMA_VERSION = 1
const dbKey = (t: string) => `cms:db:${t}`
const sessionKey = (t: string) => `cms:session:${t}`

export function readTenantDb(id: string): Database | null {
  try {
    const raw = localStorage.getItem(dbKey(id))
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.v === SCHEMA_VERSION && parsed.db) return parsed.db as Database
    }
  } catch {
    /* corrupt entry */
  }
  return null
}

function loadDb(tenant: ResolvedTenant): Database {
  const existing = readTenantDb(tenant.id)
  if (existing) return existing
  // Re-seed a provisioned college with its own identity (e.g. after "reset demo").
  const ref = getTenant(tenant.id)
  if (ref && tenant.id !== 'default') return seedFor(ref.name, ref.subdomain, ref.adminEmail)
  return createSeed()
}

function seedFor(name: string, slug: string, adminEmail?: string, primaryColor?: string) {
  const db = createSeed(name)
  db.domain.subdomain = slug
  db.branding.shortName = name.length <= 24 ? name : name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 8)
  db.branding.tagline = 'Welcome to our campus portal'
  if (primaryColor) db.branding.primaryColor = primaryColor
  if (adminEmail) db.branding.supportEmail = adminEmail
  return db
}

/** Used by the platform super admin to provision a new college. */
export function provisionTenant(opts: { name: string; slug: string; adminEmail: string; primaryColor: string; plan: TenantPlan }) {
  const id = `t-${opts.slug}-${Date.now().toString(36)}`
  const db = seedFor(opts.name, opts.slug, opts.adminEmail, opts.primaryColor)
  localStorage.setItem(dbKey(id), JSON.stringify({ v: SCHEMA_VERSION, db }))
  upsertTenant({ id, subdomain: opts.slug, customDomain: '', name: opts.name, status: 'active', plan: opts.plan, adminEmail: opts.adminEmail.toLowerCase(), createdAt: new Date().toISOString() })
  return id
}

export function deleteTenantData(id: string) {
  localStorage.removeItem(dbKey(id))
}

export interface Toast {
  id: string
  kind: 'success' | 'error' | 'info'
  text: string
}

export interface EmailJob {
  recipients: { email: string; vars: Record<string, string> }[]
  subject: string
  body: string
}

interface Store {
  db: Database
  tenant: ResolvedTenant
  session: Session | null
  update: (fn: (draft: Database) => void) => void
  login: (role: Role, userId: string) => void
  logout: () => void
  toast: (text: string, kind?: Toast['kind']) => void
  toasts: Toast[]
  dismissToast: (id: string) => void
  /** Personalises each email with its own vars, sends, and records the result in the outbox. */
  sendBulkEmail: (job: EmailJob) => Promise<{ sent: number; failed: number }>
  resetDemo: () => void
  storageError: string | null
  /** Platform super admin has suspended this college. */
  suspended: boolean
}

const Ctx = createContext<Store | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const tenant = useMemo(() => resolveTenant(), [])
  const suspended = useMemo(() => getTenant(tenant.id)?.status === 'suspended', [tenant.id])
  const [db, setDb] = useState<Database>(() => loadDb(tenant))
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = sessionStorage.getItem(sessionKey(tenant.id))
      return raw ? (JSON.parse(raw) as Session) : null
    } catch {
      return null
    }
  })
  const [toasts, setToasts] = useState<Toast[]>([])
  const [storageError, setStorageError] = useState<string | null>(null)
  const dbRef = useRef(db)
  dbRef.current = db

  // Persist + keep the tenant registry in sync for domain resolution.
  useEffect(() => {
    if (tenant.missing) return
    try {
      localStorage.setItem(dbKey(tenant.id), JSON.stringify({ v: SCHEMA_VERSION, db }))
      setStorageError(null)
    } catch {
      setStorageError('Browser storage is full or blocked – recent changes may not be saved. Try a smaller logo.')
    }
    upsertTenant({
      id: tenant.id,
      subdomain: db.domain.subdomain,
      customDomain: db.domain.domainStatus === 'verified' ? db.domain.customDomain : '',
      name: db.branding.collegeName,
    })
  }, [db, tenant.id, tenant.missing])

  useEffect(() => applyTheme(db.branding), [db.branding])

  const update = useCallback((fn: (draft: Database) => void) => {
    setDb((prev) => {
      const draft = structuredClone(prev)
      fn(draft)
      return draft
    })
  }, [])

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = uid('toast')
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])
  const dismissToast = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const login = useCallback(
    (role: Role, userId: string) => {
      const d = dbRef.current
      const name =
        role === 'admin'
          ? 'Administrator'
          : role === 'staff'
            ? (d.staff.find((s) => s.id === userId)?.name ?? 'Staff')
            : (d.students.find((s) => s.id === userId)?.name ?? 'Student')
      const s: Session = { role, userId, name }
      sessionStorage.setItem(sessionKey(tenant.id), JSON.stringify(s))
      setSession(s)
    },
    [tenant.id],
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem(sessionKey(tenant.id))
    setSession(null)
  }, [tenant.id])

  const sendBulkEmail = useCallback(
    async (job: EmailJob) => {
      const d = dbRef.current
      const base = {
        college_name: d.branding.collegeName,
        portal_url: portalUrl(d.domain.subdomain, d.domain.customDomain, d.domain.domainStatus === 'verified'),
        support_email: d.branding.supportEmail,
      }
      const logs: EmailLog[] = []
      let sent = 0
      let failed = 0
      // Send personalised messages; small batches keep the UI responsive.
      for (const r of job.recipients) {
        const vars = { ...base, ...r.vars }
        const msg: OutgoingEmail = {
          to: [r.email],
          subject: renderTemplate(job.subject, vars),
          body: renderTemplate(job.body, vars),
        }
        const res = await sendEmail(d.email, msg)
        res.ok ? sent++ : failed++
        logs.push({
          id: uid('mail'),
          ...msg,
          status: res.ok ? 'sent' : 'failed',
          error: res.error,
          sentAt: new Date().toISOString(),
          sentBy: session?.name ?? 'system',
          provider: d.email.provider,
        })
        // Abort early on a configuration error – every other message would fail the same way.
        if (!res.ok && sent === 0 && failed === 1 && job.recipients.length > 1 && res.error && !res.error.startsWith('Invalid recipient')) {
          failed = job.recipients.length
          break
        }
      }
      update((draft) => {
        draft.emailLog = [...logs.reverse(), ...draft.emailLog].slice(0, 500)
      })
      return { sent, failed }
    },
    [session, update],
  )

  const resetDemo = useCallback(() => {
    localStorage.removeItem(dbKey(tenant.id))
    setDb(loadDb(tenant))
  }, [tenant])

  const value = useMemo<Store>(
    () => ({ db, tenant, session, update, login, logout, toast, toasts, dismissToast, sendBulkEmail, resetDemo, storageError, suspended }),
    [db, tenant, session, update, login, logout, toast, toasts, dismissToast, sendBulkEmail, resetDemo, storageError, suspended],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used inside <AppStoreProvider>')
  return v
}
