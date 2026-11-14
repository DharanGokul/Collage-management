import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sun, Moon, SunMoon, Palette, Globe, Mail, Database as DbIcon, Upload, Trash2, Copy, CheckCircle2, XCircle, Loader2, ExternalLink, Send, Download, RotateCcw, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Field, Logo, PageHeader, Tabs } from '../../components/ui'
import { PRESET_COLORS, HEX_RE, applyPalette, contrastRatio, contrastText, readImage, generatedFavicon } from '../../lib/theme'
import { HARMONIES, deriveSecondary, resolveSecondary } from '../../lib/color'
import ColorPicker from '../../components/ColorPicker'
import { DNS_VERIFY_MODE, DOMAIN_RE, PLATFORM_DOMAIN, SLUG_RE, checkAvailability, dnsRecordsFor, isApexDomain, portalUrl, previewUrl, verifyDomain, type DnsRecord, type DomainCheck } from '../../lib/tenant'
import { PROVIDERS, sendEmail, validateEmailSettings } from '../../lib/email'
import { formatDate, formatMoney, isValidEmail } from '../../lib/utils'
import type { Branding, DomainSettings, EmailSettings } from '../../types'
import { useThemeMode } from '../../components/ThemeSwitch'
import { DAY_START, NIGHT_START, followCollegeDefault } from '../../lib/themeMode'

type Tab = 'branding' | 'domain' | 'email' | 'approvals' | 'data'

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (['branding', 'domain', 'email', 'approvals', 'data'].includes(params.get('tab') ?? '') ? params.get('tab') : 'branding') as Tab
  return (
    <>
      <PageHeader title="Settings & Branding" subtitle="White-label the portal for your college" />
      <Tabs
        value={tab}
        onChange={(t) => setParams({ tab: t }, { replace: true })}
        items={[
          { id: 'branding', label: 'Branding', icon: <Palette size={16} /> },
          { id: 'domain', label: 'Domain & URL', icon: <Globe size={16} /> },
          { id: 'email', label: 'Email sending', icon: <Mail size={16} /> },
          { id: 'approvals', label: 'Approval limit', icon: <ShieldCheck size={16} /> },
          { id: 'data', label: 'Data', icon: <DbIcon size={16} /> },
        ]}
      />
      {tab === 'branding' && <BrandingTab />}
      {tab === 'domain' && <DomainTab />}
      {tab === 'email' && <EmailTab />}
      {tab === 'approvals' && <ApprovalLimitTab />}
      {tab === 'data' && <DataTab />}
    </>
  )
}

/* ---------------- Branding ---------------- */

