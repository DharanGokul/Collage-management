import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'
import { AppStoreProvider, useStore } from './store/AppStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import { previewUrl } from './lib/tenant'
import { page, type RoutePath } from './routes'
import type { Role } from './types'

// Platform console is only for the platform team — keep it out of the college bundle.
const SuperLogin = lazy(() => import('./pages/super/SuperAdmin').then((m) => ({ default: m.SuperLogin })))
const SuperConsole = lazy(() => import('./pages/super/SuperAdmin').then((m) => ({ default: m.SuperConsole })))

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { session, suspended } = useStore()
  if (!session || suspended) return <Navigate to="/login" replace />
  if (session.role !== role) return <Navigate to={`/${session.role}`} replace />
  return <>{children}</>
}

/** The URL names a college that has not been onboarded by the platform. */
function TenantGate({ children }: { children: ReactNode }) {
  const { tenant } = useStore()
  if (!tenant.missing) return <>{children}</>
  return (
    <div className="not-found">
      <div className="login-card">
        <h2>College not found</h2>
        <p className="muted">
          There is no portal at <code>{tenant.slug}</code>. Check the address or contact your college office.
        </p>
        <a className="btn btn-primary btn-md" href={previewUrl('')}>Go to the main portal</a>
      </div>
    </div>
  )
}

function Home() {
  const { session } = useStore()
  return <Navigate to={session ? `/${session.role}` : '/login'} replace />
}

const CHILDREN: Record<Role, string[]> = {
  admin: ['calendar', 'events', 'students', 'staff', 'subjects', 'fees', 'attendance', 'timetable', 'queries', 'email', 'settings'],
  staff: ['calendar', 'attendance', 'timetable', 'students', 'events', 'queries'],
  student: ['calendar', 'fees', 'attendance', 'timetable', 'events', 'queries'],
}

function roleRoutes(role: Role) {
  const Index = page(`/${role}` as RoutePath)
  return (
    <Route key={role} path={`/${role}`} element={<TenantGate><Guard role={role}><Layout /></Guard></TenantGate>}>
      <Route index element={<Index />} />
      {CHILDREN[role].map((c) => {
        const P = page(`/${role}/${c}` as RoutePath)
        return <Route key={c} path={c} element={<P />} />
      })}
    </Route>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/super/login" element={<SuperLogin />} />
            <Route path="/super" element={<SuperConsole />} />
            <Route path="/login" element={<TenantGate><Login /></TenantGate>} />
            {(['admin', 'staff', 'student'] as Role[]).map(roleRoutes)}
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </AppStoreProvider>
  )
}
