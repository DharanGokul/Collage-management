import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarX, Flag } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Empty, Segmented } from '../../components/ui'
import { gsap, prefersReducedMotion } from '../../components/motion'
import { useIsMobile } from '../../lib/useMedia'
import {
  KIND_CODE, KIND_LABEL, addDays, agenda, canRegister, eventRange, fmtTime, myRegistration, overlapsDay, registeredCount, sameDay, startOfWeek, type AgendaItem, type AgendaKind,
} from '../../lib/agenda'
import { DAYS, classLabel, formatDate, studentClassKey, toISODate } from '../../lib/utils'
import { EventDetail, EventForm, KindBadge, blankEvent, kindStyle, useRegistration, whenText } from './eventsUi'
import type { CampusEvent } from '../../types'

type View = 'week' | 'month' | 'list'
const ALL_KINDS: AgendaKind[] = ['exam', 'event', 'fest', 'workshop', 'meeting', 'holiday', 'fee', 'class']

export default function CalendarPage() {
  const { db, session } = useStore()
  const go = useNavigate()
  const [params, setParams] = useSearchParams()
  const mobile = useIsMobile()
  const isAdmin = session?.role === 'admin'
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [selDay, setSelDay] = useState(() => new Date())
  const [kinds, setKinds] = useState<Set<AgendaKind>>(() => new Set(ALL_KINDS.filter((k) => k !== 'class' || session?.role !== 'admin')))
  const [cls, setCls] = useState('all')
  const [editing, setEditing] = useState<CampusEvent | null>(null)
  const openId = params.get('e')
  const open = openId ? db.events.find((e) => e.id === openId) : undefined
  const setOpen = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('e', id)
    else p.delete('e')
    setParams(p, { replace: true })
  }

  const [from, to] = useMemo(() => {
    if (view === 'week') {
      const s = startOfWeek(anchor)
      return [s, addDays(s, 7)]
    }
    if (view === 'month') {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      const s = startOfWeek(first)
      return [s, addDays(s, 42)]
    }
    const s = new Date(anchor)
    s.setHours(0, 0, 0, 0)
    return [s, addDays(s, 45)]
  }, [view, anchor])

  const allItems = useMemo(
    () => (session ? agenda(db, session, from, to, { includeClasses: kinds.has('class'), includeFees: true }) : []),
    [db, session, from, to, kinds],
  )
  const items = useMemo(
    () =>
      allItems.filter((i) => {
        if (!kinds.has(i.kind)) return false
        if (isAdmin && cls !== 'all' && i.eventId) {
          const e = db.events.find((x) => x.id === i.eventId)
          if (e && e.classKeys.length && !e.classKeys.includes(cls)) return false
        }
        return true
      }),
    [allItems, kinds, isAdmin, cls, db.events],
  )

  // This-week KPIs
  const kpi = useMemo(() => {
    if (!session) return { events: 0, exams: 0, open: 0, free: 0 }
    const s = startOfWeek(new Date())
    const wk = agenda(db, session, s, addDays(s, 7), { includeFees: false })
    const busy = new Set(wk.flatMap((i) => Array.from({ length: 7 }, (_, d) => addDays(s, d)).filter((d) => overlapsDay(i, d)).map(toISODate)))
    const open = db.events.filter((e) => e.registration.enabled && eventRange(e).start > new Date() && (isAdmin || canRegister(db, session, e).ok)).length
    return { events: wk.filter((i) => i.kind !== 'exam').length, exams: wk.filter((i) => i.kind === 'exam').length, open, free: 7 - busy.size }
  }, [db, session, isAdmin])

  const step = (dir: number) => {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() + dir)
    else d.setDate(d.getDate() + (view === 'week' ? 7 : 30) * dir)
    setAnchor(d)
    if (view === 'week') setSelDay(addDays(selDay, 7 * dir))
  }
  const today = () => {
    setAnchor(new Date())
    setSelDay(new Date())
  }
  const toggleKind = (k: AgendaKind) =>
    setKinds((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  const onItem = (i: AgendaItem) => {
    if (i.eventId) setOpen(i.eventId)
    else if (i.kind === 'fee') go(`/${session?.role}/${session?.role === 'admin' ? 'fees' : 'fees'}`)
    else if (i.kind === 'class') go(`/${session?.role}/timetable`)
  }

  // Animate the grid when the range or view changes.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!bodyRef.current || prefersReducedMotion()) return
    gsap.fromTo(bodyRef.current, { autoAlpha: 0.4, x: 0 }, { autoAlpha: 1, duration: 0.25, ease: 'power2.out', clearProps: 'opacity,visibility' })
  }, [from, view])

  if (!session) return null
  const title =
    view === 'month'
      ? anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${from.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(from, 6).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `Next 45 days`
  const classes = [...new Set(db.students.map(studentClassKey))].sort()
  const visibleKinds = ALL_KINDS.filter((k) => !(k === 'fee' && session.role === 'staff'))

  return (
    <>
      <div className="page-header">
        <div className="stack-s">
          <h1>Calendar</h1>
          <div className="cal-kpis">
            <div><strong>{kpi.exams}</strong><small>Exams this week</small></div>
            <div><strong>{kpi.events}</strong><small>Events this week</small></div>
            <div><strong>{kpi.open}</strong><small>Open for registration</small></div>
            <div><strong>{kpi.free}</strong><small>Free days this week</small></div>
          </div>
        </div>
        <div className="cal-controls">
          <Segmented kind="tab" label="View" value={view} onChange={setView} options={(['week', 'month', 'list'] as View[]).map((v) => ({ id: v, label: v[0].toUpperCase() + v.slice(1) }))} />
          <button className="round-btn" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft size={18} /></button>
          <Button variant="secondary" onClick={today}>Today</Button>
          <button className="round-btn" aria-label="Next" onClick={() => step(1)}><ChevronRight size={18} /></button>
          {isAdmin && <Button icon={<Plus size={16} />} onClick={() => setEditing(blankEvent('event', toISODate(selDay)))}>New event</Button>}
        </div>
      </div>

      <div className="cal-filters">
        <div className="chip-scroll">
          <button className={`chip ${kinds.size === visibleKinds.length ? 'active' : ''}`} onClick={() => setKinds(new Set(kinds.size === visibleKinds.length ? [] : visibleKinds))}>All</button>
          {visibleKinds.map((k) => (
            <button key={k} className={`chip ${kinds.has(k) ? 'soft-on' : ''}`} aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)} style={kindStyle(k)}>
              <span className="kind-dot" /> {k === 'class' ? 'My classes' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {isAdmin && (
          <select className="input sm" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class filter">
            <option value="all">All classes</option>
            {classes.map((k) => <option key={k} value={k}>{classLabel(k)}</option>)}
          </select>
        )}
      </div>

      <div className="cal-layout">
        <Card pad={false}>
          <div className="cal-head">
            <div>
              <h2>{title}</h2>
              <span className="muted tiny">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div ref={bodyRef}>
            {view === 'week' && (mobile ? <MobileWeek from={from} items={items} sel={selDay} setSel={setSelDay} onItem={onItem} /> : <WeekGrid from={from} items={items} onItem={onItem} onDay={(d) => { setSelDay(d); if (isAdmin) setEditing(blankEvent('event', toISODate(d))) }} />)}
            {view === 'month' && <MonthGrid anchor={anchor} from={from} items={items} compact={mobile} sel={selDay} onDay={(d) => { setSelDay(d); if (!mobile) { setAnchor(d); setView('week') } }} onItem={onItem} />}
            {view === 'month' && mobile && <DayAgenda day={selDay} items={items} onItem={onItem} />}
            {view === 'list' && <ListView items={items} onItem={onItem} />}
          </div>
        </Card>
        <div className="stack-l">
          <MiniMonth anchor={anchor} items={allItems} weekStart={view === 'week' ? from : null} onPick={(d) => { setAnchor(d); setSelDay(d) }} />
          <OpenRegistrations onOpen={(id) => setOpen(id)} />
        </div>
      </div>

      {open && <EventDetail event={open} onClose={() => setOpen(null)} onEdit={(e) => { setOpen(null); setEditing(e) }} />}
      {editing && <EventForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

/* ---------------- week (desktop) ---------------- */

function lanes(items: AgendaItem[]) {
  // Greedy lane assignment so overlapping events sit side by side.
  const out = new Map<string, { lane: number; of: number }>()
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime())
  let cluster: AgendaItem[] = []
  let clusterEnd = 0
  const flush = () => {
    const laneEnds: number[] = []
    const assigned: [AgendaItem, number][] = []
    for (const it of cluster) {
      let l = laneEnds.findIndex((e) => e <= it.start.getTime())
      if (l < 0) {
        l = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[l] = it.end.getTime()
      assigned.push([it, l])
    }
    for (const [it, l] of assigned) out.set(it.id, { lane: l, of: laneEnds.length })
    cluster = []
  }
  for (const it of sorted) {
    if (cluster.length && it.start.getTime() >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end.getTime())
  }
  flush()
  return out
}

function WeekGrid({ from, items, onItem, onDay }: { from: Date; items: AgendaItem[]; onItem: (i: AgendaItem) => void; onDay: (d: Date) => void }) {
  const HOUR = 56
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const now = new Date()
  const allDay = items.filter((i) => i.allDay)
  const timed = items.filter((i) => !i.allDay)
  const startH = Math.min(8, ...timed.map((i) => i.start.getHours()))
  const endH = Math.max(18, ...timed.map((i) => i.end.getHours() + (i.end.getMinutes() ? 1 : 0)))
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Scroll to "now" (or 8 AM) on first render.
    const el = bodyRef.current
    if (!el) return
    const h = now.getHours()
    el.scrollTop = Math.max(0, (Math.min(Math.max(h, startH), endH) - startH - 1.5) * HOUR)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from])

  return (
    <div className="wk" style={{ ['--hour' as string]: `${HOUR}px` }}>
      <div className="wk-cols">
        <div />
        {days.map((d) => {
          const n = items.filter((i) => overlapsDay(i, d)).length
          return (
            <button key={d.toISOString()} className={`wk-dayhead ${sameDay(d, now) ? 'today' : ''}`} onClick={() => onDay(d)} title="Add on this day">
              <span className="spec">{DAYS[(d.getDay() + 6) % 7].slice(0, 3)}</span>
              <span className="wk-num">{d.getDate()}</span>
              <small>{n ? `${n} item${n > 1 ? 's' : ''}` : 'Free'}</small>
            </button>
          )
        })}
      </div>
      {allDay.length > 0 && (
        <div className="wk-allday">
          <span className="wk-allday-label" style={{ gridRow: `1 / span ${allDay.length}` }}><Flag size={14} /></span>
          {allDay.map((i) => {
            const s = Math.max(0, Math.floor((i.start.getTime() - from.getTime()) / 86400000))
            const e = Math.min(6, Math.floor((i.end.getTime() - from.getTime()) / 86400000))
            const continues = i.end > addDays(from, 7)
            return (
              <button key={i.id} className="span-bar" style={{ ...kindStyle(i.kind), gridColumn: `${s + 2} / ${e + 3}` }} onClick={() => onItem(i)} title={i.title}>
                <span className="wcode" style={{ background: 'var(--surface)', color: 'var(--ink)' }}>{KIND_CODE[i.kind]}</span>
                <span>{i.title}</span>
                {(e > s || continues) && <em>until {i.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</em>}
              </button>
            )
          })}
        </div>
      )}
      <div className="wk-body" ref={bodyRef}>
        <div className="wk-hours">
          {hours.map((h) => (
            <div key={h} className="wk-hour">{h === startH ? '' : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}</div>
          ))}
        </div>
        {days.map((d) => {
          const dayItems = timed.filter((i) => sameDay(i.start, d))
          const lane = lanes(dayItems)
          const isToday = sameDay(d, now)
          const past = d < now && !isToday
          return (
            <div key={d.toISOString()} className={`wk-col ${isToday ? 'today' : ''} ${past ? 'past' : ''}`} style={{ height: hours.length * HOUR }}>
              {dayItems.map((i) => {
                const top = ((i.start.getHours() - startH) * 60 + i.start.getMinutes()) * (HOUR / 60)
                const h = Math.max(26, ((i.end.getTime() - i.start.getTime()) / 60000) * (HOUR / 60) - 2)
                const l = lane.get(i.id) ?? { lane: 0, of: 1 }
                return (
                  <button
                    key={i.id}
                    className={`ev ${i.kind === 'class' ? 'is-class' : ''}`}
                    style={{ ...kindStyle(i.kind), top, height: h, left: `calc(${(l.lane / l.of) * 100}% + 3px)`, width: `calc(${100 / l.of}% - 6px)` }}
                    onClick={() => onItem(i)}
                    title={`${fmtTime(i.start)} ${i.title}`}
                  >
                    <strong>{fmtTime(i.start)}</strong>
                    <span>{i.title}</span>
                  </button>
                )
              })}
              {isToday && now.getHours() >= startH && now.getHours() < endH && (
                <>
                  <div className="now-line" style={{ top: ((now.getHours() - startH) * 60 + now.getMinutes()) * (HOUR / 60) }} />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- week (mobile: strip + agenda) ---------------- */

function MobileWeek({ from, items, sel, setSel, onItem }: { from: Date; items: AgendaItem[]; sel: Date; setSel: (d: Date) => void; onItem: (i: AgendaItem) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const selected = days.find((d) => sameDay(d, sel)) ?? days[0]
  return (
    <div className="stack" style={{ padding: '0 16px 16px' }}>
      <div className="strip" role="tablist" aria-label="Days">
        {days.map((d) => {
          const di = items.filter((i) => overlapsDay(i, d))
          return (
            <button key={d.toISOString()} role="tab" aria-selected={sameDay(d, selected)} className={`strip-day ${sameDay(d, selected) ? 'active' : ''} ${sameDay(d, new Date()) ? 'is-today' : ''}`} onClick={() => setSel(d)}>
              <small>{DAYS[(d.getDay() + 6) % 7].slice(0, 2)}</small>
              <strong>{d.getDate()}</strong>
              <span className="strip-dots">{di.slice(0, 3).map((i) => <i key={i.id} style={kindStyle(i.kind)} />)}</span>
            </button>
          )
        })}
      </div>
      <DayAgenda day={selected} items={items} onItem={onItem} bare />
    </div>
  )
}

function DayAgenda({ day, items, onItem, bare }: { day: Date; items: AgendaItem[]; onItem: (i: AgendaItem) => void; bare?: boolean }) {
  const list = items.filter((i) => overlapsDay(i, day))
  const isToday = sameDay(day, new Date())
  return (
    <div className="stack-s" style={bare ? undefined : { padding: 16 }}>
      <div>
        <h3 style={{ fontSize: 22 }}>{isToday ? 'Today' : day.toLocaleDateString(undefined, { weekday: 'long' })}</h3>
        <span className="muted tiny">{day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} · {list.length} item{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length === 0 && <Empty icon={<CalendarX />} title="Nothing scheduled" />}
      {list.map((i) => (
        <button key={i.id} className="ev-card" style={kindStyle(i.kind)} onClick={() => onItem(i)}>
          <div className="ev-card-main">
            <strong>{i.allDay ? 'All day' : `${fmtTime(i.start)} – ${fmtTime(i.end)}`}</strong>
            <span>{i.title}</span>
            <span className="row gap-s"><KindBadge kind={i.kind} />{i.sub && <span className="muted tiny ellipsis">{i.sub}</span>}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

/* ---------------- month ---------------- */

function MonthGrid({ anchor, from, items, compact, sel, onDay, onItem }: { anchor: Date; from: Date; items: AgendaItem[]; compact: boolean; sel: Date; onDay: (d: Date) => void; onItem: (i: AgendaItem) => void }) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(from, i))
  return (
    <div className="month">
      {DAYS.slice(0, 7).concat([]).map((d, i) => (
        <div key={d + i} className="month-dow spec">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</div>
      ))}
      {days.map((d) => {
        const di = items.filter((i) => overlapsDay(i, d))
        const out = d.getMonth() !== anchor.getMonth()
        return (
          <div
            key={d.toISOString()}
            role="button"
            tabIndex={0}
            className={`month-cell ${out ? 'out' : ''} ${sameDay(d, new Date()) ? 'today' : ''}`}
            style={compact ? { minHeight: 58, outline: sameDay(d, sel) ? '2px solid var(--ink)' : undefined, outlineOffset: -2 } : undefined}
            onClick={() => onDay(d)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onDay(d)}
            aria-label={`${d.toDateString()}, ${di.length} items`}
          >
            <span className="month-num">{d.getDate()}</span>
            {compact ? (
              <span className="strip-dots">{di.slice(0, 3).map((i) => <i key={i.id} style={kindStyle(i.kind)} />)}</span>
            ) : (
              <>
                {di.slice(0, 3).map((i) => (
                  <span
                    key={i.id}
                    className="mchip"
                    style={kindStyle(i.kind)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onItem(i)
                    }}
                  >
                    <span className="kind-dot" />
                    <span>{i.allDay ? '' : fmtTime(i.start) + ' '}{i.title}</span>
                  </span>
                ))}
                {di.length > 3 && <span className="mmore">+{di.length - 3} more</span>}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- list ---------------- */

function ListView({ items, onItem }: { items: AgendaItem[]; onItem: (i: AgendaItem) => void }) {
  const groups = new Map<string, AgendaItem[]>()
  for (const i of items.filter((x) => x.kind !== 'class' || items.length < 60)) {
    const k = toISODate(i.start < new Date(new Date().setHours(0, 0, 0, 0)) && i.allDay ? new Date() : i.start)
    groups.set(k, [...(groups.get(k) ?? []), i])
  }
  if (!groups.size) return <Empty icon={<CalendarX />} title="Nothing scheduled" />
  return (
    <ul className="agenda-list">
      {[...groups.entries()].map(([day, list]) => (
        <li key={day}>
          <div className="agenda-day spec">{formatDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {list.map((i) => (
            <button key={i.id} className="agenda-item" onClick={() => onItem(i)}>
              <span className="agenda-time">{i.allDay ? 'All day' : fmtTime(i.start)}<small>{i.allDay ? (sameDay(i.start, i.end) ? '' : `until ${i.end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`) : fmtTime(i.end)}</small></span>
              <span className="kind-tile" style={kindStyle(i.kind)}>{KIND_CODE[i.kind]}</span>
              <span className="coming-main">
                <strong>{i.title}</strong>
                <small>{KIND_LABEL[i.kind]}{i.sub ? ` · ${i.sub}` : ''}</small>
              </span>
            </button>
          ))}
        </li>
      ))}
    </ul>
  )
}

/* ---------------- side panels ---------------- */

function MiniMonth({ anchor, items, weekStart, onPick }: { anchor: Date; items: AgendaItem[]; weekStart: Date | null; onPick: (d: Date) => void }) {
  const [m, setM] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1))
  useEffect(() => setM(new Date(anchor.getFullYear(), anchor.getMonth(), 1)), [anchor])
  const { db, session } = useStore()
  const start = startOfWeek(m)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const monthItems = useMemo(() => (session ? agenda(db, session, start, addDays(start, 42), { includeFees: true }) : items), [db, session, start.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const busy = new Set(monthItems.flatMap((i) => days.filter((d) => overlapsDay(i, d)).map(toISODate)))
  return (
    <Card pad={false}>
      <div className="mini">
        <div className="mini-head">
          <strong>{m.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
          <span className="row gap-s">
            <button className="round-btn" style={{ width: 34, height: 34 }} aria-label="Previous month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
            <button className="round-btn" style={{ width: 34, height: 34 }} aria-label="Next month" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
          </span>
        </div>
        <div className="mini-grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="spec">{d}</span>)}
          {days.map((d) => {
            const inWeek = weekStart && d >= weekStart && d < addDays(weekStart, 7)
            return (
              <button key={d.toISOString()} className={`mini-day ${d.getMonth() !== m.getMonth() ? 'out' : ''} ${inWeek ? 'inweek' : ''} ${sameDay(d, new Date()) ? 'today' : ''}`} onClick={() => onPick(d)} aria-label={d.toDateString()}>
                {d.getDate()}
                {busy.has(toISODate(d)) && <i />}
              </button>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function OpenRegistrations({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, session } = useStore()
  const { register } = useRegistration()
  if (!session) return null
  const list = db.events
    .filter((e) => e.registration.enabled && eventRange(e).start > new Date() && (session.role === 'admin' || canRegister(db, session, e).ok || myRegistration(e, session)))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5)
  return (
    <Card title="Open for registration" actions={<span className="count-badge">{list.length}</span>}>
      {list.length === 0 ? (
        <p className="muted tiny">No events are taking registrations right now.</p>
      ) : (
        <div className="stack-s">
          {list.map((e) => {
            const mine = myRegistration(e, session)
            const n = registeredCount(e)
            return (
              <div key={e.id} className="coming-item" style={{ cursor: 'default' }}>
                <span className="kind-tile" style={kindStyle(e.kind)}>{KIND_CODE[e.kind]}</span>
                <button className="coming-main" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit' }} onClick={() => onOpen(e.id)}>
                  <strong>{e.title}</strong>
                  <small>{whenText(e)} · {n}{e.registration.capacity ? `/${e.registration.capacity}` : ''} going</small>
                </button>
                {session.role !== 'admin' && (mine ? <span className="badge badge-green">{mine.status === 'registered' ? 'Going' : 'Waitlist'}</span> : <Button size="sm" variant="secondary" onClick={() => register(e)}>Apply</Button>)}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
