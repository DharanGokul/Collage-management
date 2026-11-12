import type { Branding } from '../types'

export const HEX_RE = /^#([0-9a-f]{6})$/i

function hexToRgb(hex: string): [number, number, number] {
  const m = HEX_RE.exec(hex) ?? HEX_RE.exec('#4f46e5')!
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
export const contrastText = (hex: string) => (contrastRatio(hex, '#ffffff') >= 3 ? '#ffffff' : '#111827')

/** Sets every brand-derived CSS variable from one hex colour. */
export function applyPalette(hex: string) {
  const root = document.documentElement
  const primary = HEX_RE.test(hex) ? hex : '#4f46e5'
  const [r, g, bl] = hexToRgb(primary)
  root.style.setProperty('--primary', primary)
  root.style.setProperty('--primary-rgb', `${r} ${g} ${bl}`)
  root.style.setProperty('--primary-hover', mix(primary, [0, 0, 0], 0.15))
  root.style.setProperty('--primary-strong', mix(primary, [0, 0, 0], 0.35))
  root.style.setProperty('--primary-contrast', contrastText(primary))
  return primary
}

export function applyTheme(b: Branding) {
  const primary = applyPalette(b.primaryColor)

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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="44" font-family="Inter,Arial,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${contrastText(color)}">${letter}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

export const PRESET_COLORS = ['#4f46e5', '#2563eb', '#0891b2', '#059669', '#65a30d', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#0f172a']

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
      if (file.type === 'image/svg+xml') return resolve(url)
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
