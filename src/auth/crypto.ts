/** Small WebCrypto helpers for the auth layer. Nothing here stores or logs secrets. */

const enc = new TextEncoder()

/** WebCrypto only exists on HTTPS pages (and localhost). Without it nothing can be hashed safely, so say so plainly. */
export function secureCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

/** URL-safe random secret (default 192 bits). */
export function randomToken(bytes = 24): string {
  return toBase64Url(randomBytes(bytes))
}

/** Uniformly distributed numeric code (rejection sampling, no modulo bias). */
export function randomCode(digits = 6): string {
  const max = 10 ** digits
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % max).padStart(digits, '0')
}

export async function sha256(text: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))))
}

export async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, key, 256)
  return toBase64Url(new Uint8Array(bits))
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}
