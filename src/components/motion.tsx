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

export { gsap }
