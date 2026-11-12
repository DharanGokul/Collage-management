import { useCallback, useRef, useSyncExternalStore, type MouseEvent } from 'react'
import { Sun, Moon, SunMoon } from 'lucide-react'
import { useLiquidBlob } from './LiquidNav'
import { autoHint, getThemeState, setThemeMode, subscribeTheme, type ThemeMode } from '../lib/themeMode'

export function useThemeMode() {
  return useSyncExternalStore(subscribeTheme, getThemeState, getThemeState)
}

const OPTIONS: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: 'day', label: 'Day', Icon: Sun },
  { id: 'night', label: 'Night', Icon: Moon },
  { id: 'auto', label: 'Auto', Icon: SunMoon },
]

/**
 * Day / Night / Auto switch with the same liquid indicator as the navigation.
 * `compact` shows icons only (top bar, login); otherwise icons + labels.
 */
export default function ThemeSwitch({ compact = true, className = '' }: { compact?: boolean; className?: string }) {
  const { mode, theme } = useThemeMode()
  const ref = useRef<HTMLDivElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  const measure = useCallback((el: HTMLElement) => ({ x: el.offsetLeft, w: el.offsetWidth }), [])
  useLiquidBlob(ref, blob, OPTIONS.findIndex((o) => o.id === mode), measure)

  const pick = (m: ThemeMode, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setThemeMode(m, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
  }

  return (
    <div ref={ref} className={`theme-switch ${compact ? 'compact' : ''} ${className}`} role="radiogroup" aria-label="Theme">
      <span ref={blob} className="theme-blob" aria-hidden />
      {OPTIONS.map(({ id, label, Icon }) => {
        const title = id === 'auto' ? `Auto · ${autoHint()}` : id === 'day' ? 'Day · Marble (light)' : 'Night · Noir (dark)'
        return (
          <button
            key={id}
            data-liquid
            type="button"
            role="radio"
            aria-checked={mode === id}
            aria-label={`${label} theme`}
            title={title}
            className={`theme-opt ${mode === id ? 'active' : ''}`}
            onClick={(e) => pick(id, e)}
          >
            <Icon size={16} />
            {!compact && <span>{label}</span>}
          </button>
        )
      })}
      {!compact && <span className="sr-only" aria-live="polite">{mode === 'auto' ? `Auto, currently ${theme === 'light' ? 'day' : 'night'}` : ''}</span>}
    </div>
  )
}
