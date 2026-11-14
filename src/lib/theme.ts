import type { Branding } from '../types'
import { setCollegeDefault } from './themeMode'
import { resolveSecondary, tint } from './color'

export const HEX_RE = /^#([0-9a-f]{6})$/i

function hexToRgb(hex: string): [number, number, number] {
  const m = HEX_RE.exec(hex) ?? HEX_RE.exec('#6d001a')!
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

function mix(hex: string, target: [number, number, number], amount: number) {
  const [r, g, b] = hexToRgb(hex)
  return toHex(r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount)
}

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** White or near-black text, whichever reads better on the brand colour. */
export const contrastText = (hex: string) => (contrastRatio(hex, '#ffffff') >= 4.5 ? '#ffffff' : '#000000')

/** Sets every brand-derived CSS variable from one hex colour. */
export const DEFAULT_ACCENT = '#6d001a' // Caesar Burgundy

/** Move a colour toward `target` until it reaches `ratio` contrast against `bg`. */
function ensureContrast(hex: string, bg: string, ratio: number, target: [number, number, number]) {
  let c = hex
  for (let k = 0; k <= 20 && contrastRatio(c, bg) < ratio; k++) c = mix(hex, target, k / 20)
  return c
}

/**
 * Applies a college's brand colour as the Caesar accent. Derives the pressed
 * state, readable on-accent text, and an accent-text tint for each theme
 * (Noir needs a light tint: Burgundy on Black is only 1.7:1).
 */
export function applyPalette(hex: string, secondaryHex?: string) {
  const root = document.documentElement
  const accent = HEX_RE.test(hex) ? hex.toLowerCase() : DEFAULT_ACCENT
  const [r, g, bl] = hexToRgb(accent)
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-rgb', `${r} ${g} ${bl}`)
  root.style.setProperty('--accent-pressed', mix(accent, [0, 0, 0], 0.32))
  root.style.setProperty('--on-accent', contrastText(accent))
  root.style.setProperty('--accent-text-dark', accent === DEFAULT_ACCENT ? '#e8a1b0' : ensureContrast(accent, '#141414', 7, [255, 255, 255]))
  root.style.setProperty('--accent-text-light', ensureContrast(accent, '#f4f2f2', 4.5, [0, 0, 0]))

  // Secondary accent (derived by harmony unless a custom one is set)
  const sec = secondaryHex && HEX_RE.test(secondaryHex) ? secondaryHex.toLowerCase() : resolveSecondary(accent, 'analogous', null)
  const [sr, sg, sb] = hexToRgb(sec)
  root.style.setProperty('--secondary', sec)
  root.style.setProperty('--secondary-rgb', `${sr} ${sg} ${sb}`)
  root.style.setProperty('--on-secondary', contrastText(sec))
  root.style.setProperty('--secondary-text-dark', ensureContrast(sec, '#141414', 7, [255, 255, 255]))
  root.style.setProperty('--secondary-text-light', ensureContrast(sec, '#f4f2f2', 4.5, [0, 0, 0]))
  // Day-mode background washes follow the brand
  root.style.setProperty('--tint-1', tint(sec, 0.8))
  root.style.setProperty('--tint-2', tint(accent, 0.86))
  root.style.setProperty('--tint-3', tint(sec, 0.9))
  return accent
}

export function applyTheme(b: Branding) {
  setCollegeDefault(b.defaultTheme)
  const primary = applyPalette(b.primaryColor, resolveSecondary(HEX_RE.test(b.primaryColor) ? b.primaryColor : DEFAULT_ACCENT, b.secondaryHarmony, b.secondaryColor))

  document.title = b.collegeName ? `${b.collegeName} · Portal` : 'Campus Portal'

  const theme = document.querySelector('meta[name="theme-color"]')
  theme?.setAttribute('content', primary)

  let link = document.getElementById('app-favicon') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = 'app-favicon'
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = b.favicon ?? generatedFavicon(b.shortName || b.collegeName, primary)
  link.type = b.favicon?.startsWith('data:image/svg') || !b.favicon ? 'image/svg+xml' : 'image/png'
}

/** Monogram favicon in the brand colour, used until a custom favicon is uploaded. */
export function generatedFavicon(name: string, color: string) {
  const letter = (name.trim()[0] || 'C').toUpperCase().replace(/[<>&"']/g, '')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/><text x="32" y="44" font-family="Archivo,Arial Black,sans-serif" font-size="34" font-weight="900" text-anchor="middle" fill="${contrastText(color)}">${letter}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export const PRESET_COLORS: string[] = ['#6d001a', '#000000', '#1f3a5f', '#0b5d4b', '#7a4b00', '#4b1d6b', '#8c1c13', '#2f4f4f', '#5a3e2b', '#1d4ed8']

/**
 * Read an uploaded image and downscale it so it fits comfortably in
 * localStorage. SVGs are kept as-is (they are already tiny and scalable).
 */
export function readImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp|svg\+xml|x-icon|vnd\.microsoft\.icon|gif)$/.test(file.type))
      return reject(new Error('Please choose a PNG, JPG, WEBP, SVG, GIF or ICO image.'))
    if (file.size > 2 * 1024 * 1024) return reject(new Error('Image must be smaller than 2 MB.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.onload = () => {
      const url = reader.result as string
      if (file.type === 'image/svg+xml') {
        // Reject files that merely claim to be SVG (renamed text, truncated markup).
        const probe = new Image()
        probe.onerror = () => reject(new Error('This SVG could not be read - export it again from your design tool.'))
        probe.onload = () => resolve(url)
        probe.src = url
        return
      }
      const img = new Image()
      img.onerror = () => reject(new Error('This image could not be decoded.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      img.src = url
    }
    reader.readAsDataURL(file)
  })
}