function ImageUpload({ label, hint, value, onChange, max, preview }: { label: string; hint: string; value: string | null; onChange: (v: string | null) => void; max: number; preview: 'logo' | 'favicon' }) {
  const ref = useRef<HTMLInputElement>(null)
  const { toast } = useStore()
  const [drag, setDrag] = useState(false)
  const handle = async (file?: File) => {
    if (!file) return
    try {
      onChange(await readImage(file, max))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    }
  }
  return (
    <div className="field">
      <label>{label}</label>
      <div
        className={`upload ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      >
        <div className={`upload-preview ${preview}`}>{value ? <img src={value} alt={`${label} preview`} /> : <span className="muted tiny">None</span>}</div>
        <div className="upload-actions">
          <Button size="sm" variant="secondary" icon={<Upload size={14} />} onClick={() => ref.current?.click()}>{value ? 'Replace' : 'Upload'}</Button>
          {value && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onChange(null)}>Remove</Button>}
          <small className="muted">{hint}</small>
        </div>
        <input ref={ref} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/gif" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}

function BrandingTab() {
  const { db, update, toast } = useStore()
  const [b, setB] = useState<Branding>(db.branding)
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setB((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(b) !== JSON.stringify(db.branding)
  const secondary = resolveSecondary(HEX_RE.test(b.primaryColor) ? b.primaryColor : '#6d001a', b.secondaryHarmony, b.secondaryColor)
  const ratio = HEX_RE.test(b.primaryColor) ? contrastRatio(b.primaryColor, contrastText(b.primaryColor)) : 0
  const valid = b.collegeName.trim().length > 1 && HEX_RE.test(b.primaryColor) && (!b.supportEmail || isValidEmail(b.supportEmail))

  // Live preview: theme follows unsaved changes; reverts if the user leaves without saving.
  useEffect(() => {
    if (HEX_RE.test(b.primaryColor)) applyPalette(b.primaryColor, secondary)
  }, [b.primaryColor, secondary])
  const saved = db.branding
  useEffect(() => () => { applyPalette(saved.primaryColor, resolveSecondary(saved.primaryColor, saved.secondaryHarmony, saved.secondaryColor)) }, [saved.primaryColor, saved.secondaryHarmony, saved.secondaryColor])

  const save = () => {
    update((d) => { d.branding = { ...b, collegeName: b.collegeName.trim(), shortName: b.shortName.trim() } })
    toast('Branding saved')
  }

  return (
    <div className="grid side-r">
      <div className="stack-l">
        <Card title="Identity">
          <div className="form-grid">
            <Field label="College name" error={b.collegeName.trim().length < 2 ? 'Required' : null}>{(id) => <input id={id} className="input" value={b.collegeName} onChange={(e) => set('collegeName', e.target.value)} />}</Field>
            <Field label="Short name" hint="Shown in the sidebar">{(id) => <input id={id} className="input" value={b.shortName} onChange={(e) => set('shortName', e.target.value)} maxLength={24} />}</Field>
            <Field label="Tagline" span={2}>{(id) => <input id={id} className="input" value={b.tagline} onChange={(e) => set('tagline', e.target.value)} />}</Field>
            <Field label="Login page headline" span={2}>{(id) => <input id={id} className="input" value={b.loginHeadline} onChange={(e) => set('loginHeadline', e.target.value)} />}</Field>
          </div>
        </Card>
        <Card title="Logo & favicon">
          <div className="form-grid">
            <ImageUpload label="Logo" hint="PNG/SVG, transparent background, ≤ 2 MB" value={b.logo} onChange={(v) => set('logo', v)} max={320} preview="logo" />
            <ImageUpload label="Favicon" hint="Square, at least 64×64 px" value={b.favicon} onChange={(v) => set('favicon', v)} max={128} preview="favicon" />
          </div>
        </Card>
        <Card title="Default theme">
          <DefaultTheme value={b.defaultTheme ?? 'auto'} onChange={(v) => set('defaultTheme', v)} />
        </Card>
        <Card title="Brand colours">
          <div className="brand-colours">
            <div className="stack-s">
              <span className="spec">Primary</span>
              <ColorPicker label="Primary colour" value={HEX_RE.test(b.primaryColor) ? b.primaryColor : '#6d001a'} onChange={(c) => set('primaryColor', c)} presets={PRESET_COLORS} />
              <p className="tiny muted">
                Text on primary: <strong>{ratio.toFixed(1)}:1</strong> {ratio >= 4.5 ? <Badge tone="green">AA</Badge> : ratio >= 3 ? <Badge tone="amber">AA large</Badge> : <Badge tone="red">Low</Badge>}
              </p>
            </div>
            <div className="stack-s">
              <span className="spec">Secondary · based on primary</span>
              <div className="harmony-grid" role="radiogroup" aria-label="Secondary colour">
                {HARMONIES.map((h) => {
                  const c = deriveSecondary(HEX_RE.test(b.primaryColor) ? b.primaryColor : '#6d001a', h.id)
                  const on = (b.secondaryHarmony ?? 'analogous') === h.id
                  return (
                    <button key={h.id} type="button" role="radio" aria-checked={on} className={`harmony ${on ? 'on' : ''}`} onClick={() => set('secondaryHarmony', h.id)} title={h.hint}>
                      <span className="harmony-sw"><i style={{ background: b.primaryColor }} /><i style={{ background: c }} /></span>
                      <span>{h.label}</span>
                    </button>
                  )
                })}
                <button type="button" role="radio" aria-checked={b.secondaryHarmony === 'custom'} className={`harmony ${b.secondaryHarmony === 'custom' ? 'on' : ''}`} onClick={() => setB((p) => ({ ...p, secondaryHarmony: 'custom', secondaryColor: p.secondaryColor ?? secondary }))}>
                  <span className="harmony-sw"><i style={{ background: b.primaryColor }} /><i style={{ background: b.secondaryColor ?? secondary }} /></span>
                  <span>Custom</span>
                </button>
              </div>
              {b.secondaryHarmony === 'custom' ? (
                <ColorPicker label="Secondary colour" value={b.secondaryColor ?? secondary} onChange={(c) => set('secondaryColor', c)} />
              ) : (
                <p className="tiny muted">{HARMONIES.find((h) => h.id === (b.secondaryHarmony ?? 'analogous'))?.hint}. Updates automatically when the primary changes.</p>
              )}
              <div className="palette-strip" aria-label="Resulting palette">
                {[
                  { c: b.primaryColor, l: 'Primary' },
                  { c: 'var(--accent-pressed)', l: 'Pressed' },
                  { c: secondary, l: 'Secondary' },
                  { c: 'var(--tint-1)', l: 'Day wash' },
                  { c: 'var(--tint-2)', l: 'Day wash' },
                ].map((x, i) => <span key={i} style={{ background: x.c }} title={x.l} />)}
              </div>
              <p className="tiny muted">Secondary is used for chips, progress bars, chart highlights, avatars, the Up next panel and the Day-mode background. Text on secondary: <strong>{contrastRatio(secondary, contrastText(secondary)).toFixed(1)}:1</strong></p>
            </div>
          </div>
        </Card>
        <Card title="Contact & locale">
          <div className="form-grid">
            <Field label="Support email" error={b.supportEmail && !isValidEmail(b.supportEmail) ? 'Invalid email' : null}>{(id) => <input id={id} className="input" value={b.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />}</Field>
            <Field label="Support phone">{(id) => <input id={id} className="input" value={b.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} />}</Field>
            <Field label="Address" span={2}>{(id) => <input id={id} className="input" value={b.address} onChange={(e) => set('address', e.target.value)} />}</Field>
            <Field label="Currency">{(id) => <select id={id} className="input" value={b.currency} onChange={(e) => set('currency', e.target.value)}>{['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'NGN', 'KES', 'LKR'].map((c) => <option key={c}>{c}</option>)}</select>}</Field>
          </div>
        </Card>
      </div>
      <div className="sticky">
        <Card title="Live preview">
          <div className="brand-preview" style={{ ['--accent' as string]: b.primaryColor, ['--on-accent' as string]: HEX_RE.test(b.primaryColor) ? contrastText(b.primaryColor) : '#fff' }}>
            <div className="bp-browser">
              <img src={b.favicon ?? generatedFavicon(b.shortName || b.collegeName, HEX_RE.test(b.primaryColor) ? b.primaryColor : '#6d001a')} alt="" />
              <span>{b.collegeName || 'College'} · Portal</span>
            </div>
            <div className="bp-body">
              <div className="bp-side">
                {b.logo ? <img src={b.logo} alt="" className="bp-logo" /> : <span className="brand-mark" style={{ width: 28, height: 28 }}>{(b.shortName || b.collegeName || 'C')[0]}</span>}
                <span className="bp-nav on" /><span className="bp-nav" /><span className="bp-nav" />
              </div>
              <div className="bp-main">
                <strong>{b.shortName || b.collegeName}</strong>
                <small className="muted">{b.tagline}</small>
                <button className="btn btn-primary btn-sm" tabIndex={-1}>Pay fees</button>
              </div>
            </div>
          </div>
          <div className="row gap-s mt">
            <Button className="w-full" disabled={!dirty || !valid} onClick={save}>Save branding</Button>
            <Button variant="secondary" disabled={!dirty} onClick={() => setB(db.branding)}>Reset</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

const hour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })
const THEME_OPTIONS = [
  { id: 'day', label: 'Day', sub: 'Marble · light', Icon: Sun },
  { id: 'night', label: 'Night', sub: 'Noir · dark', Icon: Moon },
  { id: 'auto', label: 'Auto', sub: `Day ${hour(DAY_START)}–${hour(NIGHT_START)}, night after`, Icon: SunMoon },
] as const

function DefaultTheme({ value, onChange }: { value: NonNullable<Branding['defaultTheme']>; onChange: (v: NonNullable<Branding['defaultTheme']>) => void }) {
  const mine = useThemeMode()
  return (
    <div className="stack">
      <p className="muted tiny">What students, staff and admins see until they pick their own theme with the Day / Night / Auto switch.</p>
      <div className="theme-cards" role="radiogroup" aria-label="Default theme">
        {THEME_OPTIONS.map(({ id, label, sub, Icon }) => (
          <button key={id} type="button" role="radio" aria-checked={value === id} className={`theme-card ${value === id ? 'active' : ''}`} onClick={() => onChange(id)}>
            <span className={`theme-thumb ${id}`} aria-hidden>
              <span /><span /><span />
            </span>
            <span className="row gap-s"><Icon size={16} /><strong>{label}</strong></span>
            <small className="muted">{sub}</small>
          </button>
        ))}
      </div>
      {!mine.followsCollege && (
        <div className="alert alert-info tiny">
          <span>
            On this device you picked <strong>{mine.mode}</strong>, which overrides the college default.{' '}
            <button type="button" className="link" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => followCollegeDefault()}>Use college default here</button>
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------------- Domain ---------------- */

function CopyBtn({ text }: { text: string }) {
  const { toast } = useStore()
  return (
    <button className="icon-btn sm" aria-label="Copy" onClick={() => navigator.clipboard?.writeText(text).then(() => toast('Copied'), () => toast('Copy failed', 'error'))}>
      <Copy size={14} />
    </button>
  )
}

function DomainTab() {
  const { db, update, toast, tenant } = useStore()
  const [d, setD] = useState<DomainSettings>(db.domain)
  const [checking, setChecking] = useState(false)
  const [checks, setChecks] = useState<DomainCheck[] | null>(null)
  const [dnsError, setDnsError] = useState<string | null>(null)
  const slugErr = !SLUG_RE.test(d.subdomain) ? 'Use 3–32 lowercase letters, numbers or hyphens' : null
  const domainErr = d.customDomain && !DOMAIN_RE.test(d.customDomain) ? 'Enter a domain like tnkportal.com or portal.tnkcollege.com' : d.customDomain.endsWith(PLATFORM_DOMAIN) ? `Use your own domain, not ${PLATFORM_DOMAIN}` : null
  const dirty = JSON.stringify(d) !== JSON.stringify(db.domain)
  const saved = db.domain.customDomain
  const verified = db.domain.domainStatus === 'verified'
  const records = dnsRecordsFor(saved, { tenantId: tenant.id, subdomain: db.domain.subdomain })
  const apex = saved ? isApexDomain(saved) : false

  const save = () => {
    const conflict = checkAvailability(tenant.id, d.subdomain, d.customDomain)
    if (conflict) return toast(conflict, 'error')
    const domainChanged = d.customDomain !== db.domain.customDomain
    update((x) => { x.domain = { ...d, domainStatus: domainChanged ? (d.customDomain ? 'pending' : 'none') : d.domainStatus } })
    setD((p) => ({ ...p, domainStatus: domainChanged ? (p.customDomain ? 'pending' : 'none') : p.domainStatus }))
    if (domainChanged) setChecks(null)
    toast(domainChanged && d.customDomain ? 'Saved – add the DNS records below, then verify' : 'URL settings saved')
  }

  const verify = async () => {
    setChecking(true)
    setDnsError(null)
    const res = await verifyDomain(saved, { tenantId: tenant.id, subdomain: db.domain.subdomain })
    setChecking(false)
    setChecks(res.checks)
    if (res.error) return setDnsError(res.error)
    const status = res.ok ? 'verified' : 'failed'
    const at = new Date().toISOString()
    update((x) => { x.domain.domainStatus = status; x.domain.lastCheckedAt = at })
    setD((p) => ({ ...p, domainStatus: status, lastCheckedAt: at }))
    if (res.ok) toast(`${saved} is verified and live`)
    else toast('Some DNS records are missing. Changes can take up to 48 hours.', 'error')
  }

  const live = portalUrl(db.domain.subdomain, db.domain.customDomain, verified)

  return (
    <div className="stack-l">
      <Card title="Portal address">
        <div className="live-url">
          <Globe size={18} />
          <a href={live} target="_blank" rel="noreferrer" className="mono">{live}</a>
          <CopyBtn text={live} />
          <span className="spacer" />
          <a className="btn btn-secondary btn-sm" href={previewUrl(db.domain.subdomain)} target="_blank" rel="noreferrer"><ExternalLink size={14} /><span>Open preview</span></a>
        </div>
        {verified && saved ? (
          <p className="tiny muted mt-s">Your portal opens on <strong>{saved}</strong>{apex ? <> and <strong>www.{saved}</strong></> : null}. Students and staff never see {PLATFORM_DOMAIN}; the sign-in page, emails and links all use your domain.</p>
        ) : (
          <p className="tiny muted mt-s">Preview uses <code>?tenant={db.domain.subdomain}</code> on this deployment so you can test white-labelling before DNS is ready.</p>
        )}
      </Card>
      <Card title="Sub-domain">
        <Field label="Your free sub-domain" hint="Used until you connect your own domain" error={slugErr}>
          {(id) => (
            <div className="input-group">
              <span className="addon">https://</span>
              <input id={id} className="input mono" value={d.subdomain} onChange={(e) => setD({ ...d, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} maxLength={32} />
              <span className="addon">.{PLATFORM_DOMAIN}</span>
            </div>
          )}
        </Field>
      </Card>
      <Card title="Custom domain" actions={saved && <DomainStatus s={db.domain.domainStatus} />}>
        <div className="stack">
          <Field label="Your domain" hint="A domain you own, such as tnkportal.com, or a sub-domain such as portal.tnkcollege.com" error={domainErr}>
            {(id) => <input id={id} className="input mono" placeholder="tnkportal.com" autoCapitalize="none" spellCheck={false} value={d.customDomain} onChange={(e) => setD({ ...d, customDomain: e.target.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') })} />}
          </Field>
          <label className="checkbox"><input type="checkbox" checked={d.forceHttps} onChange={(e) => setD({ ...d, forceHttps: e.target.checked })} /> Redirect HTTP to HTTPS (free TLS certificate, issued automatically once verified)</label>
          <div className="row gap-s">
            <Button disabled={!dirty || !!slugErr || !!domainErr} onClick={save}>Save</Button>
            {dirty && <Button variant="ghost" onClick={() => setD(db.domain)}>Discard</Button>}
          </div>
          {saved && (
            <>
              <h4 className="mt">DNS records</h4>
              <p className="muted tiny">Add these at the company where you bought <strong>{saved}</strong> (GoDaddy, Cloudflare, Route 53, BigRock…), then click Verify. {apex ? 'A root domain cannot use a CNAME, so it points with an A record.' : 'A sub-domain points with a CNAME record.'}</p>
              <DnsTable records={records.filter((r) => r.required || r.id === 'www')} checks={checks} />
              <details className="dns-optional">
                <summary>Optional: send email from @{saved} <span className="muted tiny">— improves delivery and stops spoofing</span></summary>
                <DnsTable records={records.filter((r) => !r.required && r.id !== 'www')} checks={null} />
                <p className="tiny muted">If you send through your own provider (SendGrid, SES, Mailgun) in the Email tab, add the records that provider gives you instead.</p>
              </details>
              <div className="row gap-s">
                <Button variant="secondary" icon={checking ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} disabled={checking || dirty} onClick={verify}>{checking ? 'Checking DNS…' : 'Verify domain'}</Button>
                {db.domain.lastCheckedAt && <small className="muted">Last checked {formatDate(db.domain.lastCheckedAt, { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}</small>}
              </div>
              {dnsError && <div className="alert alert-error" role="alert">{dnsError}. Try again in a moment.</div>}
              {DNS_VERIFY_MODE === 'simulate' && <p className="tiny muted">Demo build: verification is simulated. Set <code>VITE_DNS_VERIFY=doh</code> to check real DNS records.</p>}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}

function DnsTable({ records, checks }: { records: DnsRecord[]; checks: DomainCheck[] | null }) {
  return (
    <div className="table-wrap">
      <table className="table dns">
        <thead><tr><th>Type</th><th>Host / Name</th><th>Value</th><th><span className="sr-only">Copy</span></th></tr></thead>
        <tbody>
          {records.map((r) => {
            const c = checks?.find((x) => x.id === r.id)
            return (
              <tr key={r.id}>
                <td><Badge>{r.type}</Badge></td>
                <td className="mono" title={r.fqdn}>{r.host}<small className="muted block">{r.purpose}</small></td>
                <td className="mono wrap-anywhere">
                  {r.value}
                  {c && <small className={c.ok ? 'text-green block' : 'text-red block'}>{c.ok ? '✓ Found' : c.found.length ? `✗ Found: ${c.found.join(', ')}` : '✗ Not found yet'}</small>}
                </td>
                <td><CopyBtn text={r.value} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function DomainStatus({ s }: { s: DomainSettings['domainStatus'] }) {
  if (s === 'verified') return <Badge tone="green"><CheckCircle2 size={12} /> Verified</Badge>
  if (s === 'failed') return <Badge tone="red"><XCircle size={12} /> Not verified</Badge>
  if (s === 'pending') return <Badge tone="amber">Pending DNS</Badge>
  return null
}

/* ---------------- Email ---------------- */

function EmailTab() {
  const { db, update, toast, session } = useStore()
  const [e, setE] = useState<EmailSettings>(db.email)
  const [testTo, setTestTo] = useState(db.branding.supportEmail)
  const [testing, setTesting] = useState(false)
  const set = <K extends keyof EmailSettings>(k: K, v: EmailSettings[K]) => setE((p) => ({ ...p, [k]: v, verified: false }))
  const err = validateEmailSettings(e)
  const dirty = JSON.stringify(e) !== JSON.stringify(db.email)

  const save = () => {
    if (err) return toast(err, 'error')
    update((d) => { d.email = e })
    toast('Email settings saved')
  }

  const test = async () => {
    if (err) return toast(err, 'error')
    if (!isValidEmail(testTo)) return toast('Enter a valid test recipient', 'error')
    setTesting(true)
    const r = await sendEmail(e, { to: [testTo], subject: `Test email from ${db.branding.collegeName}`, body: `Hello,\n\nThis is a test email confirming that ${e.fromName} can send mail through ${PROVIDERS.find((p) => p.id === e.provider)?.label}.\n\nSent by ${session?.name}.` })
    setTesting(false)
    if (r.ok) {
      setE((p) => ({ ...p, verified: true }))
      update((d) => {
        // Only mark the saved config as tested; unsaved edits are persisted via Save.
        if (!dirty) d.email.verified = true
        d.emailLog.unshift({ id: `mail-test-${Date.now()}`, to: [testTo], subject: `Test email from ${db.branding.collegeName}`, body: 'Configuration test', status: 'sent', sentAt: new Date().toISOString(), sentBy: session?.name ?? 'admin', provider: e.provider })
      })
      toast(r.simulated ? 'Configuration valid – test email simulated (connect a relay to deliver for real)' : `Test email delivered to ${testTo}`)
    } else toast(r.error ?? 'Test failed', 'error')
  }

  return (
    <div className="grid side-r">
      <div className="stack-l">
        <Card title="Provider">
          <div className="provider-grid">
            {PROVIDERS.map((p) => (
              <button key={p.id} className={`provider ${e.provider === p.id ? 'active' : ''}`} onClick={() => set('provider', p.id)} aria-pressed={e.provider === p.id}>
                <strong>{p.label}</strong>
                <small>{p.hint}</small>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Connection">
          <div className="form-grid">
            {e.provider === 'smtp' && (
              <>
                <Field label="SMTP host">{(id) => <input id={id} className="input mono" value={e.smtpHost} onChange={(x) => set('smtpHost', x.target.value)} placeholder="smtp.gmail.com" />}</Field>
                <Field label="Port">{(id) => <input id={id} type="number" className="input" value={e.smtpPort} onChange={(x) => set('smtpPort', +x.target.value)} />}</Field>
                <Field label="Username">{(id) => <input id={id} className="input" value={e.smtpUser} onChange={(x) => set('smtpUser', x.target.value)} autoComplete="off" />}</Field>
                <Field label="Password / app password">{(id) => <input id={id} type="password" className="input" value={e.smtpPassword} onChange={(x) => set('smtpPassword', x.target.value)} autoComplete="new-password" />}</Field>
                <label className="checkbox span-2"><input type="checkbox" checked={e.smtpSecure} onChange={(x) => set('smtpSecure', x.target.checked)} /> Use TLS / STARTTLS</label>
              </>
            )}
            {(e.provider === 'sendgrid' || e.provider === 'mailgun' || e.provider === 'ses') && (
              <>
                <Field label={e.provider === 'ses' ? 'Access key / secret' : 'API key'} span={2}>{(id) => <input id={id} type="password" className="input mono" value={e.apiKey} onChange={(x) => set('apiKey', x.target.value)} autoComplete="off" />}</Field>
                {e.provider === 'mailgun' && <Field label="Sending domain">{(id) => <input id={id} className="input mono" value={e.domain} onChange={(x) => set('domain', x.target.value)} placeholder="mg.yourcollege.edu" />}</Field>}
                {e.provider === 'ses' && <Field label="Region">{(id) => <input id={id} className="input mono" value={e.region} onChange={(x) => set('region', x.target.value)} />}</Field>}
              </>
            )}
            {e.provider === 'webhook' && (
              <Field label="Relay endpoint (HTTPS)" span={2} hint="Receives JSON: { from, replyTo, to[], subject, text }">{(id) => <input id={id} className="input mono" value={e.webhookUrl} onChange={(x) => set('webhookUrl', x.target.value)} placeholder="https://api.yourcollege.edu/send-email" />}</Field>
            )}
          </div>
          <div className="alert alert-info mt tiny">
            Credentials are stored in this browser for the demo. In production, store them on your backend and send through the HTTPS relay so secrets never reach the client.
          </div>
        </Card>
        <Card title="Sender identity">
          <div className="form-grid">
            <Field label="From name">{(id) => <input id={id} className="input" value={e.fromName} onChange={(x) => set('fromName', x.target.value)} />}</Field>
            <Field label="From email" error={e.fromEmail && !isValidEmail(e.fromEmail) ? 'Invalid email' : null}>{(id) => <input id={id} className="input" value={e.fromEmail} onChange={(x) => set('fromEmail', x.target.value)} />}</Field>
            <Field label="Reply-to" error={e.replyTo && !isValidEmail(e.replyTo) ? 'Invalid email' : null}>{(id) => <input id={id} className="input" value={e.replyTo} onChange={(x) => set('replyTo', x.target.value)} />}</Field>
            <Field label="Footer text" span={2}>{(id) => <textarea id={id} className="input" rows={2} value={e.footer} onChange={(x) => set('footer', x.target.value)} />}</Field>
          </div>
        </Card>
      </div>
      <div className="sticky">
        <Card title="Status">
          <div className="stack">
            <div className="row gap-s">{e.verified ? <Badge tone="green"><CheckCircle2 size={12} /> Tested</Badge> : <Badge tone="amber">Not tested</Badge>}</div>
            {err && <div className="alert alert-error tiny">{err}</div>}
            <Button disabled={!dirty || !!err} onClick={save}>Save settings</Button>
            <hr />
            <Field label="Send test email to">{(id) => <input id={id} className="input" value={testTo} onChange={(x) => setTestTo(x.target.value)} />}</Field>
            <Button variant="secondary" icon={<Send size={16} />} loading={testing} disabled={!!err} onClick={test}>Send test</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- Approval limit ---------------- */

/** Management owns the spending threshold; GST/TDS registrations stay with Accounts. */
function ApprovalLimitTab() {
  const { db, update, toast } = useStore()
  const cur = db.branding.currency
  const [v, setV] = useState(String(db.tax.procurementApprovalLimit))
  const n = Number(v)
  const err = v.trim() === '' || !Number.isFinite(n) || n < 0 ? 'Enter an amount of 0 or more' : null
  return (
    <div className="grid two">
      <Card title="Purchase approval limit">
        <p className="muted">Equipment and repair requests above this amount, and every purchase, need management approval after the HOD. Currently {formatMoney(db.tax.procurementApprovalLimit, cur)}.</p>
        <div className="form-grid mt">
          <Field label={`Limit (${cur})`} error={err}>{(id) => <input id={id} type="number" min={0} step={1000} inputMode="numeric" className="input" value={v} onChange={(e) => setV(e.target.value)} />}</Field>
        </div>
        <div className="row mt"><span className="spacer" /><Button disabled={!!err || n === db.tax.procurementApprovalLimit} onClick={() => { update((d) => { d.tax.procurementApprovalLimit = Math.round(n) }); toast('Approval limit saved') }}>Save</Button></div>
      </Card>
    </div>
  )
}

/* ---------------- Data ---------------- */

function DataTab() {
  const { db, update, toast, resetDemo } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${db.domain.subdomain}-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const importJson = async (f?: File) => {
    if (!f) return
    try {
      const parsed = JSON.parse(await f.text())
      const required = ['branding', 'students', 'staff', 'subjects', 'timetable', 'attendance', 'fees', 'payments']
      if (!parsed || typeof parsed !== 'object' || !required.every((k) => k in parsed)) throw new Error('Not a valid backup file')
      if (!['students', 'staff', 'subjects', 'timetable', 'attendance', 'fees', 'payments'].every((k) => Array.isArray(parsed[k])) || typeof parsed.branding !== 'object') throw new Error('Backup file is damaged - lists are missing')
      if (!confirm('Replace all current data with this backup?')) return
      // Keep this college's own URL settings: a backup from another college must not claim its sub-domain.
      update((d) => { Object.assign(d, parsed, { domain: d.domain }) })
      toast('Backup restored')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed', 'error')
    }
  }
  return (
    <div className="grid two">
      <Card title="Backup">
        <p className="muted">Download everything — branding, students, attendance, fees — as JSON.</p>
        <div className="row gap-s mt">
          <Button icon={<Download size={16} />} onClick={exportJson}>Export backup</Button>
          <Button variant="secondary" icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>Restore</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = '' }} />
        </div>
      </Card>
      <Card title="Reset demo">
        <p className="muted">Restore the original sample data for this college. Your branding and settings will also be reset.</p>
        <Button className="mt" variant="danger" icon={<RotateCcw size={16} />} onClick={() => { if (confirm('Reset all data for this college?')) { resetDemo(); toast('Demo data restored') } }}>Reset data</Button>
      </Card>
      <Card title="Your logo in the app">
        <div className="row gap"><Logo size={48} /><span className="muted">This is how your logo appears in the sidebar and receipts.</span></div>
      </Card>
    </div>
  )
}
