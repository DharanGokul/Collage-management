import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
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

type Rect = { x: number; w: number }

/**
 * Liquid indicator: when the active item changes, the blob first stretches to
 * cover both the old and new item (squashing slightly, like a droplet being
 * pulled), then snaps onto the new item with an elastic settle.
 */
export function useLiquidBlob(container: RefObject<HTMLElement | null>, blob: RefObject<HTMLElement | null>, index: number, measure: (el: HTMLElement) => Rect, selector = '[data-liquid]') {
  const first = useRef(true)
  const last = useRef<Rect | null>(null)

  useLayoutEffect(() => {
    const c = container.current
    const b = blob.current
    if (!c || !b) return
    const els = c.querySelectorAll<HTMLElement>(selector)
    const target = els[index]
    if (!target) {
      gsap.to(b, { autoAlpha: 0, duration: 0.15 })
      last.current = null
      return
    }
    const to = measure(target)
    const from = last.current
    gsap.killTweensOf(b)
    if (first.current || !from || prefersReducedMotion()) {
      gsap.set(b, { x: to.x, width: to.w, autoAlpha: 1, scaleY: 1 })
    } else {
      const left = Math.min(from.x, to.x)
      const right = Math.max(from.x + from.w, to.x + to.w)
      gsap
        .timeline()
        .set(b, { autoAlpha: 1 })
        .to(b, { x: left, width: right - left, scaleY: 0.8, duration: 0.16, ease: 'power2.in' })
        .to(b, { x: to.x, width: to.w, scaleY: 1, duration: 0.55, ease: 'elastic.out(1, 0.55)' })
    }
    first.current = false
    last.current = to
  }, [index, container, blob, measure, selector])

  // Keep the blob glued to its item when the bar resizes (fonts loading, viewport changes).
  useLayoutEffect(() => {
    const c = container.current
    if (!c || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const els = c.querySelectorAll<HTMLElement>(selector)
      const target = els[index]
      if (!target || !blob.current) return
      const r = measure(target)
      last.current = r
      gsap.set(blob.current, { x: r.x, width: r.w })
    })
    ro.observe(c)
    return () => ro.disconnect()
  }, [index, container, blob, measure, selector])
}

const pillRect = (el: HTMLElement): Rect => ({ x: el.offsetLeft, w: el.offsetWidth })

/** Desktop top navigation: pill group with the liquid indicator. */
export function LiquidNav({ items, label }: { items: NavItem[]; label: string }) {
  const ref = useRef<HTMLElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  const index = useActiveIndex(items)
  useLiquidBlob(ref, blob, index, pillRect)
  return (
    <nav className="liquid" ref={ref} aria-label={label}>
      <span className="liquid-blob" ref={blob} aria-hidden />
      {items.map((it, i) => (
        <NavLink
          key={it.to}
          to={it.to}
          end
          data-liquid
          title={it.label}
          className={`liquid-item ${i === index ? 'active' : ''}`}
          onMouseEnter={() => prefetch(it.to)}
          onFocus={() => prefetch(it.to)}
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
