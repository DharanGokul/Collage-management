import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Plus, ExternalLink, Ban, PlayCircle, Trash2, LogOut, Search, GraduationCap, Users, ShieldCheck, Globe, Wallet, Copy } from 'lucide-react'
import { Badge, Button, Card, Empty, Field, Modal, Stat, Toasts } from '../../components/ui'
import { ThemeToggle } from '../../components/Layout'
import { useStore, provisionTenant, readTenantDb, deleteTenantData } from '../../store/AppStore'
import { PLATFORM_DOMAIN, SLUG_RE, listTenants, patchTenant, portalUrl, previewUrl, removeTenant, slugify, type TenantPlan, type TenantRef } from '../../lib/tenant'
import { PRESET_COLORS } from '../../lib/theme'
import { formatDate, formatMoney, isValidEmail } from '../../lib/utils'

/**
 * Platform ("our end") super admin. Not tied to any college: it provisions
 * colleges (tenants), each of which gets its own URL derived from the college
 * name, its own admin login, branding and data.
 */

const SUPER_KEY = 'cms:super'
export const SUPER_ADMIN_EMAIL: string = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'super@campusone.app'
const PLANS: Record<TenantPlan, { label: string; students: number; price: number }> = {
  starter: { label: 'Starter', students: 500, price: 4999 },
  growth: { label: 'Growth', students: 3000, price: 14999 },
  enterprise: { label: 'Enterprise', students: Infinity, price: 39999 },
}

const isSuper = () => {
  try {
    return sessionStorage.getItem(SUPER_KEY) === '1'
  } catch {
    return false
  }
}

export function SuperLogin() {
  const nav = useNavigate()
  const [email, setEmail] = useState(SUPER_ADMIN_EMAIL)
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState<string | null>(null)
  if (isSuper()) return <Navigate to="/super" replace />
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) return setError('Not a platform administrator account.')
    if (password.length < 4) return setError('Enter your password (any 4+ characters in this demo).')
    sessionStorage.setItem(SUPER_KEY, '1')
    nav('/super')
  }
  return (
    <div className="super-login">
      <div className="login-top"><ThemeToggle /></div>
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-card-logo"><span className="brand-mark super-mark" style={{ width: 44, height: 44 }}><ShieldCheck size={22} /></span></div>
        <h2>Platform console</h2>
        <p className="muted">Super admin access for {PLATFORM_DOMAIN}</p>
        <Field label="Email">{(id) => <input id={id} className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />}</Field>
        <Field label="Password">{(id) => <input id={id} type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}</Field>
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Button type="submit" className="w-full">Sign in</Button>
        <p className="tiny center"><Link to="/login" className="link">← Back to college login</Link></p>
      </form>
    </div>
  )
}

interface Row {
  t: TenantRef
  students: number
  staff: number
  collected: number
  color: string
  logo: string | null
}

