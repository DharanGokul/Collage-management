import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Send, ArrowLeft, MessageSquareText, AlertTriangle, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Stat } from '../../components/ui'
import { gsap, prefersReducedMotion } from '../../components/motion'
import { formatDate, uid } from '../../lib/utils'
import type { Ticket, TicketStatus } from '../../types'

const STATUS: Record<TicketStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'gray' }> = {
  open: { label: 'Open', tone: 'amber' },
  in_progress: { label: 'In progress', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
  closed: { label: 'Closed', tone: 'gray' },
}
const PRIORITY_TONE = { low: 'gray', normal: 'gray', high: 'amber', urgent: 'red' } as const
const CATEGORIES: Ticket['category'][] = ['academics', 'exams', 'fees', 'attendance', 'facilities', 'hostel', 'transport', 'conduct', 'other']
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return formatDate(iso, { day: 'numeric', month: 'short' })
}

export default function HelpDesk() {
  const { db, session, update } = useStore()
  const [params, setParams] = useSearchParams()
  const isAdmin = session?.role === 'admin'
  const [status, setStatus] = useState<'all' | 'active' | TicketStatus>('active')
  const [kind, setKind] = useState<'all' | Ticket['kind']>('all')
  const [q, setQ] = useState('')
  const [composeKind, setComposeKind] = useState<Ticket['kind'] | null>(null)
  const selectedId = params.get('t')

  useEffect(() => {
    const n = params.get('new')
    if (n === 'query' || n === 'complaint') {
      setComposeKind(n)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const mine = useMemo(() => (isAdmin ? db.tickets : db.tickets.filter((t) => t.from.userId === session?.userId)), [db.tickets, isAdmin, session])
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const rank = { urgent: 0, high: 1, normal: 2, low: 3 }
    return mine
      .filter((x) => (status === 'all' ? true : status === 'active' ? x.status === 'open' || x.status === 'in_progress' : x.status === status))
      .filter((x) => kind === 'all' || x.kind === kind)
      .filter((x) => !t || x.subject.toLowerCase().includes(t) || x.ref.toLowerCase().includes(t) || (!x.anonymous && x.from.name.toLowerCase().includes(t)))
      .sort((a, b) => Number(isAdmin ? b.unreadByAdmin : b.unreadByRequester) - Number(isAdmin ? a.unreadByAdmin : a.unreadByRequester) || (isAdmin ? rank[a.priority] - rank[b.priority] : 0) || b.updatedAt.localeCompare(a.updatedAt))
  }, [mine, status, kind, q, isAdmin])

  const selected = mine.find((t) => t.id === selectedId)
  const select = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('t', id)
    else p.delete('t')
    setParams(p, { replace: true })
  }

  // Opening a ticket marks it read for the viewer.
  useEffect(() => {
    if (!selected) return
    if (isAdmin ? selected.unreadByAdmin : selected.unreadByRequester)
      update((d) => {
        const t = d.tickets.find((x) => x.id === selected.id)
        if (t) {
          if (isAdmin) t.unreadByAdmin = false
          else t.unreadByRequester = false
        }
      })
  }, [selected, isAdmin, update])

  if (!session) return null
  const openCount = mine.filter((t) => t.status === 'open').length
  const progress = mine.filter((t) => t.status === 'in_progress').length
  const resolved = mine.filter((t) => t.status === 'resolved' || t.status === 'closed').length
  const urgent = mine.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && (t.status === 'open' || t.status === 'in_progress')).length

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Help desk' : 'Queries & complaints'}
        subtitle={isAdmin ? 'Queries and complaints from students and staff' : 'Ask the administration anything, or report a problem'}
        actions={
          !isAdmin && (
            <>
              <Button variant="secondary" icon={<AlertTriangle size={16} />} onClick={() => setComposeKind('complaint')}>File a complaint</Button>
              <Button icon={<Plus size={16} />} onClick={() => setComposeKind('query')}>Raise a query</Button>
            </>
          )
        }
      />
      <div className="grid stats-grid">
        <Stat label="Open" value={openCount} icon={<MessageSquareText size={20} />} tone="amber" />
        <Stat label="In progress" value={progress} icon={<RotateCcw size={20} />} tone="blue" />
        <Stat label={isAdmin ? 'High priority' : 'Awaiting you'} value={isAdmin ? urgent : mine.filter((t) => t.unreadByRequester).length} icon={<ShieldAlert size={20} />} tone="red" />
        <Stat label="Resolved" value={resolved} icon={<CheckCircle2 size={20} />} tone="green" />
      </div>

      <Card pad={false}>
        <div className={`inbox ${selected ? 'has-detail' : ''}`}>
          <div className="inbox-list">
            <div className="toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="search" style={{ maxWidth: 'none' }}>
                <Search size={16} />
                <input className="input" placeholder="Search subject, ref, name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tickets" />
              </div>
              <div className="chip-scroll">
                {(['active', 'open', 'in_progress', 'resolved', 'closed', 'all'] as const).map((s) => (
                  <button key={s} className={`chip sm ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s === 'active' ? 'Active' : s === 'all' ? 'All' : STATUS[s].label}</button>
                ))}
              </div>
              <div className="chip-scroll">
                {(['all', 'query', 'complaint'] as const).map((k) => (
                  <button key={k} className={`chip sm ${kind === k ? 'active' : ''}`} onClick={() => setKind(k)}>{k === 'all' ? 'Queries & complaints' : k === 'query' ? 'Queries' : 'Complaints'}</button>
                ))}
              </div>
            </div>
            <div className="inbox-items">
              {list.length === 0 && <Empty icon={<MessageSquareText />} title="Nothing here">{isAdmin ? 'No tickets match these filters.' : 'Raise a query and the office will reply here.'}</Empty>}
              {list.map((t) => {
                const unread = isAdmin ? t.unreadByAdmin : t.unreadByRequester
                const last = t.messages[t.messages.length - 1]
                return (
                  <button key={t.id} className={`tk ${selected?.id === t.id ? 'active' : ''}`} onClick={() => select(t.id)}>
                    <span className={`tk-unread ${unread ? '' : 'off'}`} aria-label={unread ? 'Unread' : undefined} />
                    <span className="tk-main">
                      <span className="tk-top">
                        <strong>{isAdmin ? (t.anonymous ? `Anonymous ${t.from.role}` : t.from.name) : t.ref}</strong>
                        <span className="muted">· {ago(t.updatedAt)}</span>
                      </span>
                      <span className="tk-subject" style={unread ? { fontWeight: 800 } : undefined}>{t.subject}</span>
                      <span className="muted tiny ellipsis">{last.by === 'admin' ? 'Office: ' : ''}{last.text}</span>
                      <span className="row gap-s" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                        <Badge tone={t.kind === 'complaint' ? 'red' : 'gray'}>{t.kind === 'complaint' ? 'Complaint' : 'Query'}</Badge>
                        {(t.priority === 'urgent' || t.priority === 'high') && <Badge tone={PRIORITY_TONE[t.priority]}>{cap(t.priority)}</Badge>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="tk-detail">
            {selected ? <TicketThread key={selected.id} ticket={selected} onBack={() => select(null)} /> : <Empty icon={<MessageSquareText />} title="Select a conversation">Pick a ticket on the left to read and reply.</Empty>}
          </div>
        </div>
      </Card>
      {composeKind && <NewTicket kind={composeKind} onClose={() => setComposeKind(null)} onCreated={(id) => { setComposeKind(null); setStatus('active'); select(id) }} />}
    </>
  )
}

function TicketThread({ ticket, onBack }: { ticket: Ticket; onBack: () => void }) {
  const { db, session, update, toast, sendBulkEmail } = useStore()
  const isAdmin = session?.role === 'admin'
  const [text, setText] = useState('')
  const [emailToo, setEmailToo] = useState(true)
  const threadRef = useRef<HTMLDivElement>(null)
  const count = ticket.messages.length

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    const last = el.lastElementChild
    if (last && !prefersReducedMotion()) gsap.from(last, { y: 10, autoAlpha: 0, duration: 0.25, ease: 'power2.out', clearProps: 'all' })
  }, [count])

  const requesterEmail = ticket.from.role === 'student' ? db.students.find((s) => s.id === ticket.from.userId)?.email : db.staff.find((s) => s.id === ticket.from.userId)?.email

  const send = async (resolve = false) => {
    const body = text.trim()
    if (!body && !resolve) return
    update((d) => {
      const t = d.tickets.find((x) => x.id === ticket.id)
      if (!t) return
      const at = new Date().toISOString()
      if (body) t.messages.push({ id: uid('m'), by: isAdmin ? 'admin' : 'requester', name: isAdmin ? 'Administrator' : (session?.name ?? ''), text: body, at })
      t.updatedAt = at
      if (isAdmin) {
        t.unreadByRequester = true
        t.status = resolve ? 'resolved' : t.status === 'open' ? 'in_progress' : t.status
      } else {
        t.unreadByAdmin = true
        if (resolve) t.status = 'resolved'
        else if (t.status === 'resolved' || t.status === 'closed') t.status = 'open' // a reply reopens it
      }
    })
    setText('')
    if (isAdmin && emailToo && body && requesterEmail) {
      await sendBulkEmail({ recipients: [{ email: requesterEmail, vars: { name: ticket.from.name } }], subject: `Re: ${ticket.subject} [${ticket.ref}]`, body: `Dear {{name}},\n\n${body}\n\nView the conversation in your portal: {{portal_url}}\n\nRegards,\n{{college_name}}` })
    }
    toast(resolve ? 'Marked as resolved' : 'Reply sent')
  }

  const setField = <K extends 'status' | 'priority'>(k: K, v: Ticket[K]) => {
    update((d) => {
      const t = d.tickets.find((x) => x.id === ticket.id)
      if (t) {
        t[k] = v
        t.updatedAt = new Date().toISOString()
        if (k === 'status') t.unreadByRequester = true
      }
    })
    toast(k === 'status' ? `Status: ${STATUS[v as TicketStatus].label}` : `Priority: ${cap(v as string)}`)
  }

  const fromLabel = ticket.anonymous ? `Anonymous ${ticket.from.role}` : ticket.from.name
  return (
    <>
      <div className="tk-head">
        <div className="row gap-s">
          <button className="icon-btn" aria-label="Back to list" onClick={onBack}><ArrowLeft size={18} /></button>
          <span className="spec">{ticket.ref} · {cap(ticket.category)}</span>
          <span className="spacer" />
          <Badge tone={STATUS[ticket.status].tone}>{STATUS[ticket.status].label}</Badge>
        </div>
        <h3 style={{ fontSize: 20 }}>{ticket.subject}</h3>
        <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
          <Avatar name={fromLabel} size={28} />
          <span className="tiny">{isAdmin ? fromLabel : 'You'} · {ticket.from.role} · {formatDate(ticket.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          <Badge tone={ticket.kind === 'complaint' ? 'red' : 'gray'}>{ticket.kind === 'complaint' ? 'Complaint' : 'Query'}</Badge>
          {ticket.anonymous && <Badge tone="gray">Anonymous</Badge>}
        </div>
        {isAdmin && (
          <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
            <select className="input sm" value={ticket.status} onChange={(e) => setField('status', e.target.value as TicketStatus)} aria-label="Status">
              {(Object.keys(STATUS) as TicketStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
            <select className="input sm" value={ticket.priority} onChange={(e) => setField('priority', e.target.value as Ticket['priority'])} aria-label="Priority">
              {(['low', 'normal', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{cap(p)} priority</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="thread" ref={threadRef} aria-live="polite">
        {ticket.messages.map((m) => {
          const minee = (m.by === 'admin') === !!isAdmin
          return (
            <div key={m.id} className={`bubble ${minee ? 'mine' : ''}`}>
              <small>{m.by === 'admin' ? 'Administration' : ticket.anonymous && isAdmin ? 'Anonymous' : m.name} · {ago(m.at)}</small>
              <p>{m.text}</p>
            </div>
          )
        })}
      </div>
      <div className="composer">
        {ticket.status === 'closed' && !isAdmin ? (
          <p className="muted tiny">This ticket is closed. Raise a new query if you need more help.</p>
        ) : (
          <>
            <textarea className="input" rows={3} placeholder={isAdmin ? 'Write a reply…' : 'Add a message…'} value={text} onChange={(e) => setText(e.target.value)} aria-label="Message" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send()} />
            <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
              {isAdmin && requesterEmail && <label className="checkbox tiny"><input type="checkbox" checked={emailToo} onChange={(e) => setEmailToo(e.target.checked)} /> Also email the reply</label>}
              <span className="spacer" />
              {(ticket.status === 'open' || ticket.status === 'in_progress') && <Button variant="secondary" size="sm" icon={<CheckCircle2 size={14} />} onClick={() => send(true)}>{isAdmin ? 'Reply & resolve' : 'Mark resolved'}</Button>}
              <Button size="sm" icon={<Send size={14} />} disabled={!text.trim()} onClick={() => send()}>Send</Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function NewTicket({ kind: initialKind, onClose, onCreated }: { kind: Ticket['kind']; onClose: () => void; onCreated: (id: string) => void }) {
  const { db, session, update, toast } = useStore()
  const [kind, setKind] = useState(initialKind)
  const [category, setCategory] = useState<Ticket['category']>(initialKind === 'complaint' ? 'facilities' : 'academics')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<Ticket['priority']>('normal')
  const [anonymous, setAnonymous] = useState(false)
  const [touched, setTouched] = useState(false)
  const errors = { subject: subject.trim().length < 5 ? 'Write a short subject (5+ characters)' : null, body: body.trim().length < 10 ? 'Describe it in a sentence or two' : null }
  const submit = () => {
    setTouched(true)
    if (!session || errors.subject || errors.body) return
    const n = Math.max(1040, ...db.tickets.map((t) => +t.ref.replace(/\D/g, '') || 0)) + 1
    const now = new Date().toISOString()
    const id = uid('tkt')
    update((d) => {
      d.tickets.unshift({
        id, ref: `Q-${n}`, kind, category, subject: subject.trim(), priority, status: 'open', anonymous: kind === 'complaint' && anonymous,
        from: { role: session.role as 'student' | 'staff', userId: session.userId, name: session.name }, createdAt: now, updatedAt: now,
        messages: [{ id: uid('m'), by: 'requester', name: session.name, text: body.trim(), at: now }], unreadByAdmin: true, unreadByRequester: false,
      })
    })
    toast(`${kind === 'complaint' ? 'Complaint' : 'Query'} Q-${n} submitted`)
    onCreated(id)
  }
  return (
    <Modal open title={kind === 'complaint' ? 'File a complaint' : 'Raise a query'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Send size={16} />} onClick={submit}>Submit</Button></>}>
      <div className="segmented" role="radiogroup" aria-label="Type">
        <button role="radio" aria-checked={kind === 'query'} className={kind === 'query' ? 'active' : ''} onClick={() => setKind('query')}><MessageSquareText size={16} /> Query</button>
        <button role="radio" aria-checked={kind === 'complaint'} className={kind === 'complaint' ? 'active' : ''} onClick={() => setKind('complaint')}><AlertTriangle size={16} /> Complaint</button>
      </div>
      <div className="form-grid">
        <Field label="Category">{(id) => <select id={id} className="input" value={category} onChange={(e) => setCategory(e.target.value as Ticket['category'])}>{CATEGORIES.map((c) => <option key={c} value={c}>{cap(c)}</option>)}</select>}</Field>
        <Field label="Priority">{(id) => <select id={id} className="input" value={priority} onChange={(e) => setPriority(e.target.value as Ticket['priority'])}>{(['low', 'normal', 'high', 'urgent'] as const).map((p) => <option key={p} value={p}>{cap(p)}</option>)}</select>}</Field>
        <Field label="Subject" span={2} error={touched ? errors.subject : null}>{(id) => <input id={id} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus maxLength={120} />}</Field>
        <Field label="Details" span={2} error={touched ? errors.body : null}>{(id) => <textarea id={id} className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
      </div>
      {kind === 'complaint' && (
        <label className="checkbox"><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Submit anonymously — the administration won’t see your name</label>
      )}
    </Modal>
  )
}
