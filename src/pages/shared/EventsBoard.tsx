import { useMemo, useState } from 'react'
import { MapPin, CalendarClock, PartyPopper } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { useNow } from '../../lib/useNow'
import { Button, Empty, PageHeader, Progress, Tabs } from '../../components/ui'
import { EventDetail, KindBadge, useRegistration, whenText } from './eventsUi'
import { canRegister, canSee, eventRange, myRegistration, registeredCount } from '../../lib/agenda'
import type { CampusEvent } from '../../types'

type Tab = 'open' | 'upcoming' | 'mine' | 'exams'

/** Students & staff: browse events visible to them and apply. */
export default function EventsBoard() {
  const { db, session } = useStore()
  const { register, cancel } = useRegistration()
  const [tab, setTab] = useState<Tab>('open')
  const [viewing, setViewing] = useState<CampusEvent | null>(null)
  const now = useNow()

  const visible = useMemo(() => (session ? db.events.filter((e) => canSee(db, session, e) && eventRange(e).end >= new Date(now)) : []), [db, session, now])
  if (!session) return null
  const lists: Record<Tab, CampusEvent[]> = {
    open: visible.filter((e) => e.registration.enabled && canRegister(db, session, e).ok),
    upcoming: visible.filter((e) => e.kind !== 'exam'),
    mine: visible.filter((e) => myRegistration(e, session)),
    exams: visible.filter((e) => e.kind === 'exam'),
  }
  const list = [...lists[tab]].sort((a, b) => a.start.localeCompare(b.start))
  const tabs: { id: Tab; label: string }[] = [
    { id: 'open', label: `Open to apply (${lists.open.length})` },
    { id: 'mine', label: `My registrations (${lists.mine.length})` },
    { id: 'upcoming', label: 'All upcoming' },
  ]
  if (lists.exams.length) tabs.push({ id: 'exams', label: `${session.role === 'staff' ? 'Exams I teach' : 'My exams'} (${lists.exams.length})` })

  return (
    <>
      <PageHeader title="Events" subtitle="Fests, workshops, talks and exams for you" />
      <Tabs value={tab} onChange={setTab} items={tabs} />
      {list.length === 0 ? (
        <Empty icon={<PartyPopper />} title={tab === 'mine' ? 'You haven’t applied for anything yet' : 'Nothing here right now'}>
          {tab === 'mine' ? 'Browse “Open to apply” to register.' : 'New events will show up here and on your calendar.'}
        </Empty>
      ) : (
        <div className="event-grid">
          {list.map((e) => {
            const { start } = eventRange(e)
            const mine = myRegistration(e, session)
            const ok = canRegister(db, session, e)
            const n = registeredCount(e)
            const cap = e.registration.capacity
            return (
              <article key={e.id} className="event-card">
                <div className="event-date">
                  <div className="event-date-block">
                    <small>{start.toLocaleDateString(undefined, { month: 'short' })}</small>
                    <strong>{start.getDate()}</strong>
                    <small>{start.toLocaleDateString(undefined, { weekday: 'short' })}</small>
                  </div>
                  <div className="event-date-meta">
                    <KindBadge kind={e.kind} />
                    <h3 style={{ fontSize: 17 }}>{e.title}</h3>
                  </div>
                </div>
                <div className="event-card-body">
                  <span className="row gap-s tiny"><CalendarClock size={14} className="muted" /> {whenText(e)}</span>
                  {e.location && <span className="row gap-s tiny"><MapPin size={14} className="muted" /> {e.location}</span>}
                  {e.description && <p className="muted tiny clamp">{e.description}</p>}
                  {e.registration.enabled && (
                    <div className="stack-s" style={{ gap: 4 }}>
                      <span className="tiny muted">{n} going{cap ? ` · ${Math.max(0, cap - n)} seats left` : ''}</span>
                      {cap ? <Progress value={Math.round((n / cap) * 100)} tone={n >= cap ? 'red' : n / cap > 0.8 ? 'amber' : 'green'} /> : null}
                    </div>
                  )}
                </div>
                <div className="event-card-foot">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(e)}>Details</Button>
                  <span className="spacer" />
                  {e.registration.enabled &&
                    (mine ? (
                      <>
                        <span className={`badge ${mine.status === 'registered' ? 'badge-green' : 'badge-amber'}`}>{mine.status === 'registered' ? 'Registered' : 'Waitlisted'}</span>
                        <Button size="sm" variant="secondary" onClick={() => cancel(e)}>Cancel</Button>
                      </>
                    ) : (
                      <Button size="sm" disabled={!ok.ok} onClick={() => register(e)}>{ok.ok ? (cap && n >= cap ? 'Join waitlist' : 'Apply') : ok.reason || 'Closed'}</Button>
                    ))}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