export function SuperConsole() {
  const nav = useNavigate()
  const { toast } = useStore()
  const [version, setVersion] = useState(0)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<TenantRef | null>(null)

  const rows: Row[] = useMemo(() => {
    void version
    return listTenants()
      .map((t) => {
        const db = readTenantDb(t.id)
        return {
          t,
          students: db?.students.length ?? 0,
          staff: db?.staff.length ?? 0,
          collected: db?.payments.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount + p.lateFee, 0) ?? 0,
          color: db?.branding.primaryColor ?? '#6d001a',
          logo: db?.branding.logo ?? null,
        }
      })
      .sort((a, b) => (b.t.createdAt ?? '').localeCompare(a.t.createdAt ?? ''))
  }, [version])

  if (!isSuper()) return <Navigate to="/super/login" replace />

  const filtered = rows.filter((r) => !q || r.t.name.toLowerCase().includes(q.toLowerCase()) || r.t.subdomain.includes(q.toLowerCase()))
  const active = rows.filter((r) => r.t.status !== 'suspended').length
  const mrr = rows.filter((r) => r.t.status !== 'suspended').reduce((a, r) => a + PLANS[r.t.plan ?? 'starter'].price, 0)
  const refresh = () => setVersion((v) => v + 1)

  const toggle = (t: TenantRef) => {
    const next = t.status === 'suspended' ? 'active' : 'suspended'
    if (next === 'suspended' && !confirm(`Suspend ${t.name}? Its admins, staff and students will be unable to sign in.`)) return
    patchTenant(t.id, { status: next })
    toast(`${t.name} ${next === 'active' ? 're-activated' : 'suspended'}`)
    refresh()
  }

  return (
    <div className="super">
      <header className="super-top">
        <div className="row gap-s">
          <span className="brand-mark super-mark" style={{ width: 34, height: 34 }}><ShieldCheck size={18} /></span>
          <div className="brand-text"><strong>Platform console</strong><small>{PLATFORM_DOMAIN}</small></div>
        </div>
        <span className="spacer" />
        <ThemeToggle />
        <Button variant="ghost" className="collapse-sm" aria-label="Sign out" icon={<LogOut size={16} />} onClick={() => { sessionStorage.removeItem(SUPER_KEY); nav('/super/login') }}>Sign out</Button>
      </header>
      <main className="content">
        <div className="page-header">
          <div><h1>Colleges</h1><p className="muted">Every college gets its own white-labelled portal, URL, admin, branding and data.</p></div>
          <div className="page-actions"><Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Onboard college</Button></div>
        </div>
        <div className="grid stats-grid">
          <Stat label="Colleges" value={rows.length} icon={<Building2 size={20} />} hint={`${active} active`} />
          <Stat label="Students on platform" value={rows.reduce((a, r) => a + r.students, 0)} icon={<GraduationCap size={20} />} tone="green" />
          <Stat label="Staff on platform" value={rows.reduce((a, r) => a + r.staff, 0)} icon={<Users size={20} />} tone="blue" />
          <Stat label="Monthly recurring" value={formatMoney(mrr, 'INR')} icon={<Wallet size={20} />} tone="amber" hint="from active plans" />
        </div>
        <Card pad={false}>
          <div className="toolbar">
            <div className="search"><Search size={16} /><input className="input" placeholder="Search colleges…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search colleges" /></div>
          </div>
          {filtered.length === 0 ? (
            <Empty icon={<Building2 />} title="No colleges yet">Onboard your first college to create its portal.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>College</th><th>Portal URL</th><th>Admin</th><th>Plan</th><th>Students</th><th>Fees collected</th><th>Status</th><th className="right">Actions</th></tr></thead>
                <tbody>
                  {filtered.map(({ t, students, staff, collected, color, logo }) => {
                    const url = portalUrl(t.subdomain, t.customDomain, !!t.domainVerified)
                    const plan = PLANS[t.plan ?? 'starter']
                    const over = students > plan.students
                    return (
                      <tr key={t.id}>
                        <td>
                          <div className="person">
                            {logo ? <img src={logo} alt="" className="tenant-logo" /> : <span className="brand-mark" style={{ width: 32, height: 32, background: color }}>{t.name[0]}</span>}
                            <div><strong>{t.name}</strong><div className="muted tiny">Since {t.createdAt ? formatDate(t.createdAt) : '—'} · {staff} staff</div></div>
                          </div>
                        </td>
                        <td>
                          <div className="row gap-s"><Globe size={14} className="muted" /><span className="mono tiny">{url.replace('https://', '')}</span><button className="icon-btn sm" aria-label="Copy URL" onClick={() => navigator.clipboard?.writeText(url).then(() => toast('URL copied'))}><Copy size={12} /></button></div>
                          {t.customDomain && (t.domainVerified ? <Badge tone="green">custom domain</Badge> : <Badge tone="amber">domain pending</Badge>)}
                        </td>
                        <td className="tiny">{t.adminEmail ?? <span className="muted">any (demo)</span>}</td>
                        <td>
                          <select className="input sm" value={t.plan ?? 'starter'} aria-label={`Plan for ${t.name}`} onChange={(e) => { patchTenant(t.id, { plan: e.target.value as TenantPlan }); toast('Plan updated'); refresh() }}>
                            {(Object.keys(PLANS) as TenantPlan[]).map((p) => <option key={p} value={p}>{PLANS[p].label}</option>)}
                          </select>
                        </td>
                        <td>{students}{over && <div className="text-red tiny">over {plan.students} limit</div>}</td>
                        <td>{formatMoney(collected, 'INR')}</td>
                        <td>{t.status === 'suspended' ? <Badge tone="red">suspended</Badge> : <Badge tone="green">active</Badge>}</td>
                        <td className="right nowrap">
                          <a className="icon-btn" href={previewUrl(t.id === 'default' ? '' : t.subdomain)} target="_blank" rel="noreferrer" aria-label={`Open ${t.name} portal`} title="Open portal"><ExternalLink size={16} /></a>
                          <button className="icon-btn" aria-label={t.status === 'suspended' ? 'Activate' : 'Suspend'} title={t.status === 'suspended' ? 'Activate' : 'Suspend'} onClick={() => toggle(t)}>{t.status === 'suspended' ? <PlayCircle size={16} /> : <Ban size={16} />}</button>
                          {t.id !== 'default' && <button className="icon-btn danger" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => setDeleting(t)}><Trash2 size={16} /></button>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
      {creating && <OnboardModal existing={rows.map((r) => r.t)} onClose={() => setCreating(false)} onCreated={(name) => { setCreating(false); toast(`${name} is live`); refresh() }} />}
      {deleting && <DeleteModal t={deleting} onClose={() => setDeleting(null)} onDeleted={() => { toast(`${deleting.name} deleted`); setDeleting(null); refresh() }} />}
      <Toasts />
    </div>
  )
}

function OnboardModal({ existing, onClose, onCreated }: { existing: TenantRef[]; onClose: () => void; onCreated: (name: string) => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[1])
  const [plan, setPlan] = useState<TenantPlan>('starter')
  const [touched, setTouched] = useState(false)
  const effectiveSlug = slugEdited ? slug : slugify(name)
  const errors = {
    name: name.trim().length < 3 ? 'Enter the college name' : null,
    slug: !SLUG_RE.test(effectiveSlug) ? '3–32 lowercase letters, numbers or hyphens' : existing.some((t) => t.subdomain === effectiveSlug) ? 'This URL is already taken' : null,
    email: !isValidEmail(adminEmail) ? 'Enter a valid email for the college administrator' : null,
  }
  const hasErr = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null)
  return (
    <Modal
      open
      wide
      title="Onboard a new college"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (hasErr) return
              try {
                provisionTenant({ name: name.trim(), slug: effectiveSlug, adminEmail: adminEmail.trim(), primaryColor: color, plan })
                onCreated(name.trim())
              } catch {
                alert('Browser storage is full – delete a college or clear site data and try again.')
              }
            }}
          >
            Create portal
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="College name" span={2} error={err('name')}>{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="St. Joseph's College of Engineering" autoFocus />}</Field>
        <Field label="Portal URL" span={2} hint="Generated from the college name – you can edit it" error={err('slug')}>
          {(id) => (
            <div className="input-group">
              <span className="addon">https://</span>
              <input id={id} className="input mono" value={effectiveSlug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }} maxLength={32} />
              <span className="addon">.{PLATFORM_DOMAIN}</span>
            </div>
          )}
        </Field>
        <Field label="College admin email" error={err('email')} hint="Their login for the college Admin portal">{(id) => <input id={id} className="input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="principal@college.edu" />}</Field>
        <Field label="Plan">{(id) => <select id={id} className="input" value={plan} onChange={(e) => setPlan(e.target.value as TenantPlan)}>{(Object.keys(PLANS) as TenantPlan[]).map((p) => <option key={p} value={p}>{PLANS[p].label} – {Number.isFinite(PLANS[p].students) ? `${PLANS[p].students} students` : 'unlimited'} · {formatMoney(PLANS[p].price, 'INR')}/mo</option>)}</select>}</Field>
        <div className="field span-2">
          <label>Starting brand colour</label>
          <div className="swatches">{PRESET_COLORS.map((c) => <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Use ${c}`} onClick={() => setColor(c)} />)}</div>
          <small className="muted">The college admin can change colours, logo, favicon, domain and email settings later.</small>
        </div>
      </div>
    </Modal>
  )
}

function DeleteModal({ t, onClose, onDeleted }: { t: TenantRef; onClose: () => void; onDeleted: () => void }) {
  const [confirmText, setConfirmText] = useState('')
  return (
    <Modal
      open
      title={`Delete ${t.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={confirmText !== t.subdomain} onClick={() => { deleteTenantData(t.id); removeTenant(t.id); onDeleted() }}>Delete permanently</Button>
        </>
      }
    >
      <p>This removes the college portal and <strong>all</strong> of its students, staff, attendance and payment records. This cannot be undone.</p>
      <Field label={`Type ${t.subdomain} to confirm`}>{(id) => <input id={id} className="input mono" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />}</Field>
    </Modal>
  )
}
