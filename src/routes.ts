import { createElement, lazy, type ComponentType } from 'react'

/**
 * Route-level code splitting. Each page is its own chunk; `prefetch()` warms a
 * chunk on nav hover/focus and the shell prefetches the whole role's pages when
 * the browser is idle, so page switches never wait on the network.
 */
const loaders = {
  '/admin': () => import('./pages/admin/Dashboard'),
  '/admin/calendar': () => import('./pages/shared/CalendarPage'),
  '/admin/events': () => import('./pages/admin/Events'),
  '/admin/students': () => import('./pages/admin/Students'),
  '/admin/staff': () => import('./pages/admin/Staff'),
  '/admin/subjects': () => import('./pages/admin/Subjects'),
  '/admin/fees': () => import('./pages/admin/Fees'),
  '/admin/attendance': () => import('./pages/admin/Attendance'),
  '/admin/timetable': () => import('./pages/admin/Timetable'),
  '/admin/queries': () => import('./pages/shared/HelpDesk'),
  '/admin/email': () => import('./pages/admin/EmailCenter'),
  '/admin/settings': () => import('./pages/admin/Settings'),
  '/staff': () => import('./pages/staff/Dashboard'),
  '/staff/calendar': () => import('./pages/shared/CalendarPage'),
  '/staff/attendance': () => import('./pages/staff/MarkAttendance'),
  '/staff/timetable': () => import('./pages/staff/Timetable'),
  '/staff/students': () => import('./pages/staff/Students'),
  '/staff/events': () => import('./pages/shared/EventsBoard'),
  '/staff/queries': () => import('./pages/shared/HelpDesk'),
  '/student': () => import('./pages/student/Dashboard'),
  '/student/calendar': () => import('./pages/shared/CalendarPage'),
  '/student/fees': () => import('./pages/student/Fees'),
  '/student/attendance': () => import('./pages/student/Attendance'),
  '/student/timetable': () => import('./pages/student/Timetable'),
  '/student/events': () => import('./pages/shared/EventsBoard'),
  '/student/queries': () => import('./pages/shared/HelpDesk'),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>

export type RoutePath = keyof typeof loaders

/**
 * Modules that have finished loading render directly. A React.lazy component
 * suspends on its first render even if its chunk is already cached, and React
 * throttles revealing Suspense content (~300ms), so prefetched pages bypass lazy.
 */
const loaded = new Map<string, ComponentType>()
const cache = new Map<string, ComponentType>()
export function page(path: RoutePath) {
  let c = cache.get(path)
  if (!c) {
    const Lazy = lazy(() =>
      loaders[path]().then((m) => {
        loaded.set(path, m.default)
        return m
      }),
    )
    const Page = () => {
      const M = loaded.get(path)
      return M ? createElement(M) : createElement(Lazy)
    }
    Page.displayName = `Page(${path})`
    cache.set(path, Page)
    c = Page
  }
  return c
}

const warmed = new Set<string>()
export function prefetch(path: string) {
  const key = path.split('?')[0] as RoutePath
  if (warmed.has(key) || !(key in loaders)) return
  warmed.add(key)
  loaders[key]()
    .then((m) => loaded.set(key, m.default))
    .catch(() => warmed.delete(key))
}

export function prefetchRole(role: string) {
  const run = () => (Object.keys(loaders) as RoutePath[]).filter((p) => p.startsWith('/' + role)).forEach(prefetch)
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback
  if (ric) ric(run, { timeout: 1500 })
  else setTimeout(run, 400)
}
