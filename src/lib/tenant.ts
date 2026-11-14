/**
 * URL white-labelling.
 *
 * A tenant (college) is resolved from the URL in this order:
 *   1. `?tenant=<slug>` query param            (handy for previews / localhost)
 *   2. exact match of a tenant's custom domain  (e.g. portal.myuniversity.edu)
 *   3. `<slug>.<PLATFORM_DOMAIN>` subdomain     (e.g. northbridge.campusone.app)
 *   4. the default tenant
 *
 * Front-end only: the registry lives in localStorage. In production the same
 * lookup would be a `GET /tenants/resolve?host=` call to your backend.
 */

export const PLATFORM_DOMAIN: string = import.meta.env.VITE_PLATFORM_DOMAIN || 'campusone.app'

export type TenantPlan = 'starter' | 'growth' | 'enterprise'

export interface TenantRef {
  id: string
  subdomain: string
  /** Claimed custom domain (pending or verified) – used for uniqueness checks. */
  customDomain: string
  /** Only verified domains are used to resolve the tenant from the host name. */
  domainVerified?: boolean
  name: string
  /** Managed by the platform super admin. */
  status?: 'active' | 'suspended'
  plan?: TenantPlan
  /** College admin login, set when the college is provisioned by the super admin. */
  adminEmail?: string
  createdAt?: string
}

const REGISTRY_KEY = 'cms:registry'

/** Sub-domains the platform keeps for itself (a college must not look like the platform or its support). */
export const RESERVED_SLUGS = new Set(['www', 'app', 'api', 'admin', 'super', 'superadmin', 'login', 'portal', 'mail', 'support', 'help', 'status', 'billing', 'static', 'assets', 'cdn', 'demo', 'test'])
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/
export const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/

function readRegistry(): TenantRef[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) return parsed
  } catch {
    /* ignore */
  }
  return []
}

function writeRegistry(list: TenantRef[]) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(list))
  } catch {
    /* storage full / blocked */
  }
}

export function listTenants() {
  return readRegistry()
}

export function getTenant(id: string) {
  return readRegistry().find((t) => t.id === id)
}

/** Merge-update so college-side saves never clobber platform-managed fields (status, plan…). */
export function upsertTenant(ref: TenantRef) {
  const list = readRegistry()
  const i = list.findIndex((t) => t.id === ref.id)
  const merged = { status: 'active', plan: 'starter', createdAt: new Date().toISOString(), ...(i >= 0 ? list[i] : {}), ...stripUndefined(ref), id: ref.id } as TenantRef
  if (i >= 0) list[i] = merged
  else list.push(merged)
  writeRegistry(list)
}

export function patchTenant(id: string, patch: Partial<TenantRef>) {
  const list = readRegistry()
  const t = list.find((x) => x.id === id)
  if (!t) return
  Object.assign(t, stripUndefined(patch))
  writeRegistry(list)
}

export function removeTenant(id: string) {
  writeRegistry(readRegistry().filter((t) => t.id !== id))
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** "St. Joseph's College of Arts" -> "st-josephs-college-of-arts" (trimmed to 32 chars). */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
}

/** Returns an error message if the slug / domain is already taken by another tenant. */
export function checkAvailability(id: string, subdomain: string, customDomain: string): string | null {
  const others = readRegistry().filter((t) => t.id !== id)
  if (RESERVED_SLUGS.has(subdomain) && !readRegistry().some((t) => t.id === id && t.subdomain === subdomain)) return `The sub-domain "${subdomain}" is reserved by the platform.`
  if (others.some((t) => t.subdomain === subdomain)) return `The sub-domain "${subdomain}" is already in use.`
  if (customDomain && others.some((t) => t.customDomain === customDomain))
    return `The domain "${customDomain}" is already connected to another college.`
  return null
}

export interface ResolvedTenant {
  id: string
  via: 'query' | 'custom-domain' | 'subdomain' | 'default'
  slug: string
  /** True when the URL names a college that the super admin has not provisioned. */
  missing?: boolean
}

