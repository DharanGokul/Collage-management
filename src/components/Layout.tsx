import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, Wallet, CalendarCheck, CalendarDays, Mail, Settings, LogOut, BookOpen,
  ClipboardCheck, Receipt, AlertTriangle, Plus, Search, Bell, MessageSquareText, PartyPopper, Grid2x2, CalendarRange, Megaphone,
  FilePlus2, UserPlus, X, ChevronRight, Home, UserRound, MessagesSquare, BarChart3, Building2, Wrench, FileText, Landmark, Percent,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Logo, overlayOpen } from './ui'
import { LiquidNav, railRect, useActiveIndex, useLiquidBlob, useLiquidHover, type NavItem } from './LiquidNav'
import { PageEnter, useEnter } from './motion'
import ThemeSwitch, { ThemeSwitchWithDefault } from './ThemeSwitch'
import Toaster from './Toaster'
import { prefetch, prefetchRole } from '../routes'
import type { Database, Role, Session } from '../types'
import { agenda, countdown, fmtTime } from '../lib/agenda'
import { useNow } from '../lib/useNow'
import { hodDepartment, isHod, photoOf, unreadCount } from '../lib/workflow'

/* ------------------------------------------------------------------ */
/* Navigation model                                                   */
/* ------------------------------------------------------------------ */

interface CreateAction { to: string; label: string; hint: string; icon: ReactNode }

