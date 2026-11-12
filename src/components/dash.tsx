import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock, MapPin, Users, ChevronDown, CalendarRange } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Card, Empty } from './ui'
import { KIND_CODE, KIND_LABEL, addDays, countdown, fmtTime, overlapsDay, registeredCount, sameDay, type AgendaItem } from '../lib/agenda'
import { kindStyle } from '../pages/shared/eventsUi'

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'
}

export interface Kpi { icon: ReactNode; value: ReactNode; label: string; badge?: ReactNode }

export function Greeting({ name, kpis, action }: { name: string; kpis: Kpi[]; action?: ReactNode }) {
  const first = name.replace(/^(Dr|Prof|Ms|Mr|Mrs)\.\s*/i, '').split(' ')[0]
  return (
    <section className="greet">
      <h1 className="greet-title">
        {greeting()},<br />
        {first}
      </h1>
      <div className="greet-stats">
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <span className="kpi-icon">{k.icon}</span>
            <div>
              <div className="kpi-value">
                {k.value}
                {k.badge}
              </div>
              <div className="kpi-label">{k.label}</div>
            </div>
          </div>
        ))}
      </div>
      {action}
    </section>
  )
}

/** Re-render every 30s so countdowns stay live. */
function useTick(ms = 30000) {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((x) => x + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

export function UpNext({ item, onOpen, footer }: { item: AgendaItem | null; onOpen: (i: AgendaItem) => void; footer?: ReactNode }) {
  useTick()
  const { db } = useStore()
  if (!item) return <Empty icon={<CalendarRange />} title="Nothing coming up">Your calendar is clear.</Empty>
  const ev = item.eventId ? db.events.find((e) => e.id === item.eventId) : undefined
  const started = item.start <= new Date()
  return (
    <div className="upnext" style={kindStyle(item.kind)}>
      <div className="upnext-art" aria-hidden>
        <span className="slab-word">{KIND_LABEL[item.kind]}</span>
      </div>
      <div className="upnext-body">
        <div className="row gap-s">
          <span className="wcode" style={{ background: 'var(--white)', color: 'var(--black)' }}>{KIND_CODE[item.kind]}</span>
          <span className="spec">{KIND_LABEL[item.kind]}{item.sub ? ` · ${item.sub}` : ''}</span>
        </div>
        <span className="spec" style={{ marginTop: 10 }}>{started ? 'happening now' : 'starts in'}</span>
        <div className="upnext-count">{started ? 'Live' : countdown(item.start)}</div>
        <div className="upnext-meta">
          <Clock size={15} />
          {item.allDay ? item.start.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }) : `${item.start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtTime(item.start)}–${fmtTime(item.end)}`}
        </div>
        <p className="upnext-title">{item.title}{ev?.description ? ` — ${ev.description}` : ''}</p>
        <div className="upnext-foot">
          {item.sub && <span className="pill"><MapPin size={12} /> {item.sub}</span>}
          {ev?.registration.enabled && <span className="pill"><Users size={12} /> {registeredCount(ev)}{ev.registration.capacity ? `/${ev.registration.capacity}` : ''} registered</span>}
          {footer}
          <button className="round-btn" aria-label="Open" onClick={() => onOpen(item)}><ArrowUpRight size={18} /></button>
        </div>
      </div>
    </div>
  )
}

export function ComingUp({ items, onOpen }: { items: AgendaItem[]; onOpen: (i: AgendaItem) => void }) {
  if (!items.length) return null
  return (
    <>
      <span className="spec">Coming up</span>
      <div className="coming">
        {items.map((i) => (
          <button key={i.id} className="coming-item" onClick={() => onOpen(i)}>
            <span className="kind-tile" style={kindStyle(i.kind)}>{KIND_CODE[i.kind]}</span>
            <span className="coming-main">
              <strong>{i.title}</strong>
              <small>
                {sameDay(i.start, new Date()) ? 'Today' : sameDay(i.start, addDays(new Date(), 1)) ? 'Tomorrow' : i.start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                {i.allDay ? '' : ` · ${fmtTime(i.start)}`}
              </small>
            </span>
            <span className="badge badge-gray" style={kindStyle(i.kind)}><span className="kind-dot" />{KIND_LABEL[i.kind]}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export interface Need {
  id: string
  icon: ReactNode
  title: string
  sub: string
  alert?: boolean
  actions?: ReactNode
}

export function NeedsYou({ items, empty = 'You’re all caught up.' }: { items: Need[]; empty?: string }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, 4)
  return (
    <Card title="Needs you" actions={items.length > 0 && <span className="count-badge">{items.length}</span>}>
      {items.length === 0 ? (
        <Empty title={empty} />
      ) : (
        <div className="needs">
          {shown.map((n) => (
            <div key={n.id} className="need">
              <span className={`need-icon ${n.alert ? 'alert-tone' : ''}`}>{n.icon}</span>
              <div className="need-main">
                <strong>{n.title}</strong>
                <small>{n.sub}</small>
                {n.actions && <div className="need-actions">{n.actions}</div>}
              </div>
            </div>
          ))}
          {items.length > 4 && (
            <button className="chip" style={{ alignSelf: 'center', marginTop: 8 }} onClick={() => setAll(!all)}>
              <ChevronDown size={14} style={{ transform: all ? 'rotate(180deg)' : undefined }} /> {all ? 'Show less' : `Show ${items.length - 4} more`}
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

export function WeekAhead({ items, calendarTo, footer }: { items: AgendaItem[]; calendarTo: string; footer?: (d: Date, list: AgendaItem[]) => string }) {
  const go = useNavigate()
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <Card title="The week ahead" actions={<Link className="btn btn-secondary btn-sm" to={calendarTo}><CalendarRange size={14} /><span>Calendar</span></Link>}>
      <div className="week">
        {days.map((d, idx) => {
          const list = items.filter((i) => overlapsDay(i, d))
          return (
            <button key={d.toISOString()} className={`week-day ${idx === 0 ? 'today' : ''}`} onClick={() => go(calendarTo)}>
              <div className="week-day-head">
                <span>{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <strong>{d.getDate()}</strong>
              </div>
              {list.slice(0, 3).map((i) => (
                <span key={i.id} className="wchip" style={kindStyle(i.kind)} title={i.title}>
                  <span>{i.allDay ? i.title : fmtTime(i.start)}</span>
                  <span className="wcode">{KIND_CODE[i.kind]}</span>
                </span>
              ))}
              {list.length > 3 && <span className="wmore">+{list.length - 3}</span>}
              <span className="week-day-foot">{footer ? footer(d, list) : `${list.length} item${list.length === 1 ? '' : 's'}`}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

export function Pulse({ code, name, value, valueLabel, pct, trend, sub }: { code: string; name: string; value: string; valueLabel?: string; pct: number; trend?: number; sub?: string }) {
  return (
    <div className="pulse-row">
      <span className="pulse-icon">{code}</span>
      <div className="pulse-main">
        <div className="pulse-top">
          <span className="ellipsis">{name}</span>
          <span>{value}{valueLabel && <span className="muted"> {valueLabel}</span>}</span>
        </div>
        <div className="progress"><div className="progress-bar tone-bg-ink" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} /></div>
      </div>
      <div className="pulse-side">
        {trend !== undefined && <strong className={trend >= 0 ? 'text-green' : 'text-red'}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</strong>}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  )
}
