import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AppStoreProvider, useStore } from './store/AppStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import AdminDashboard from './pages/admin/Dashboard'
import Students from './pages/admin/Students'
import StaffPage from './pages/admin/Staff'
import Subjects from './pages/admin/Subjects'
import AdminFees from './pages/admin/Fees'
import AdminAttendance from './pages/admin/Attendance'
import AdminTimetable from './pages/admin/Timetable'
import EmailCenter from './pages/admin/EmailCenter'
import SettingsPage from './pages/admin/Settings'
import StaffDashboard from './pages/staff/Dashboard'
import MarkAttendance from './pages/staff/MarkAttendance'
import StaffTimetable from './pages/staff/Timetable'
import StaffStudents from './pages/staff/Students'
import StudentDashboard from './pages/student/Dashboard'
import StudentFees from './pages/student/Fees'
import StudentAttendance from './pages/student/Attendance'
import StudentTimetable from './pages/student/Timetable'
import { SuperConsole, SuperLogin } from './pages/super/SuperAdmin'
import { previewUrl } from './lib/tenant'
import type { Role } from './types'

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

export default function App() {
  return (
    <AppStoreProvider>
      <HashRouter>
        <Routes>
          <Route path="/super/login" element={<SuperLogin />} />
          <Route path="/super" element={<SuperConsole />} />
          <Route path="/login" element={<TenantGate><Login /></TenantGate>} />
          <Route path="/admin" element={<TenantGate><Guard role="admin"><Layout /></Guard></TenantGate>}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="subjects" element={<Subjects />} />
            <Route path="fees" element={<AdminFees />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="timetable" element={<AdminTimetable />} />
            <Route path="email" element={<EmailCenter />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/staff" element={<TenantGate><Guard role="staff"><Layout /></Guard></TenantGate>}>
            <Route index element={<StaffDashboard />} />
            <Route path="attendance" element={<MarkAttendance />} />
            <Route path="timetable" element={<StaffTimetable />} />
            <Route path="students" element={<StaffStudents />} />
          </Route>
          <Route path="/student" element={<TenantGate><Guard role="student"><Layout /></Guard></TenantGate>}>
            <Route index element={<StudentDashboard />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="timetable" element={<StudentTimetable />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </HashRouter>
    </AppStoreProvider>
  )
}
