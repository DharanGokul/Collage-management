import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, GraduationCap, Wallet, CalendarCheck, CalendarDays, Mail, Settings, LogOut, Moon, Sun, BookOpen,
  ClipboardCheck, Receipt, AlertTriangle, Plus, Search, Bell, MessageSquareText, PartyPopper, Grid2x2, CalendarRange, Megaphone,
  FilePlus2, UserPlus, X, ChevronRight, Home,
} from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Avatar, Logo, Toasts } from './ui'
import { LiquidNav, useActiveIndex, useLiquidBlob, type NavItem } from './LiquidNav'
import { PageEnter, useEnter } from './motion'
import { prefetch, prefetchRole } from '../routes'
import type { Database, Role, Session } from '../types'
import { agenda, countdown, fmtTime } from '../lib/agenda'

/* ------------------------------------------------------------------ */
/* Navigation model                                                   */
/* ------------------------------------------------------------------ */

interface CreateAction { to: string; label: string; hint: string; icon: ReactNode }

function navFor(role: Role, db: Database, s: Session) {
  const openForAdmin = db.tickets.filter((t) => t.unreadByAdmin).length
  const unreadForMe = db.tickets.filter((t) => t.from.userId === s.userId && t.unreadByRequester).length
  const ico = (n: ReactNode) => n
  if (role === 'admin')
    return {
      primary: [
        { to: '/admin', label: 'Overview', icon: ico(<LayoutDashboard size={16} />) },
        { to: '/admin/calendar', label: 'Calendar', icon: ico(<CalendarRange size={16} />) },
        { to: '/admin/events', label: 'Events', icon: ico(<PartyPopper size={16} />) },
        { to: '/admin/students', label: 'Students', icon: ico(<GraduationCap size={16} />) },
        { to: '/admin/staff', label: 'Staff', icon: ico(<Users size={16} />) },
        { to: '/admin/fees', label: 'Fees', icon: ico(<Wallet size={16} />) },
        { to: '/admin/attendance', label: 'Attendance', icon: ico(<CalendarCheck size={16} />) },
        { to: '/admin/timetable', label: 'Timetable', icon: ico(<CalendarDays size={16} />) },
        { to: '/admin/queries', label: 'Help desk', icon: ico(<MessageSquareText size={16} />), badge: openForAdmin },
      ] as NavItem[],
      secondary: [
        { to: '/admin/subjects', label: 'Subjects', icon: <BookOpen size={18} /> },
        { to: '/admin/email', label: 'Email Center', icon: <Mail size={18} /> },
        { to: '/admin/settings', label: 'Settings & Branding', icon: <Settings size={18} /> },
      ] as NavItem[],
      create: [
        { to: '/admin/events?new=event', label: 'New event', hint: 'Fest, workshop, meeting or holiday', icon: <PartyPopper size={18} /> },
        { to: '/admin/events?new=exam', label: 'Schedule exam', hint: 'Shows on each class calendar', icon: <FilePlus2 size={18} /> },
        { to: '/admin/students?new=1', label: 'Add student', hint: 'Enrol a new student', icon: <UserPlus size={18} /> },
        { to: '/admin?announce=1', label: 'Announcement', hint: 'Post to students, staff or both', icon: <Megaphone size={18} /> },
        { to: '/admin/email', label: 'Send email', hint: 'Compose to any audience', icon: <Mail size={18} /> },
      ] as CreateAction[],
      inbox: { to: '/admin/queries', label: 'Help desk', badge: openForAdmin },
    }
  if (role === 'staff')
    return {
      primary: [
        { to: '/staff', label: 'Overview', icon: <LayoutDashboard size={16} /> },
        { to: '/staff/calendar', label: 'Calendar', icon: <CalendarRange size={16} /> },
        { to: '/staff/attendance', label: 'Attendance', icon: <ClipboardCheck size={16} /> },
        { to: '/staff/timetable', label: 'Timetable', icon: <CalendarDays size={16} /> },
        { to: '/staff/students', label: 'My students', icon: <GraduationCap size={16} /> },
        { to: '/staff/events', label: 'Events', icon: <PartyPopper size={16} /> },
        { to: '/staff/queries', label: 'Help desk', icon: <MessageSquareText size={16} />, badge: unreadForMe },
      ] as NavItem[],
      secondary: [] as NavItem[],
      create: [
        { to: '/staff/attendance', label: 'Mark attendance', hint: 'For a class you teach today', icon: <ClipboardCheck size={18} /> },
        { to: '/staff/queries?new=query', label: 'Raise a query', hint: 'Ask the administration', icon: <MessageSquareText size={18} /> },
        { to: '/staff/queries?new=complaint', label: 'File a complaint', hint: 'Facilities, conduct and more', icon: <AlertTriangle size={18} /> },
      ] as CreateAction[],
      inbox: { to: '/staff/queries', label: 'Help desk', badge: unreadForMe },
    }
  return {
    primary: [
      { to: '/student', label: 'Overview', icon: <LayoutDashboard size={16} /> },
      { to: '/student/calendar', label: 'Calendar', icon: <CalendarRange size={16} /> },
      { to: '/student/fees', label: 'Fees', icon: <Receipt size={16} /> },
      { to: '/student/attendance', label: 'Attendance', icon: <CalendarCheck size={16} /> },
      { to: '/student/timetable', label: 'Timetable', icon: <CalendarDays size={16} /> },
      { to: '/student/events', label: 'Events', icon: <PartyPopper size={16} /> },
      { to: '/student/queries', label: 'Help desk', icon: <MessageSquareText size={16} />, badge: unreadForMe },
    ] as NavItem[],
    secondary: [] as NavItem[],
    create: [
      { to: '/student/fees', label: 'Pay fees', hint: 'UPI, card or net banking', icon: <Receipt size={18} /> },
      { to: '/student/events', label: 'Apply for an event', hint: 'Fests, workshops, talks', icon: <PartyPopper size={18} /> },
      { to: '/student/queries?new=query', label: 'Raise a query', hint: 'Fees, exams, attendance…', icon: <MessageSquareText size={18} /> },
      { to: '/student/queries?new=complaint', label: 'File a complaint', hint: 'Can be anonymous', icon: <AlertTriangle size={18} /> },
    ] as CreateAction[],
    inbox: { to: '/student/queries', label: 'Help desk', badge: unreadForMe },
  }
}

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', staff: 'Faculty', student: 'Student' }