export function resolveTenant(loc: Location = window.location): ResolvedTenant {
  const registry = readRegistry()
  const host = loc.hostname.toLowerCase()

  const param = new URLSearchParams(loc.search).get('tenant')?.toLowerCase().trim()
  if (param && SLUG_RE.test(param)) {
    const hit = registry.find((t) => t.subdomain === param)
    return { id: hit?.id ?? '', via: 'query', slug: param, missing: !hit }
  }

  // tnkportal.com and www.tnkportal.com both open the same college.
  const byDomain = registry.find((t) => t.customDomain && t.domainVerified && (t.customDomain === host || `www.${t.customDomain}` === host))
  if (byDomain) return { id: byDomain.id, via: 'custom-domain', slug: byDomain.subdomain }

  const suffix = '.' + PLATFORM_DOMAIN
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length)
    if (SLUG_RE.test(slug)) {
      const hit = registry.find((t) => t.subdomain === slug)
      return { id: hit?.id ?? '', via: 'subdomain', slug, missing: !hit }
    }
  }

  return { id: 'default', via: 'default', slug: '' }
}

export function portalUrl(subdomain: string, customDomain: string, verified: boolean) {
  if (customDomain && verified) return `https://${customDomain}`
  return `https://${subdomain}.${PLATFORM_DOMAIN}`
}

/** A URL that works right now in this deployment (keeps current host, sets ?tenant=). */
export function previewUrl(subdomain: string) {
  const u = new URL(window.location.href)
  if (subdomain) u.searchParams.set('tenant', subdomain)
  else u.searchParams.delete('tenant')
  u.hash = '#/login'
  return u.toString()
}

/* ------------------------------------------------------------------ custom domains */

/** Second-level public suffixes, so "tnkcollege.ac.in" is treated as an apex domain. The backend should use the full Public Suffix List. */
const SECOND_LEVEL_SUFFIXES = new Set(['co.in', 'ac.in', 'edu.in', 'org.in', 'gov.in', 'net.in', 'res.in', 'co.uk', 'ac.uk', 'org.uk', 'com.au', 'edu.au', 'co.nz', 'ac.nz', 'co.za', 'ac.za', 'com.sg', 'edu.sg', 'com.my', 'edu.my', 'co.jp', 'ac.jp', 'edu.pk', 'com.pk', 'edu.np', 'ac.lk', 'com.bd', 'edu.bd', 'edu.ph', 'com.ph'])

/** `tnkportal.com` / `tnk.ac.in` are apex (root) domains: DNS does not allow a CNAME there. */
export function isApexDomain(domain: string): boolean {
  const labels = domain.split('.')
  return labels.length === 2 || (labels.length === 3 && SECOND_LEVEL_SUFFIXES.has(labels.slice(1).join('.')))
}

/** Where an apex domain points. Replace with the platform's real edge addresses. */
export const PLATFORM_IPS: string[] = (import.meta.env.VITE_PLATFORM_IPS || '203.0.113.10').split(',').map((x: string) => x.trim())

export interface DnsRecord {
  id: 'route' | 'www' | 'verify' | 'spf' | 'dkim' | 'dmarc'
  purpose: string
  type: 'A' | 'CNAME' | 'TXT'
  /** As most DNS panels want it: relative to the domain ("@" for the root). */
  host: string
  fqdn: string
  value: string
  /** Optional records are guidance (e.g. email authentication) and are not part of verification. */
  required: boolean
}