function navFor(role: Role, db: Database, s: Session) {
  const me = `${s.role}:${s.userId}`
  const chatUnread = db.chats.filter((c) => c.members.some((m) => `${m.role}:${m.userId}` === me)).reduce((a, c) => a + unreadCount(c, s), 0)
  const openForAdmin = db.tickets.filter((t) => t.unreadByAdmin).length
  const unreadForMe = db.tickets.filter((t) => t.from.userId === s.userId && t.unreadByRequester).length
  const profile = { to: `/${role}/profile`, label: 'My profile', icon: <UserRound size={18} /> }
  if (role === 'admin') {
    const approvals = db.requests.filter((r) => r.status === 'pending_admin').length + db.leaves.filter((l) => l.status === 'pending' && l.approver === 'admin').length + db.bills.filter((b) => b.status === 'pending').length
    return {
      primary: [
        { to: '/admin', label: 'Overview', icon: <LayoutDashboard size={16} /> },
        { to: '/admin/calendar', label: 'Calendar', icon: <CalendarRange size={16} /> },
        { to: '/admin/events', label: 'Events', icon: <PartyPopper size={16} /> },
        { to: '/admin/students', label: 'Students', icon: <GraduationCap size={16} /> },
        { to: '/admin/staff', label: 'Staff', icon: <Users size={16} /> },
        { to: '/admin/fees', label: 'Fees', icon: <Wallet size={16} /> },
        { to: '/admin/attendance', label: 'Attendance', icon: <CalendarCheck size={16} /> },
        { to: '/admin/approvals', label: 'Approvals', icon: <ClipboardCheck size={16} />, badge: approvals },
        { to: '/admin/queries', label: 'Help desk', icon: <MessageSquareText size={16} />, badge: openForAdmin },
        { to: '/admin/chat', label: 'Chat', icon: <MessagesSquare size={16} />, badge: chatUnread },
      ] as NavItem[],
      secondary: [
        { to: '/admin/timetable', label: 'Timetable', icon: <CalendarDays size={18} /> },
        { to: '/admin/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
        { to: '/admin/finance', label: 'Finance reports', icon: <BarChart3 size={18} /> },
        { to: '/admin/email', label: 'Email Center', icon: <Mail size={18} /> },
        { to: '/admin/settings', label: 'Settings & Branding', icon: <Settings size={18} /> },
        profile,
      ] as NavItem[],
      create: [
        { to: '/admin/events?new=event', label: 'New event', hint: 'Fest, workshop, meeting or holiday', icon: <PartyPopper size={18} /> },
        { to: '/admin/events?new=exam', label: 'Schedule exam', hint: 'Shows on each class calendar', icon: <FilePlus2 size={18} /> },
        { to: '/admin/students?new=1', label: 'Add student', hint: 'Enrol a new student', icon: <UserPlus size={18} /> },
        { to: '/admin/chat?new=group', label: 'New group chat', hint: 'Staff, HODs, a class or anyone', icon: <MessagesSquare size={18} /> },
        { to: '/admin?announce=1', label: 'Announcement', hint: 'Post to students, staff or both', icon: <Megaphone size={18} /> },
        { to: '/admin/email', label: 'Send email', hint: 'Compose to any audience', icon: <Mail size={18} /> },
      ] as CreateAction[],
      inbox: { to: '/admin/queries', label: 'Inbox', badge: openForAdmin, icon: 'inbox' as const },
    }
  }
  if (role === 'staff') {
    const hodDept = hodDepartment(db, s.userId)
    const approvals = hodDept
      ? db.requests.filter((r) => r.status === 'pending_hod' && r.department === hodDept.code).length +
        db.leaves.filter((l) => l.status === 'pending' && l.approver === 'hod' && db.staff.find((x) => x.id === l.staffId)?.department === hodDept.code).length +
        db.profileChanges.filter((p) => p.status === 'pending' && db.students.find((x) => x.id === p.studentId)?.department === hodDept.code).length
      : 0
    return {
      primary: [
        { to: '/staff', label: 'Overview', icon: <LayoutDashboard size={16} /> },
        { to: '/staff/calendar', label: 'Calendar', icon: <CalendarRange size={16} /> },
        { to: '/staff/attendance', label: 'Attendance', icon: <ClipboardCheck size={16} /> },
        { to: '/staff/timetable', label: 'Timetable', icon: <CalendarDays size={16} /> },
        { to: '/staff/students', label: 'My students', icon: <GraduationCap size={16} /> },
        ...(hodDept ? [{ to: '/staff/department', label: 'Department', icon: <Building2 size={16} /> }, { to: '/staff/approvals', label: 'Approvals', icon: <ClipboardCheck size={16} />, badge: approvals }] : []),
        { to: '/staff/requests', label: 'Requests', icon: <Wrench size={16} /> },
        { to: '/staff/chat', label: 'Chat', icon: <MessagesSquare size={16} />, badge: chatUnread },
      ] as NavItem[],
      secondary: [
        { to: '/staff/events', label: 'Events', icon: <PartyPopper size={18} /> },
        { to: '/staff/queries', label: 'Help desk', icon: <MessageSquareText size={18} />, badge: unreadForMe },
        profile,
      ] as NavItem[],
      create: [
        { to: '/staff/attendance', label: 'Mark attendance', hint: 'For a class you teach today', icon: <ClipboardCheck size={18} /> },
        { to: '/staff/requests?new=purchase', label: 'Equipment request', hint: 'Computer, projector, furniture… (HOD approves)', icon: <Wrench size={18} /> },
        { to: '/staff/requests?new=leave', label: 'Apply for leave', hint: hodDept ? 'Goes to management' : 'Goes to your HOD', icon: <CalendarRange size={18} /> },
        { to: '/staff/chat?new=direct', label: 'New message', hint: 'Students, staff or management', icon: <MessagesSquare size={18} /> },
        { to: '/staff/queries?new=query', label: 'Raise a query', hint: 'Ask the administration', icon: <MessageSquareText size={18} /> },
      ] as CreateAction[],
      inbox: { to: '/staff/chat', label: 'Chat', badge: chatUnread, icon: 'chat' as const },
    }
  }
  if (role === 'accountant') {
    const pendingBills = db.bills.filter((b) => b.status === 'approved').length
    return {
      primary: [
        { to: '/accountant', label: 'Overview', icon: <LayoutDashboard size={16} /> },
        { to: '/accountant/fees', label: 'Fees', icon: <Wallet size={16} /> },
        { to: '/accountant/invoices', label: 'Invoices', icon: <FileText size={16} /> },
        { to: '/accountant/bills', label: 'Bills', icon: <Receipt size={16} />, badge: pendingBills },
        { to: '/accountant/bank', label: 'Bank', icon: <Landmark size={16} /> },
        { to: '/accountant/taxes', label: 'Taxes', icon: <Percent size={16} /> },
        { to: '/accountant/reports', label: 'Reports', icon: <BarChart3 size={16} /> },
        { to: '/accountant/chat', label: 'Chat', icon: <MessagesSquare size={16} />, badge: chatUnread },
      ] as NavItem[],
      secondary: [{ to: '/accountant/calendar', label: 'Calendar', icon: <CalendarRange size={18} /> }, profile] as NavItem[],
      create: [
        { to: '/accountant/bills?new=1', label: 'Record a bill', hint: 'Vendor bill with GST & TDS', icon: <Receipt size={18} /> },
        { to: '/accountant/invoices?new=1', label: 'New invoice', hint: 'Other income (GST invoice)', icon: <FileText size={18} /> },
        { to: '/accountant/bank?import=1', label: 'Import bank statement', hint: 'CSV · auto-reconcile', icon: <Landmark size={18} /> },
        { to: '/accountant/fees', label: 'Record fee payment', hint: 'Cash / cheque / UPI', icon: <Wallet size={18} /> },
      ] as CreateAction[],
      inbox: { to: '/accountant/chat', label: 'Chat', badge: chatUnread, icon: 'chat' as const },
    }
  }
  return {
    primary: [
      { to: '/student', label: 'Overview', icon: <LayoutDashboard size={16} /> },
      { to: '/student/calendar', label: 'Calendar', icon: <CalendarRange size={16} /> },
      { to: '/student/fees', label: 'Fees', icon: <Receipt size={16} /> },
      { to: '/student/attendance', label: 'Attendance', icon: <CalendarCheck size={16} /> },
      { to: '/student/timetable', label: 'Timetable', icon: <CalendarDays size={16} /> },
      { to: '/student/events', label: 'Events', icon: <PartyPopper size={16} /> },
      { to: '/student/chat', label: 'Chat', icon: <MessagesSquare size={16} />, badge: chatUnread },
      { to: '/student/queries', label: 'Help desk', icon: <MessageSquareText size={16} />, badge: unreadForMe },
    ] as NavItem[],
    secondary: [profile] as NavItem[],
    create: [
      { to: '/student/fees', label: 'Pay fees', hint: 'UPI, card or net banking', icon: <Receipt size={18} /> },
      { to: '/student/events', label: 'Apply for an event', hint: 'Fests, workshops, talks', icon: <PartyPopper size={18} /> },
      { to: '/student/chat?new=direct', label: 'Message a teacher', hint: 'Your teachers, HOD or office', icon: <MessagesSquare size={18} /> },
      { to: '/student/profile', label: 'Update my profile', hint: 'Photo & details — HOD approves', icon: <UserRound size={18} /> },
      { to: '/student/queries?new=query', label: 'Raise a query', hint: 'Fees, exams, attendance…', icon: <MessageSquareText size={18} /> },
      { to: '/student/queries?new=complaint', label: 'File a complaint', hint: 'Can be anonymous', icon: <AlertTriangle size={18} /> },
    ] as CreateAction[],
    inbox: { to: '/student/chat', label: 'Chat', badge: chatUnread, icon: 'chat' as const },
  }
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', staff: 'Faculty', student: 'Student', accountant: 'Accounts' }

/* ------------------------------------------------------------------ */
/* Theme: Day (Marble) / Night (Noir) / Auto — see lib/themeMode.ts   */
/* ------------------------------------------------------------------ */

/** Kept for existing imports (login, platform console): the compact Day/Night/Auto switch. */
export function ThemeToggle() {
  return <ThemeSwitch />
}

/* ------------------------------------------------------------------ */
/* Popovers                                                           */
/* ------------------------------------------------------------------ */

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close, ref])
}

