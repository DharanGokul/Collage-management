/**
 * Day / Night / Auto theme.
 *
 *   day   → Marble (light)
 *   night → Noir (dark, Caesar's primary theme)
 *   auto  → Marble from DAY_START to NIGHT_START local time, Noir otherwise;
 *           flips live when the clock crosses either boundary.
 *
 * One module-level store shared by every switch (top bar, mobile sheet, login),
 * read with useSyncExternalStore.
 */

export type ThemeMode = 'day' | 'night' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

export const DAY_START = 6 // 6 AM
export const NIGHT_START = 18 // 6 PM

const KEY = 'cms:theme-mode'

export const isDaytime = (d = new Date()) => d.getHours() >= DAY_START && d.getHours() < NIGHT_START

function readMode(): ThemeMode {
  try {
    const m = localStorage.getItem(KEY)
    if (m === 'day' || m === 'night' || m === 'auto') return m
    // Migrate the earlier two-state preference.
    const old = localStorage.getItem('cms:theme')
    if (old === 'dark') return 'night'
    if (old === 'light') return 'day'
  } catch {
    /* storage blocked */
  }
  return 'auto'
}

const resolve = (m: ThemeMode): ResolvedTheme => (m === 'auto' ? (isDaytime() ? 'light' : 'dark') : m === 'day' ? 'light' : 'dark')

export interface ThemeState {
  mode: ThemeMode
  theme: ResolvedTheme
}

let state: ThemeState = { mode: readMode(), theme: 'dark' }
state = { ...state, theme: resolve(state.mode) }
const listeners = new Set<() => void>()

function apply(t: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = t
  root.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff')
}
if (typeof document !== 'undefined') apply(state.theme)

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }

/**
 * Switch with a circular reveal from `origin` (View Transitions API), or a
 * short colour cross-fade where that API is unavailable.
 */
function transition(next: ResolvedTheme, origin?: { x: number; y: number }) {
  if (next === document.documentElement.dataset.theme) return
  const doc = document as VTDocument
  const root = document.documentElement
  if (reduced()) return apply(next)
  if (doc.startViewTransition && origin) {
    root.classList.add('vt-reveal')
    const vt = doc.startViewTransition(() => apply(next))
    const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
    vt.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        ),
      )
      .catch(() => {})
    vt.finished.finally(() => root.classList.remove('vt-reveal'))
    return
  }
  root.classList.add('theme-fade')
  apply(next)
  setTimeout(() => root.classList.remove('theme-fade'), 450)
}

function emit() {
  listeners.forEach((l) => l())
}

export function setThemeMode(mode: ThemeMode, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    /* ignore */
  }
  const theme = resolve(mode)
  transition(theme, origin)
  state = { mode, theme }
  emit()
  scheduleAuto()
}

export const getThemeState = () => state
export function subscribeTheme(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/* ---- Auto mode: flip at the next day/night boundary ---- */
let timer: ReturnType<typeof setTimeout> | undefined
function msToNextBoundary(now = new Date()) {
  const next = new Date(now)
  const h = now.getHours()
  if (h < DAY_START) next.setHours(DAY_START, 0, 0, 0)
  else if (h < NIGHT_START) next.setHours(NIGHT_START, 0, 0, 0)
  else {
    next.setDate(next.getDate() + 1)
    next.setHours(DAY_START, 0, 0, 0)
  }
  return next.getTime() - now.getTime() + 500
}
function recheck() {
  if (state.mode !== 'auto') return
  const theme = resolve('auto')
  if (theme !== state.theme) {
    transition(theme)
    state = { ...state, theme }
    emit()
  }
  scheduleAuto()
}
function scheduleAuto() {
  clearTimeout(timer)
  if (state.mode === 'auto' && typeof window !== 'undefined') timer = setTimeout(recheck, Math.min(msToNextBoundary(), 2 ** 31 - 1))
}
if (typeof document !== 'undefined') {
  scheduleAuto()
  // Timers are paused in background tabs/sleep: re-check when the tab is visible again.
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && recheck())
}

/** Human description for tooltips: "Auto · Day until 6 PM" */
export function autoHint(now = new Date()) {
  const fmt = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })
  return isDaytime(now) ? `Day until ${fmt(NIGHT_START)}` : `Night until ${fmt(DAY_START)}`
}
