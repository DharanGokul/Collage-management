import { useCallback, useLayoutEffect, useRef, useState, type FocusEvent, type ReactNode, type RefObject } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { gsap, prefersReducedMotion } from './motion'
import { prefetch } from '../routes'

export interface NavItem {
  to: string
  label: string
  icon?: ReactNode
  badge?: number
}

/** Index of the item whose path is the longest prefix of the current location. */
export function useActiveIndex(items: { to: string }[]) {
  const { pathname } = useLocation()
  let best = -1
  let len = -1
  items.forEach((it, i) => {
    const t = it.to.split('?')[0]
    if ((pathname === t || pathname.startsWith(t + '/')) && t.length > len) {
      best = i
      len = t.length
    }
  })
  return best
}

export type Rect = { x: number; w: number }
type Axis = 'x' | 'y'

/**
 * Liquid indicator: when the target item changes (selection OR hover), the blob
 * first stretches to cover both the old and new item — squashing slightly, like
 * a droplet being pulled — then snaps onto the new item with an elastic settle.
 * `axis: 'y'` does the same vertically (tool rail).
 */
export function useLiquidBlob(
  container: RefObject<HTMLElement | null>,
  blob: RefObject<HTMLElement | null>,
  index: number,
  measure: (el: HTMLElement) => Rect,
  selector = '[data-liquid]',
  axis: Axis = 'x',
) {
  const first = useRef(true)
  const last = useRef<Rect | null>(null)
  const pos = axis === 'x' ? 'x' : 'y'
  const size = axis === 'x' ? 'width' : 'height'
  const squash = axis === 'x' ? 'scaleY' : 'scaleX'

  useLayoutEffect(() => {
    const c = container.current
    const b = blob.current
    if (!c || !b) return
    const target = c.querySelectorAll<HTMLElement>(selector)[index]
    gsap.killTweensOf(b)
    if (!target) {
      gsap.to(b, { autoAlpha: 0, duration: 0.15 })
      last.current = null
      return
    }
    const to = measure(target)
    const from = last.current
    if (first.current || !from || prefersReducedMotion()) {
      gsap.set(b, { [pos]: to.x, [size]: to.w, autoAlpha: 1, [squash]: 1 })
    } else {
      const lo = Math.min(from.x, to.x)
      const hi = Math.max(from.x + from.w, to.x + to.w)
      gsap
        .timeline()
        .set(b, { autoAlpha: 1 })
        .to(b, { [pos]: lo, [size]: hi - lo, [squash]: 0.82, duration: 0.14, ease: 'power2.in' })
        .to(b, { [pos]: to.x, [size]: to.w, [squash]: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)' })
    }
    first.current = false
    last.current = to
  }, [index, container, blob, measure, selector, pos, size, squash])

  // Keep the blob glued to its item when the bar resizes (fonts loading, viewport changes).
  useLayoutEffect(() => {
    const c = container.current
    if (!c || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const target = c.querySelectorAll<HTMLElement>(selector)[index]
      if (!target || !blob.current) return
      const r = measure(target)
      last.current = r
      gsap.set(blob.current, { [pos]: r.x, [size]: r.w })
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [index, container, blob, measure, selector, pos, size])
}

/**
 * Selection + hover for a liquid group. The blob follows the pointer/focus
 * while it is inside the group and glides back to the selected item on leave.
 * `lit` is the item currently under the blob (style its text for contrast).
 */
export function useLiquidHover(active: number) {
  const [hover, setHover] = useState<number | null>(null)
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches
  const lit = hover ?? active
  const item = useCallback(
    (i: number) => ({
      onMouseEnter: canHover ? () => setHover(i) : undefined,
      onFocus: () => setHover(i),
    }),
    [canHover],
  )
  const group = { onMouseLeave: () => setHover(null), onBlur: (e: FocusEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setHover(null) }
  return { lit, item, group }
}

export const pillRect = (el: HTMLElement): Rect => ({ x: el.offsetLeft, w: el.offsetWidth })
export const railRect = (el: HTMLElement): Rect => ({ x: el.offsetTop, w: el.offsetHeight })

/** Desktop top navigation: pill group with the liquid indicator (follows hover). */
export function LiquidNav({ items, label }: { items: NavItem[]; label: string }) {
  const ref = useRef<HTMLElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  const index = useActiveIndex(items)
  const { lit, item, group } = useLiquidHover(index)
  useLiquidBlob(ref, blob, lit, pillRect)
  return (
    <nav className="liquid" ref={ref} aria-label={label} {...group}>
      <span className="liquid-blob" ref={blob} aria-hidden />
      {items.map((it, i) => (
        <NavLink
          key={it.to}
          to={it.to}
          end
          data-liquid
          title={it.label}
          className={`liquid-item ${i === index ? 'active' : ''} ${i === lit ? 'lit' : ''}`}
          {...item(i)}
          onMouseEnter={() => {
            item(i).onMouseEnter?.()
            prefetch(it.to)
          }}
          onFocus={() => {
            item(i).onFocus()
            prefetch(it.to)
          }}
          aria-current={i === index ? 'page' : undefined}
        >
          {it.icon}
          <span>{it.label}</span>
          {!!it.badge && <span className="nav-badge" aria-label={`${it.badge} new`}>{it.badge}</span>}
        </NavLink>
      ))}
    </nav>
  )
}