function Popover({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, { y: -6, autoAlpha: 0 }, 0.2)
  return (
    <div ref={ref} className={`popover ${className}`} role="menu">
      {children}
    </div>
  )
}

function CreateMenu({ actions, onPick }: { actions: CreateAction[]; onPick: (to: string) => void }) {
  return (
    <>
      <div className="popover-head"><span className="spec">Create</span></div>
      {actions.map((a) => (
        <button key={a.to} role="menuitem" className="menu-item" onClick={() => onPick(a.to)} onMouseEnter={() => prefetch(a.to)}>
          <span className="menu-icon">{a.icon}</span>
          <span>
            <strong>{a.label}</strong>
            <small>{a.hint}</small>
          </span>
        </button>
      ))}
    </>
  )
}

interface Notice { id: string; title: string; sub: string; to: string; icon: ReactNode }

function useNotices(db: Database, s: Session): Notice[] {
  const nowMs = useNow()
  return useMemo(() => {
    const out: Notice[] = []
    // Stored realtime notifications for me (newest first)
    const me = `${s.role}:${s.userId}`
    for (const n of db.notifications.filter((x) => x.to === me).slice(-8).reverse())
      out.push({ id: n.id, title: n.title, sub: `${n.body ? n.body.slice(0, 60) + ' · ' : ''}${new Date(n.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`, to: n.link || `/${s.role}`, icon: n.important ? <AlertTriangle size={16} /> : <Bell size={16} /> })
    if (s.role === 'admin') {
      for (const t of db.tickets.filter((x) => x.unreadByAdmin).slice(0, 6))
        out.push({ id: t.id, title: t.subject, sub: `${t.kind === 'complaint' ? 'Complaint' : 'Query'} · ${t.anonymous ? 'Anonymous' : t.from.name}`, to: `/admin/queries?t=${t.id}`, icon: <MessageSquareText size={16} /> })
    } else {
      for (const t of db.tickets.filter((x) => x.from.userId === s.userId && x.unreadByRequester))
        out.push({ id: t.id, title: `Reply: ${t.subject}`, sub: `${t.ref} · ${t.status.replace('_', ' ')}`, to: `/${s.role}/queries?t=${t.id}`, icon: <MessageSquareText size={16} /> })
      const now = new Date(nowMs)
      const soon = agenda(db, s, now, new Date(now.getTime() + 3 * 86400000), { includeFees: s.role === 'student' }).filter((i) => i.kind !== 'class')
      for (const i of soon.slice(0, 5))
        out.push({ id: i.id, title: i.title, sub: i.allDay ? `${i.start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : `In ${countdown(i.start)} · ${fmtTime(i.start)}`, to: `/${s.role}/calendar`, icon: <CalendarRange size={16} /> })
    }
    return out
  }, [db, s, nowMs])
}

/* ------------------------------------------------------------------ */
/* Search palette                                                     */
/* ------------------------------------------------------------------ */

function SearchPalette({ onClose, nav }: { onClose: () => void; nav: NavItem[] }) {
  const { db, session } = useStore()
  const go = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, { y: -12, autoAlpha: 0 }, 0.22)
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    const r: { label: string; sub: string; to: string }[] = nav.filter((n) => !t || n.label.toLowerCase().includes(t)).map((n) => ({ label: n.label, sub: 'Page', to: n.to }))
    if (t.length >= 2) {
      if (session?.role === 'admin') {
        db.students.filter((s) => s.name.toLowerCase().includes(t) || s.rollNo.toLowerCase().includes(t)).slice(0, 5).forEach((s) => r.push({ label: s.name, sub: `Student · ${s.rollNo}`, to: `/admin/students?q=${encodeURIComponent(s.name)}` }))
        db.staff.filter((s) => s.name.toLowerCase().includes(t)).slice(0, 3).forEach((s) => r.push({ label: s.name, sub: `Staff · ${s.department}`, to: '/admin/staff' }))
      }
      db.events.filter((e) => e.title.toLowerCase().includes(t)).slice(0, 5).forEach((e) => r.push({ label: e.title, sub: `${e.kind === 'exam' ? 'Exam' : 'Event'} · ${e.start.slice(0, 10)}`, to: `/${session?.role}/calendar?e=${e.id}` }))
    }
    return r.slice(0, 12)
  }, [q, nav, db, session])
  const pick = (to: string) => {
    go(to)
    onClose()
  }
  return (
    <div className="modal-backdrop" style={{ placeItems: 'start center', paddingTop: '12vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="modal" role="dialog" aria-label="Search">
        <div className="search" style={{ maxWidth: 'none', margin: 16 }}>
          <Search size={16} />
          <input
            autoFocus
            className="input"
            placeholder="Search pages, students, events…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter' && results[sel]) pick(results[sel].to)
              if (e.key === 'Escape') onClose()
            }}
            aria-label="Search"
          />
        </div>
        <div style={{ padding: '0 8px 8px', overflowY: 'auto' }}>
          {results.length === 0 && <p className="muted center" style={{ padding: 20 }}>No matches</p>}
          {results.map((r, i) => (
            <button key={r.to + r.label} className="menu-item" style={i === sel ? { background: 'var(--surface-hover)' } : undefined} onMouseEnter={() => setSel(i)} onClick={() => pick(r.to)}>
              <span style={{ flex: 1 }}>
                <strong>{r.label}</strong>
                <small>{r.sub}</small>
              </span>
              <ChevronRight size={16} className="muted" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile tab bar with liquid blob                                    */
/* ------------------------------------------------------------------ */

const tabRect = (el: HTMLElement) => ({ x: el.offsetLeft + el.offsetWidth / 2 - 30, w: 60 })

function TabBar({ home, calendar, inbox, onCreate, onMore, moreActive }: { home: string; calendar: string; inbox: { to: string; label: string; badge: number; icon: 'chat' | 'inbox' }; onCreate: () => void; onMore: () => void; moreActive: boolean }) {
  const go = useNavigate()
  const items = [{ to: home }, { to: calendar }, { to: '#create' }, { to: inbox.to }, { to: '#more' }]
  const routeIdx = useActiveIndex(items.slice(0, 4).map((x, i) => (i === 2 ? { to: '/__none' } : x)))
  const idx = moreActive || routeIdx < 0 ? 4 : routeIdx
  const bar = useRef<HTMLElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  useLiquidBlob(bar, blob, idx === 2 ? -1 : idx, tabRect)
  const tab = (i: number, label: string, icon: ReactNode, onClick: () => void, badge?: number) => (
    <button data-liquid className={`tab-item ${idx === i ? 'active' : ''}`} onClick={onClick} aria-current={idx === i ? 'page' : undefined} onTouchStart={() => i < 4 && prefetch(items[i].to)}>
      <span className="tab-ico">{icon}</span>
      <span>{label}</span>
      {!!badge && <span className="count-dot">{badge}</span>}
    </button>
  )
  return (
    <nav className="tabbar" ref={bar} aria-label="Primary">
      <span className="tab-blob" ref={blob} aria-hidden />
      {tab(0, 'Home', <Home size={20} />, () => go(home))}
      {tab(1, 'Calendar', <CalendarRange size={20} />, () => go(calendar))}
      <button data-liquid className="tab-item tab-create" onClick={onCreate} aria-label="Create">
        <span className="tab-plus"><Plus size={22} /></span>
        <span>Create</span>
      </button>
      {tab(3, inbox.label, inbox.icon === 'chat' ? <MessagesSquare size={20} /> : <MessageSquareText size={20} />, () => go(inbox.to), inbox.badge)}
      {tab(4, 'More', <Grid2x2 size={20} />, onMore)}
    </nav>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEnter(ref, { yPercent: 100 }, 0.32)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    overlayOpen(1)
    return () => {
      window.removeEventListener('keydown', k)
      overlayOpen(-1)
    }
  }, [onClose])
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" ref={ref} role="dialog" aria-label={title}>
        <div className="sheet-grab" />
        <div className="row mb">
          <h3>{title}</h3>
          <span className="spacer" />
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </>
  )
}

/** Vertical tool-rail links with a liquid blob that follows hover. */
function RailNav({ items }: { items: NavItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const blob = useRef<HTMLSpanElement>(null)
  const active = useActiveIndex(items)
  const { lit, item, group } = useLiquidHover(active)
  useLiquidBlob(ref, blob, lit, railRect, '[data-liquid]', 'y')
  return (
    <div className="rail-group rail-liquid" ref={ref} {...group}>
      <span className="rail-blob" ref={blob} aria-hidden />
      {items.map((n, i) => (
        <Link
          key={n.to}
          to={n.to}
          data-liquid
          className={`rail-btn ${i === active ? 'active' : ''} ${i === lit ? 'lit' : ''}`}
          aria-label={n.label}
          aria-current={i === active ? 'page' : undefined}
          {...item(i)}
          onMouseEnter={() => {
            item(i).onMouseEnter?.()
            prefetch(n.to)
          }}
        >
          {n.icon}
          <span className="rail-tip">{n.label}</span>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Layout                                                             */
/* ------------------------------------------------------------------ */

function PageFallback() {
  return (
    <div className="content" aria-busy>
      <div className="card" style={{ height: 120, opacity: 0.4 }} />
    </div>
  )
}

export default function Layout() {
  const { db, session, logout, storageError } = useStore()
  const loc = useLocation()
  const go = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheet, setSheet] = useState<null | 'more' | 'create'>(null)
  const createRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const closeCreate = useCallback(() => setCreateOpen(false), [])
  const closeBell = useCallback(() => setBellOpen(false), [])
  useDismiss(createOpen, closeCreate, createRef)
  useDismiss(bellOpen, closeBell, bellRef)

  // Close menus/sheets on navigation (adjusted during render rather than in an effect).
  const locKey = loc.pathname + loc.search
  const [prevLocKey, setPrevLocKey] = useState(locKey)
  if (prevLocKey !== locKey) {
    setPrevLocKey(locKey)
    setSheet(null)
    setCreateOpen(false)
    setBellOpen(false)
  }

  useEffect(() => {
    if (session) prefetchRole(session.role)
  }, [session])

  // Header state on scroll (rAF-throttled, passive).
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    let raf = 0
    const on = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setScrolled(window.scrollY > 8)
      })
    }
    window.addEventListener('scroll', on, { passive: true })
    on()
    return () => {
      window.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const nav = useMemo(() => (session ? navFor(session.role, db, session) : null), [session, db])
  const notices = useNotices(db, session ?? { role: 'admin', userId: '', name: '' })
  if (!session || !nav) return null
  const all = [...nav.primary, ...nav.secondary]
  const signOut = () => {
    logout()
    go('/login')
  }
  const me = session.role === 'student' ? db.students.find((s) => s.id === session.userId) : session.role === 'staff' ? db.staff.find((s) => s.id === session.userId) : null
  const myPhoto = photoOf(db, { role: session.role, userId: session.userId })

  const bell = (
    <div className="pop-wrap" ref={bellRef}>
      <button className="round-btn" aria-label={`Notifications${notices.length ? ` (${notices.length})` : ''}`} aria-expanded={bellOpen} onClick={() => setBellOpen((o) => !o)}>
        <Bell size={18} />
        {notices.length > 0 && <span className="count-dot">{notices.length}</span>}
      </button>
      {bellOpen && (
        <Popover className="right">
          <div className="popover-head"><span className="spec">Notifications</span></div>
          {notices.length === 0 && <p className="muted tiny" style={{ padding: 10 }}>You're all caught up.</p>}
          {notices.map((n) => (
            <button key={n.id} className="menu-item" onClick={() => go(n.to)}>
              <span className="menu-icon">{n.icon}</span>
              <span className="ellipsis">
                <strong className="ellipsis" style={{ display: 'block' }}>{n.title}</strong>
                <small>{n.sub}</small>
              </span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  )

  return (
    <div className={`shell ${scrolled ? 'scrolled' : ''}`}>
      {/* Desktop top bar */}
      <header className="topbar">
        <Link to={`/${session.role}`} className="brand" aria-label="Home">
          <Logo size={40} />
          <div className="brand-text">
            <strong>{db.branding.shortName || db.branding.collegeName}</strong>
            <small>{ROLE_LABEL[session.role]} portal</small>
          </div>
        </Link>
        <div className="topbar-center">
          <LiquidNav items={nav.primary} label="Main" />
        </div>
        <div className="topbar-right">
          <span className="tenant-chip" title={db.branding.collegeName}>
            <Logo size={32} />
            <span className="ellipsis">{db.branding.collegeName}</span>
          </span>
          <ThemeSwitch />
          {bell}
          <Link to={`/${session.role}/profile`} className="user-chip" aria-label="My profile" onMouseEnter={() => prefetch(`/${session.role}/profile`)}>
            <Avatar name={session.name} src={myPhoto} size={36} />
            <div className="user-meta">
              <strong>{session.name}</strong>
              <small>{session.role === 'staff' && isHod(db, session.userId) ? 'HOD' : ROLE_LABEL[session.role]}{me && 'department' in me ? ` · ${me.department}` : ''}</small>
            </div>
          </Link>
        </div>
      </header>

      {/* Desktop floating rail */}
      <aside className="rail" aria-label="Tools">
        <div className="rail-group">
          <button className="rail-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search size={18} /><span className="rail-tip">Search · Ctrl K</span>
          </button>
          <div className="pop-wrap" ref={createRef}>
            <button className="rail-btn create" onClick={() => setCreateOpen((o) => !o)} aria-label="Create" aria-expanded={createOpen}>
              <Plus size={20} /><span className="rail-tip">Create</span>
            </button>
            {createOpen && (
              <Popover className="rail-pop">
                <CreateMenu actions={nav.create} onPick={(to) => go(to)} />
              </Popover>
            )}
          </div>
        </div>
        {nav.secondary.length > 0 && <RailNav items={nav.secondary} />}
        <div className="rail-group">
          <button className="rail-btn" onClick={signOut} aria-label="Sign out">
            <LogOut size={18} /><span className="rail-tip">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="m-header">
        <Link to={`/${session.role}`} className="brand" aria-label="Home">
          <Logo size={36} />
          <div className="brand-text">
            <strong>{db.branding.shortName || db.branding.collegeName}</strong>
          </div>
        </Link>
        <button className="round-btn" aria-label="Search" onClick={() => setSearchOpen(true)}><Search size={18} /></button>
        {bell}
        <button className="round-btn" aria-label="Account and more" onClick={() => setSheet('more')} style={{ padding: 0, overflow: 'hidden' }}>
          <Avatar name={session.name} src={myPhoto} size={42} />
        </button>
      </header>

      <div className="main">
        {storageError && (
          <div className="banner banner-warn">
            <AlertTriangle size={16} /> {storageError}
          </div>
        )}
        <Suspense fallback={<PageFallback />}>
          <PageEnter routeKey={loc.pathname}>
            <Outlet />
          </PageEnter>
        </Suspense>
      </div>

      <TabBar
        home={`/${session.role}`}
        calendar={`/${session.role}/calendar`}
        inbox={nav.inbox}
        onCreate={() => setSheet('create')}
        onMore={() => setSheet('more')}
        moreActive={sheet === 'more'}
      />

      {sheet === 'more' && (
        <Sheet title={session.name} onClose={() => setSheet(null)}>
          <div className="sheet-theme">
            <span className="spec">Appearance</span>
            <ThemeSwitchWithDefault />
          </div>
          <div className="sheet-grid">
            {all.map((n) => (
              <button key={n.to} className={`sheet-tile ${loc.pathname === n.to ? 'active' : ''}`} onClick={() => go(n.to)}>
                {n.icon}
                <span>{n.label}</span>
                {!!n.badge && <span className="count-dot">{n.badge}</span>}
              </button>
            ))}
            <button className="sheet-tile" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
          </div>
        </Sheet>
      )}
      {sheet === 'create' && (
        <Sheet title="Create" onClose={() => setSheet(null)}>
          <CreateMenu actions={nav.create} onPick={(to) => go(to)} />
        </Sheet>
      )}
      {searchOpen && <SearchPalette nav={all} onClose={() => setSearchOpen(false)} />}
      <Toaster />
    </div>
  )
}
