import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, FilePlus2, Search, Eye, Pencil, PartyPopper, Download } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, PageHeader, Pager, Stat, Tabs, usePaged } from '../../components/ui'
import { EventDetail, EventForm, KindBadge, blankEvent, whenText } from '../shared/eventsUi'
import { eventRange, registeredCount } from '../../lib/agenda'
import { classLabel, downloadCSV } from '../../lib/utils'
import type { CampusEvent, EventKind } from '../../types'

type Tab = 'upcoming' | 'exams' | 'registrations' | 'past'

export default function Events() {
  const { db } = useStore()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>('upcoming')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<CampusEvent | null>(null)
  const [viewing, setViewing] = useState<CampusEvent | null>(null)

  // Deep links from the Create menu: ?new=event | ?new=exam
  useEffect(() => {
    const n = params.get('new')
    if (n === 'event' || n === 'exam') {
      setEditing(blankEvent(n as EventKind))
      setTab(n === 'exam' ? 'exams' : 'upcoming')
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const now = new Date()
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.events
      .filter((e) => {
        const { start, end } = eventRange(e)
        if (t && !e.title.toLowerCase().includes(t) && !e.location.toLowerCase().includes(t)) return false
        if (tab === 'past') return end < now
        if (end < now) return false
        if (tab === 'exams') return e.kind === 'exam'
        if (tab === 'registrations') return e.registration.enabled && start > now
        return e.kind !== 'exam'
      })
      .sort((a, b) => (tab === 'past' ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.events, tab, q])
  const paged = usePaged(rows, 20)

  const upcoming = db.events.filter((e) => eventRange(e).end >= now)
  const regs = upcoming.reduce((a, e) => a + registeredCount(e), 0)

  return (
    <>
      <PageHeader
        title="Events & exams"
        subtitle="Everything here appears on the calendar of the people it is for"
        actions={
          <>
            <Button variant="secondary" icon={<FilePlus2 size={16} />} onClick={() => setEditing(blankEvent('exam'))}>Schedule exam</Button>
            <Button icon={<Plus size={16} />} onClick={() => setEditing(blankEvent('event'))}>New event</Button>
          </>
        }
      />
      <div className="grid stats-grid">
        <Stat label="Upcoming events" value={upcoming.filter((e) => e.kind !== 'exam').length} icon={<PartyPopper size={20} />} />
        <Stat label="Exams scheduled" value={upcoming.filter((e) => e.kind === 'exam').length} icon={<FilePlus2 size={20} />} tone="primary" />
        <Stat label="Taking registrations" value={upcoming.filter((e) => e.registration.enabled).length} icon={<PartyPopper size={20} />} tone="blue" />
        <Stat label="People registered" value={regs} icon={<PartyPopper size={20} />} tone="green" hint="across upcoming events" />
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'upcoming', label: 'Upcoming events' },
          { id: 'exams', label: 'Exams' },
          { id: 'registrations', label: 'Open for registration' },
          { id: 'past', label: 'Past' },
        ]}
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search title or location…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
          </div>
          <span className="spacer" />
          <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => downloadCSV('events.csv', [['Title', 'Type', 'Start', 'End', 'Location', 'Audience', 'Classes', 'Registered', 'Capacity'], ...rows.map((e) => [e.title, e.kind, e.start, e.end, e.location, e.audience, e.classKeys.join(' '), registeredCount(e), e.registration.capacity ?? ''])])}>Export</Button>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<PartyPopper />} title="Nothing here yet">Create an event or schedule an exam.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Event</th><th>When</th><th className="hide-sm">For</th><th>Registrations</th><th className="right">Actions</th></tr>
              </thead>
              <tbody>
                {paged.items.map((e) => {
                  const n = registeredCount(e)
                  return (
                    <tr key={e.id}>
                      <td>
                        <div className="stack-s" style={{ gap: 4 }}>
                          <strong>{e.title}</strong>
                          <span className="row gap-s"><KindBadge kind={e.kind} />{e.location && <span className="muted tiny ellipsis">{e.location}</span>}</span>
                        </div>
                      </td>
                      <td className="tiny">{whenText(e)}</td>
                      <td className="tiny hide-sm">{e.audience === 'staff' ? 'Staff' : e.classKeys.length ? e.classKeys.map(classLabel).join(', ') : e.audience === 'all' ? 'Everyone' : 'All students'}</td>
                      <td>{e.registration.enabled ? <Badge tone={e.registration.capacity && n >= e.registration.capacity ? 'red' : 'blue'}>{n}{e.registration.capacity ? ` / ${e.registration.capacity}` : ''}</Badge> : <span className="muted tiny">—</span>}</td>
                      <td className="right nowrap">
                        <button className="icon-btn" aria-label={`View ${e.title}`} onClick={() => setViewing(e)}><Eye size={16} /></button>
                        <button className="icon-btn" aria-label={`Edit ${e.title}`} onClick={() => setEditing(e)}><Pencil size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager {...paged} />
      </Card>
      {viewing && <EventDetail event={viewing} onClose={() => setViewing(null)} onEdit={(e) => { setViewing(null); setEditing(e) }} />}
      {editing && <EventForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
