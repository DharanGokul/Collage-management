import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Palette, Globe, Mail, Database as DbIcon, Upload, Trash2, Copy, CheckCircle2, XCircle, Loader2, ExternalLink, Send, Download, RotateCcw, ShieldCheck } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Field, Logo, PageHeader, Tabs } from '../../components/ui'
import { PRESET_COLORS, HEX_RE, contrastRatio, contrastText, readImage, generatedFavicon } from '../../lib/theme'
import { DOMAIN_RE, PLATFORM_DOMAIN, SLUG_RE, checkAvailability, portalUrl, previewUrl, verifyDomain } from '../../lib/tenant'
import { PROVIDERS, sendEmail, validateEmailSettings } from '../../lib/email'
import { formatDate, isValidEmail } from '../../lib/utils'
import type { Branding, DomainSettings, EmailSettings } from '../../types'

type Tab = 'branding' | 'domain' | 'email' | 'data'

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (['branding', 'domain', 'email', 'data'].includes(params.get('tab') ?? '') ? params.get('tab') : 'branding') as Tab
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
          { id: 'data', label: 'Data', icon: <DbIcon size={16} /> },
        ]}
      />
      {tab === 'branding' && <BrandingTab />}
      {tab === 'domain' && <DomainTab />}
      {tab === 'email' && <EmailTab />}
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
  const [hexInput, setHexInput] = useState(b.primaryColor)
  const dirty = JSON.stringify(b) !== JSON.stringify(db.branding)
  const ratio = HEX_RE.test(b.primaryColor) ? contrastRatio(b.primaryColor, contrastText(b.primaryColor)) : 0
  const valid = b.collegeName.trim().length > 1 && HEX_RE.test(b.primaryColor) && (!b.supportEmail || isValidEmail(b.supportEmail))

  // Live preview: theme follows unsaved changes; reverts if the user leaves without saving.
  useEffect(() => {
    const root = document.documentElement
    if (HEX_RE.test(b.primaryColor)) root.style.setProperty('--primary', b.primaryColor)
  }, [b.primaryColor])
  useEffect(() => () => { document.documentElement.style.setProperty('--primary', db.branding.primaryColor) }, [db.branding.primaryColor])

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
        <Card title="Primary colour">
          <div className="color-row">
            <input type="color" className="color-input" value={HEX_RE.test(b.primaryColor) ? b.primaryColor : '#4f46e5'} onChange={(e) => { set('primaryColor', e.target.value); setHexInput(e.target.value) }} aria-label="Pick colour" />
            <input className="input mono" style={{ width: 120 }} value={hexInput} onChange={(e) => { const v = e.target.value.trim(); setHexInput(v); if (HEX_RE.test(v)) set('primaryColor', v.toLowerCase()) }} aria-label="Hex colour" />
            <div className="swatches">
              {PRESET_COLORS.map((c) => <button key={c} className={`swatch ${b.primaryColor === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Use ${c}`} onClick={() => { set('primaryColor', c); setHexInput(c) }} />)}
            </div>
          </div>
          {!HEX_RE.test(hexInput) && <small className="field-error">Use a 6-digit hex value like #1d4ed8</small>}
          <p className="tiny muted mt-s">
            Button text contrast: <strong>{ratio.toFixed(1)}:1</strong> {ratio >= 4.5 ? <Badge tone="green">AA</Badge> : ratio >= 3 ? <Badge tone="amber">AA large</Badge> : <Badge tone="red">Low</Badge>}
          </p>
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
          <div className="brand-preview" style={{ ['--primary' as string]: b.primaryColor, ['--primary-contrast' as string]: HEX_RE.test(b.primaryColor) ? contrastText(b.primaryColor) : '#fff' }}>
            <div className="bp-browser">
              <img src={b.favicon ?? generatedFavicon(b.shortName || b.collegeName, HEX_RE.test(b.primaryColor) ? b.primaryColor : '#4f46e5')} alt="" />
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
            <Button variant="secondary" disabled={!dirty} onClick={() => { setB(db.branding); setHexInput(db.branding.primaryColor) }}>Reset</Button>
          </div>
        </Card>
      </div>
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
  const slugErr = !SLUG_RE.test(d.subdomain) ? 'Use 3–32 lowercase letters, numbers or hyphens' : null
  const domainErr = d.customDomain && !DOMAIN_RE.test(d.customDomain) ? 'Enter a domain like portal.myuniversity.edu' : d.customDomain.endsWith(PLATFORM_DOMAIN) ? `Use your own domain, not ${PLATFORM_DOMAIN}` : null
  const dirty = JSON.stringify(d) !== JSON.stringify(db.domain)
  const target = `${db.domain.subdomain}.${PLATFORM_DOMAIN}`
  const txt = `campus-verify=${tenant.id}-${db.domain.subdomain}`

  const save = () => {
    const conflict = checkAvailability(tenant.id, d.subdomain, d.customDomain)
    if (conflict) return toast(conflict, 'error')
    const domainChanged = d.customDomain !== db.domain.customDomain
    update((x) => { x.domain = { ...d, domainStatus: domainChanged ? (d.customDomain ? 'pending' : 'none') : d.domainStatus } })
    setD((p) => ({ ...p, domainStatus: domainChanged ? (p.customDomain ? 'pending' : 'none') : p.domainStatus }))
    toast(domainChanged && d.customDomain ? 'Saved – add the DNS records below, then verify' : 'URL settings saved')
  }

  const verify = async () => {
    setChecking(true)
    const ok = await verifyDomain(db.domain.customDomain)
    setChecking(false)
    const status = ok ? 'verified' : 'failed'
    update((x) => { x.domain.domainStatus = status; x.domain.lastCheckedAt = new Date().toISOString() })
    setD((p) => ({ ...p, domainStatus: status, lastCheckedAt: new Date().toISOString() }))
    ok ? toast(`${db.domain.customDomain} is verified and live`) : toast('DNS records not found yet. Changes can take up to 48 hours.', 'error')
  }

  const live = portalUrl(db.domain.subdomain, db.domain.customDomain, db.domain.domainStatus === 'verified')

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
        <p className="tiny muted mt-s">Preview uses <code>?tenant={db.domain.subdomain}</code> on this deployment so you can test white-labelling before DNS is ready.</p>
      </Card>
      <Card title="Sub-domain">
        <Field label="Your free sub-domain" error={slugErr}>
          {(id) => (
            <div className="input-group">
              <span className="addon">https://</span>
              <input id={id} className="input mono" value={d.subdomain} onChange={(e) => setD({ ...d, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} maxLength={32} />
              <span className="addon">.{PLATFORM_DOMAIN}</span>
            </div>
          )}
        </Field>
      </Card>
      <Card title="Custom domain" actions={db.domain.customDomain && <DomainStatus s={db.domain.domainStatus} />}>
        <div className="stack">
          <Field label="Domain" hint="Use a sub-domain such as portal.yourcollege.edu" error={domainErr}>
            {(id) => <input id={id} className="input mono" placeholder="portal.yourcollege.edu" value={d.customDomain} onChange={(e) => setD({ ...d, customDomain: e.target.value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') })} />}
          </Field>
          <label className="checkbox"><input type="checkbox" checked={d.forceHttps} onChange={(e) => setD({ ...d, forceHttps: e.target.checked })} /> Redirect HTTP to HTTPS (free TLS certificate)</label>
          <div className="row gap-s">
            <Button disabled={!dirty || !!slugErr || !!domainErr} onClick={save}>Save</Button>
            {dirty && <Button variant="ghost" onClick={() => setD(db.domain)}>Discard</Button>}
          </div>
          {db.domain.customDomain && (
            <>
              <h4 className="mt">DNS records</h4>
              <p className="muted tiny">Add these at your DNS provider (GoDaddy, Cloudflare, Route 53…), then click Verify.</p>
              <div className="table-wrap">
                <table className="table dns">
                  <thead><tr><th>Type</th><th>Host / Name</th><th>Value</th><th /></tr></thead>
                  <tbody>
                    <tr><td><Badge>CNAME</Badge></td><td className="mono">{db.domain.customDomain}</td><td className="mono">{target}</td><td><CopyBtn text={target} /></td></tr>
                    <tr><td><Badge>TXT</Badge></td><td className="mono">_campus.{db.domain.customDomain}</td><td className="mono">{txt}</td><td><CopyBtn text={txt} /></td></tr>
                  </tbody>
                </table>
              </div>
              <div className="row gap-s">
                <Button variant="secondary" icon={checking ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} disabled={checking || dirty} onClick={verify}>{checking ? 'Checking DNS…' : 'Verify domain'}</Button>
                {db.domain.lastCheckedAt && <small className="muted">Last checked {formatDate(db.domain.lastCheckedAt, { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}</small>}
              </div>
            </>
          )}
        </div>
      </Card>
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
      const next = { ...e, verified: true }
      setE(next)
      update((d) => {
        d.email = next
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
      if (!required.every((k) => k in parsed)) throw new Error('Not a valid backup file')
      if (!confirm('Replace all current data with this backup?')) return
      update((d) => { Object.assign(d, parsed) })
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
