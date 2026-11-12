import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Wallet,
  CalendarCheck,
  CalendarDays,
  Mail,
  Settings,
  LogOut,
  Menu,
  Moon,
  Sun,
  BookOpen,
  ClipboardCheck,
  Receipt,
  AlertTriangle,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Logo, Toasts } from './ui'
import type { Role } from '../types'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/admin/students', label: 'Students', icon: <GraduationCap size={18} /> },
    { to: '/admin/staff', label: 'Staff', icon: <Users size={18} /> },
    { to: '/admin/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
    { to: '/admin/fees', label: 'Fees & Payments', icon: <Wallet size={18} /> },
    { to: '/admin/attendance', label: 'Attendance', icon: <CalendarCheck size={18} /> },
    { to: '/admin/timetable', label: 'Timetable', icon: <CalendarDays size={18} /> },
    { to: '/admin/email', label: 'Email Center', icon: <Mail size={18} /> },
    { to: '/admin/settings', label: 'Settings & Branding', icon: <Settings size={18} /> },
  ],
  staff: [
    { to: '/staff', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/staff/attendance', label: 'Mark Attendance', icon: <ClipboardCheck size={18} /> },
    { to: '/staff/timetable', label: 'My Timetable', icon: <CalendarDays size={18} /> },
    { to: '/staff/students', label: 'My Students', icon: <GraduationCap size={18} /> },
  ],
  student: [
    { to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/student/fees', label: 'Fee Payment', icon: <Receipt size={18} /> },
    { to: '/student/attendance', label: 'My Attendance', icon: <CalendarCheck size={18} /> },
    { to: '/student/timetable', label: 'Timetable', icon: <CalendarDays size={18} /> },
  ],
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', staff: 'Faculty', student: 'Student' }

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    try {
      const v = localStorage.getItem('cms:theme')
      if (v) return v === 'dark'
    } catch {
      /* ignore */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try {
      localStorage.setItem('cms:theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
  }, [dark])
  return [dark, setDark] as const
}

export function ThemeToggle() {
  const [dark, setDark] = useDarkMode()
  return (
    <button className="icon-btn" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle theme">
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

export default function Layout() {
  const { db, session, logout, storageError } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setOpen(false), [loc.pathname])
  if (!session) return null
  const items = NAV[session.role]
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((i) => loc.pathname.startsWith(i.to))

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={34} />
          <div className="brand-text">
            <strong>{db.branding.shortName || db.branding.collegeName}</strong>
            <small>{ROLE_LABEL[session.role]} portal</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.to.split('/').length === 2} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {i.icon}
              <span>{i.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            className="nav-item"
            onClick={() => {
              logout()
              nav('/login')
            }}
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-title">{current?.label}</div>
          <div className="topbar-right">
            <ThemeToggle />
            <div className="user-chip">
              <Avatar name={session.name} size={32} />
              <div className="user-meta">
                <strong>{session.name}</strong>
                <small>{ROLE_LABEL[session.role]}</small>
              </div>
            </div>
          </div>
        </header>
        {storageError && (
          <div className="banner banner-warn">
            <AlertTriangle size={16} /> {storageError}
          </div>
        )}
        <main className="content">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  )
}