/* ------------------------------------------------------------------ */
/* Theme (Noir is Caesar's primary theme)                             */
/* ------------------------------------------------------------------ */

function readTheme(): 'dark' | 'light' {
  try {
    const v = localStorage.getItem('cms:theme')
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return 'dark'
}

// One shared theme store so every toggle (rail, login, mobile sheet) stays in sync.
let currentTheme = readTheme()
const themeListeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.dataset.theme = currentTheme
function setThemeGlobal(t: 'dark' | 'light') {
  currentTheme = t
  document.documentElement.dataset.theme = t
  try {
    localStorage.setItem('cms:theme', t)
  } catch {
    /* ignore */
  }
  themeListeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb)
      return () => themeListeners.delete(cb)
    },
    () => currentTheme,
  )
  return [theme, () => setThemeGlobal(currentTheme === 'dark' ? 'light' : 'dark')] as const
}

export function ThemeToggle({ className = 'round-btn' }: { className?: string }) {
  const [theme, toggle] = useTheme()
  const dark = theme === 'dark'
  return (
    <button className={className} onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Marble (light)' : 'Noir (dark)'}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      {className === 'rail-btn' && <span className="rail-tip">{dark ? 'Light theme' : 'Dark theme'}</span>}
      {className === 'sheet-tile' && <span>{dark ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  )
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
  return useMemo(() => {
    const out: Notice[] = []
    if (s.role === 'admin') {
      for (const t of db.tickets.filter((x) => x.unreadByAdmin).slice(0, 6))
        out.push({ id: t.id, title: t.subject, sub: `${t.kind === 'complaint' ? 'Complaint' : 'Query'} · ${t.anonymous ? 'Anonymous' : t.from.name}`, to: `/admin/queries?t=${t.id}`, icon: <MessageSquareText size={16} /> })
    } else {
      for (const t of db.tickets.filter((x) => x.from.userId === s.userId && x.unreadByRequester))
        out.push({ id: t.id, title: `Reply: ${t.subject}`, sub: `${t.ref} · ${t.status.replace('_', ' ')}`, to: `/${s.role}/queries?t=${t.id}`, icon: <MessageSquareText size={16} /> })
      const now = new Date()
      const soon = agenda(db, s, now, new Date(now.getTime() + 3 * 86400000), { includeFees: s.role === 'student' }).filter((i) => i.kind !== 'class')
      for (const i of soon.slice(0, 5))
        out.push({ id: i.id, title: i.title, sub: i.allDay ? `${i.start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : `In ${countdown(i.start)} · ${fmtTime(i.start)}`, to: `/${s.role}/calendar`, icon: <CalendarRange size={16} /> })
    }
    return out
  }, [db, s])
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

function TabBar({ home, calendar, inbox, onCreate, onMore, moreActive }: { home: string; calendar: string; inbox: { to: string; label: string; badge: number }; onCreate: () => void; onMore: () => void; moreActive: boolean }) {
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
      {tab(3, inbox.label === 'Help desk' ? 'Inbox' : inbox.label, <MessageSquareText size={20} />, () => go(inbox.to), inbox.badge)}
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
    return () => window.removeEventListener('keydown', k)
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

  useEffect(() => {
    setSheet(null)
    setCreateOpen(false)
    setBellOpen(false)
  }, [loc.pathname, loc.search])

  useEffect(() => {
    if (session) prefetchRole(session.role)
  }, [session])

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
    <div className="shell">
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
          {bell}
          <div className="user-chip">
            <Avatar name={session.name} size={36} />
            <div className="user-meta">
              <strong>{session.name}</strong>
              <small>{ROLE_LABEL[session.role]}{me && 'department' in me ? ` · ${me.department}` : ''}</small>
            </div>
          </div>
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
        {nav.secondary.length > 0 && (
          <div className="rail-group">
            {nav.secondary.map((n) => (
              <Link key={n.to} to={n.to} className={`rail-btn ${loc.pathname.startsWith(n.to) ? 'active' : ''}`} aria-label={n.label} onMouseEnter={() => prefetch(n.to)} aria-current={loc.pathname.startsWith(n.to) ? 'page' : undefined}>
                {n.icon}<span className="rail-tip">{n.label}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="rail-group">
          <ThemeToggle className="rail-btn" />
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
          <Avatar name={session.name} size={42} />
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
          <div className="sheet-grid">
            {all.map((n) => (
              <button key={n.to} className={`sheet-tile ${loc.pathname === n.to ? 'active' : ''}`} onClick={() => go(n.to)}>
                {n.icon}
                <span>{n.label}</span>
                {!!n.badge && <span className="count-dot">{n.badge}</span>}
              </button>
            ))}
            <ThemeToggle className="sheet-tile" />
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
      <Toasts />
    </div>
  )
}
