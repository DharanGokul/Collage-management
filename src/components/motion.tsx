import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import gsap from 'gsap'

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Page entry: the page's top-level blocks (and the cells of top-level grids)
 * rise and fade in with a short stagger. Kept to ~0.3s total so navigation
 * feels instant; transforms only, so it never triggers layout.
 */
export function PageEnter({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollEffects(ref, routeKey)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    const blocks = [...el.children].flatMap((c) => (c.classList.contains('grid') || c.classList.contains('stats-grid') ? [...c.children] : [c])).slice(0, 14)
    const tween = gsap.fromTo(
      blocks,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power3.out', stagger: 0.03, clearProps: 'opacity,visibility,transform' },
    )
    return () => {
      tween.kill()
      gsap.set(blocks, { clearProps: 'opacity,visibility,transform' })
    }
  }, [routeKey])
  return (
    <div ref={ref} className="content" key={routeKey}>
      {children}
    </div>
  )
}

/** Slide-up + fade for sheets/popovers when they mount. */
export function useEnter<T extends HTMLElement>(ref: RefObject<T | null>, from: gsap.TweenVars = { y: 24, autoAlpha: 0 }, duration = 0.28) {
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const t = gsap.from(ref.current, { ...from, duration, ease: 'power3.out', clearProps: 'transform,opacity,visibility' })
    return () => {
      t.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ------------------------------------------------------------------ */
/* Scroll effects: reveal-on-scroll + count-up numbers                 */
/* ------------------------------------------------------------------ */

const REVEAL =
  '.card, .event-card, .stat, .week-day, .coming-item, .need, .ev-card, .agenda-item, .tk, .fee-list > li, .feed > li, .pulse-row, .class-card, .slot, .roster > li, .schedule > li, .table tbody tr, .bubble, .req-card, .chat-item'
const COUNT = '.stat-value, .kpi-value, .cal-kpis strong, .tri strong, .stat-plain strong, .class-card strong'

const inView = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight && r.bottom > 0
}

/**
 * Elements below the fold start hidden and rise in (staggered, in batches)
 * as they scroll into view; KPI numbers count up the first time they appear.
 * New elements added later (tabs, pagination, live updates) are picked up too.
 * Transform/opacity only — no layout work during scroll.
 */
export function useScrollEffects(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    const pending: Element[] = []
    let raf = 0
    const flush = () => {
      raf = 0
      const batch = pending.splice(0).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      if (batch.length) gsap.to(batch, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.05, clearProps: 'opacity,transform' })
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          io.unobserve(e.target)
          if (e.target.matches(COUNT)) countUp(e.target as HTMLElement)
          else pending.push(e.target)
        }
        if (pending.length && !raf) raf = requestAnimationFrame(flush)
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
    const seen = new WeakSet<Element>()
    const scan = (scope: ParentNode) => {
      let rows = 0
      scope.querySelectorAll(REVEAL).forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        if (el.matches('tr') && ++rows > 60) return
        if (inView(el)) return // visible now: handled by the page-entry animation
        // Opacity only (not visibility): hidden-until-scrolled items stay focusable and in the a11y tree.
        gsap.set(el, { opacity: 0, y: 26 })
        io.observe(el)
      })
      scope.querySelectorAll(COUNT).forEach((el) => {
        if (seen.has(el)) return
        seen.add(el)
        io.observe(el)
      })
    }
    // Wait one frame so the page-entry animation has set its starting state.
    const t = requestAnimationFrame(() => scan(root))
    const mo = new MutationObserver((muts) => {
      for (const m of muts) m.addedNodes.forEach((n) => n instanceof HTMLElement && scan(n.parentElement ?? n))
    })
    mo.observe(root, { childList: true, subtree: true })
    // Keyboard users tabbing ahead of the scroll: reveal the item they land on immediately.
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element).closest?.(REVEAL)
      if (el && getComputedStyle(el).opacity === '0') {
        io.unobserve(el)
        gsap.to(el, { opacity: 1, y: 0, duration: 0.2, clearProps: 'opacity,transform' })
      }
    }
    root.addEventListener('focusin', onFocus)
    return () => {
      root.removeEventListener('focusin', onFocus)
      cancelAnimationFrame(t)
      cancelAnimationFrame(raf)
      io.disconnect()
      mo.disconnect()
    }
  }, [ref, key])
}

/** Count a number-ish label up from 0, keeping prefix/suffix and grouping (₹25,35,000 · 84.0% · 48). */
function countUp(el: HTMLElement) {
  const text = el.firstChild?.nodeType === 3 ? (el.firstChild as Text) : null
  const original = text?.data ?? ''
  const m = original.match(/^([^\d-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/)
  if (!text || !m) return
  const target = Number(m[2].replace(/,/g, ''))
  if (!isFinite(target) || target === 0) return
  const decimals = (m[2].split('.')[1] ?? '').length
  const indian = /\d,\d\d,\d{3}/.test(m[2]) || /^\d{1,2},\d{3}$/.test(m[2])
  const fmt = (v: number) => m[1] + (m[2].includes(',') ? v.toLocaleString(indian ? 'en-IN' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals)) + m[3]
  const state = { v: 0 }
  let last = fmt(0)
  text.data = last
  gsap.to(state, {
    v: target,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => {
      // If React re-rendered this node meanwhile, stop and keep React's value.
      if (text.data !== last) return gsap.killTweensOf(state)
      last = fmt(state.v)
      text.data = last
    },
    onComplete: () => {
      if (text.data === last) text.data = original
    },
  })
}

export { gsap }
