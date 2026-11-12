/** Colour maths for the brand picker and the derived secondary colour. */

export type Harmony = 'analogous' | 'complementary' | 'split' | 'triadic' | 'mono' | 'custom'

export const HARMONIES: { id: Exclude<Harmony, 'custom'>; label: string; hint: string }[] = [
  { id: 'analogous', label: 'Analogous', hint: 'Neighbour on the colour wheel — calm, cohesive' },
  { id: 'complementary', label: 'Complementary', hint: 'Opposite hue — high contrast' },
  { id: 'split', label: 'Split', hint: 'Beside the opposite — vivid but balanced' },
  { id: 'triadic', label: 'Triadic', hint: 'A third of the wheel away — playful' },
  { id: 'mono', label: 'Monochrome', hint: 'Same hue, softer — understated' },
]

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = parseInt(m ? m[1] : '6d001a', 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

/** h 0–360, s/v 0–1 */
export function hexToHsv(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}
export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

export function hexToHsl(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  const { h } = hexToHsv(hex)
  return { h, s: clamp(s), l }
}
export function hslToHex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

/**
 * Secondary from the primary by colour-wheel harmony. Saturation and lightness
 * are kept in a usable band so the secondary works as a fill with white text
 * and as a tint, whatever primary a college picks.
 */
export function deriveSecondary(primary: string, harmony: Exclude<Harmony, 'custom'>) {
  const { h, s, l } = hexToHsl(primary)
  const sat = clamp(Math.max(s, 0.35), 0.35, 0.85)
  const light = clamp(l < 0.25 ? 0.36 : l, 0.3, 0.45)
  switch (harmony) {
    case 'analogous': return hslToHex(h + 32, sat, light)
    case 'complementary': return hslToHex(h + 180, sat * 0.85, light)
    case 'split': return hslToHex(h + 150, sat * 0.9, light)
    case 'triadic': return hslToHex(h + 120, sat * 0.85, light)
    case 'mono': return hslToHex(h, sat * 0.55, clamp(light + 0.12, 0.38, 0.55))
  }
}

export function resolveSecondary(primary: string, harmony: Harmony | undefined, custom: string | null | undefined) {
  if (harmony === 'custom' && custom && /^#[0-9a-f]{6}$/i.test(custom)) return custom.toLowerCase()
  return deriveSecondary(primary, harmony && harmony !== 'custom' ? harmony : 'analogous')
}

/** Very light wash of a colour (for the Day-mode page background). */
export function tint(hex: string, amount: number) {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}