export function dnsRecordsFor(domain: string, ctx: { tenantId: string; subdomain: string }): DnsRecord[] {
  if (!domain) return []
  const apex = isApexDomain(domain)
  const target = `${ctx.subdomain}.${PLATFORM_DOMAIN}`
  const label = apex ? '@' : domain.split('.')[0]
  const rel = (name: string) => (apex ? name : `${name}.${label}`)
  const records: DnsRecord[] = [
    apex
      ? { id: 'route', purpose: 'Point your domain to the portal', type: 'A', host: '@', fqdn: domain, value: PLATFORM_IPS[0], required: true }
      : { id: 'route', purpose: 'Point your domain to the portal', type: 'CNAME', host: label, fqdn: domain, value: target, required: true },
  ]
  if (apex) records.push({ id: 'www', purpose: 'Make www open the same portal', type: 'CNAME', host: 'www', fqdn: `www.${domain}`, value: target, required: false })
  records.push(
    { id: 'verify', purpose: 'Prove you own the domain', type: 'TXT', host: rel('_campus'), fqdn: `_campus.${domain}`, value: `campus-verify=${ctx.tenantId}-${ctx.subdomain}`, required: true },
    { id: 'spf', purpose: 'Email: allow the portal to send as you', type: 'TXT', host: label, fqdn: domain, value: `v=spf1 include:_spf.${PLATFORM_DOMAIN} ~all`, required: false },
    { id: 'dkim', purpose: 'Email: sign messages (DKIM)', type: 'CNAME', host: rel('campus._domainkey'), fqdn: `campus._domainkey.${domain}`, value: `campus.dkim.${PLATFORM_DOMAIN}`, required: false },
    { id: 'dmarc', purpose: 'Email: tell inboxes how to treat spoofed mail', type: 'TXT', host: rel('_dmarc'), fqdn: `_dmarc.${domain}`, value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`, required: false },
  )
  return records
}

export interface DomainCheck {
  id: DnsRecord['id']
  label: string
  ok: boolean
  /** What DNS answered, so the admin can see what to correct. */
  found: string[]
}

/**
 * `simulate` (default in this front-end build): any well-formed domain on a real-looking TLD passes.
 * `doh`: ask a public DNS-over-HTTPS resolver for the actual records. In production the backend does this check
 * (and reads the CNAME/A target itself), because browsers cannot reach every resolver and CSP may block it.
 */
export const DNS_VERIFY_MODE: 'simulate' | 'doh' = import.meta.env.VITE_DNS_VERIFY === 'doh' ? 'doh' : 'simulate'

async function dnsLookup(name: string, type: 'A' | 'CNAME' | 'TXT'): Promise<string[]> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' } })
  if (!res.ok) throw new Error(`DNS lookup failed (${res.status})`)
  const json = (await res.json()) as { Answer?: { type: number; data: string }[] }
  const want = { A: 1, CNAME: 5, TXT: 16 }[type]
  return (json.Answer ?? []).filter((a) => a.type === want).map((a) => String(a.data).replace(/^"|"$/g, '').replace(/\.$/, ''))
}

export async function verifyDomain(domain: string, ctx: { tenantId: string; subdomain: string }): Promise<{ ok: boolean; checks: DomainCheck[]; error?: string }> {
  const required = dnsRecordsFor(domain, ctx).filter((r) => r.required)
  if (DNS_VERIFY_MODE === 'simulate') {
    await new Promise((r) => setTimeout(r, 900))
    const ok = DOMAIN_RE.test(domain) && !/\.(invalid|test|example|localhost)$/.test(domain)
    return { ok, checks: required.map((r) => ({ id: r.id, label: r.purpose, ok, found: ok ? [r.value] : [] })) }
  }
  try {
    const checks = await Promise.all(
      required.map(async (r): Promise<DomainCheck> => {
        const found = await dnsLookup(r.fqdn, r.type === 'A' ? 'A' : r.type)
        const ok = r.type === 'A' ? found.some((ip) => PLATFORM_IPS.includes(ip)) : found.some((v) => v.toLowerCase() === r.value.toLowerCase())
        return { id: r.id, label: r.purpose, ok, found }
      }),
    )
    return { ok: checks.every((c) => c.ok), checks }
  } catch (e) {
    return { ok: false, checks: [], error: e instanceof Error ? e.message : 'DNS lookup failed' }
  }
}
