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

  const byDomain = registry.find((t) => t.customDomain && t.domainVerified && t.customDomain === host)
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

/**
 * Simulated DNS verification. A real implementation would ask the backend to
 * resolve the CNAME / TXT record. Here: any syntactically valid domain that is
 * not on a reserved TLD verifies after a short delay.
 */
export async function verifyDomain(domain: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 1200))
  return DOMAIN_RE.test(domain) && !/\.(invalid|test|example|localhost)$/.test(domain)
}
