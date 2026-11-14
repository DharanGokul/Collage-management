import { useMemo, useSyncExternalStore } from 'react'
import { toISODate } from './utils'

/**
 * The current time for use while rendering.
 *
 * Calling `Date.now()` / `new Date()` directly in a component makes its output depend on when React happens to
 * run it, which breaks memoisation and makes tests flaky. This hook reads the clock once for everyone through a
 * single shared timer (30 s) so "today" also rolls over at midnight without a reload.
 *
 * Use `new Date(now)` when you need a Date. Event handlers may still call `Date.now()` directly.
 */
let snapshot = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(cb: () => void) {
  if (listeners.size === 0) {
    snapshot = Date.now() // refresh after an idle period before the first subscriber reads it
    timer = setInterval(() => {
      snapshot = Date.now()
      listeners.forEach((l) => l())
    }, 30_000)
  }
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot)
}

/** Local calendar date as `YYYY-MM-DD`. Changes at midnight. */
export function useToday(): string {
  const now = useNow()
  return useMemo(() => toISODate(new Date(now)), [now])
}
