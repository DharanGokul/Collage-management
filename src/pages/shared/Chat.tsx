import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Plus, Send, ArrowLeft, Users, Megaphone, Lock, MessagesSquare, Check } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader, Segmented } from '../../components/ui'
import { gsap, prefersReducedMotion } from '../../components/motion'
import { classLabel, studentClassKey, uid } from '../../lib/utils'
import { canPost, chatTitle, directContacts, displayName, isHod, isMember, memberKey, photoOf, roleLabel, sessionMember, unreadCount } from '../../lib/workflow'
import type { Chat, ChatMember } from '../../types'

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const dayOf = (iso: string) => {
  const d = new Date(iso)
  const t = new Date()
  const y = new Date(t)
  y.setDate(t.getDate() - 1)
  if (d.toDateString() === t.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}
const shortTime = (iso: string) => (new Date(iso).toDateString() === new Date().toDateString() ? timeOf(iso) : new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))

export default function ChatPage() {
  const { db, session } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'group' | 'direct'>('all')
  const [creating, setCreating] = useState<null | 'direct' | 'group'>(null)
  const selectedId = params.get('c')

  useEffect(() => {
    const n = params.get('new')
    if (n === 'direct' || n === 'group') {
      // oxlint-disable-next-line react/set-state-in-effect -- one-shot sync of the ?new= URL param into local UI state, then the param is cleared
      setCreating(n)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const mine = useMemo(() => (session ? db.chats.filter((c) => isMember(c, session)) : []), [db.chats, session])
  const list = useMemo(() => {
    if (!session) return []
    const t = q.trim().toLowerCase()
    return mine
      .filter((c) => filter === 'all' || c.kind === filter)
      .filter((c) => !t || chatTitle(db, c, session).toLowerCase().includes(t) || c.messages.some((m) => m.text.toLowerCase().includes(t)))
      .sort((a, b) => (b.messages.at(-1)?.at ?? b.createdAt).localeCompare(a.messages.at(-1)?.at ?? a.createdAt))
  }, [mine, filter, q, db, session])

  if (!session) return null
  const selected = mine.find((c) => c.id === selectedId)
  const select = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('c', id)
    else p.delete('c')
    setParams(p, { replace: true })
  }
  const canGroup = session.role !== 'student'
  const unread = mine.reduce((a, c) => a + unreadCount(c, session), 0)

  return (
    <>
      <PageHeader
        title="Chat"
        subtitle={session.role === 'student' ? 'Your class group and messages with teachers' : session.role === 'admin' ? 'Talk to staff, HODs, accounts and classes' : 'Class groups, department and direct messages'}
        actions={
          <>
            {canGroup && <Button variant="secondary" icon={<Users size={16} />} onClick={() => setCreating('group')}>New group</Button>}
            <Button icon={<Plus size={16} />} onClick={() => setCreating('direct')}>New message</Button>
          </>
        }
      />
      <Card pad={false}>
        <div className={`inbox chat-layout ${selected ? 'has-detail' : ''}`}>
          <div className="inbox-list">
            <div className="toolbar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="search" style={{ maxWidth: 'none' }}>
                <Search size={16} />
                <input className="input" placeholder="Search chats and messages…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search chats" />
              </div>
              <Segmented label="Filter chats" value={filter} onChange={setFilter} options={[{ id: 'all', label: `All${unread ? ` · ${unread}` : ''}` }, { id: 'group', label: 'Groups' }, { id: 'direct', label: 'Direct' }]} />
            </div>
            <div className="inbox-items">
              {list.length === 0 && <Empty icon={<MessagesSquare />} title="No conversations">Start one with “New message”.</Empty>}
              {list.map((c) => {
                const last = c.messages.at(-1)
                const n = unreadCount(c, session)
                const other = c.kind === 'direct' ? c.members.find((m) => memberKey(m) !== memberKey(sessionMember(session))) : undefined
                return (
                  <button key={c.id} className={`tk chat-item ${selected?.id === c.id ? 'active' : ''}`} onClick={() => select(c.id)}>
                    <span className="chat-ava">
                      {other ? <Avatar name={displayName(db, other)} src={photoOf(db, other)} size={42} /> : <span className="group-ava">{c.announceOnly ? <Megaphone size={18} /> : <Users size={18} />}</span>}
                    </span>
                    <span className="tk-main">
                      <span className="tk-top">
                        <strong style={n ? { fontWeight: 800 } : undefined}>{chatTitle(db, c, session)}</strong>
                        <span className="spacer" />
                        {last && <span className="muted">{shortTime(last.at)}</span>}
                      </span>
                      <span className="row gap-s" style={{ flexWrap: 'nowrap' }}>
                        <span className="muted tiny ellipsis" style={{ flex: 1 }}>
                          {last ? `${c.kind === 'group' && memberKey(last.from) !== memberKey(sessionMember(session)) ? last.from.name.replace(/^(Dr|Prof|Ms|Mr|Mrs)\.\s*/i, '').split(' ')[0] + ': ' : memberKey(last.from) === memberKey(sessionMember(session)) ? 'You: ' : ''}${last.text}` : c.topic || 'No messages yet'}
                        </span>
                        {n > 0 && <span className="count-badge" style={{ minWidth: 22, height: 22, fontSize: 11 }}>{n}</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="tk-detail">
            {selected ? <Thread key={selected.id} chat={selected} onBack={() => select(null)} /> : <Empty icon={<MessagesSquare />} title="Select a conversation">Messages update live across your open tabs.</Empty>}
          </div>
        </div>
      </Card>
      {creating && <NewChat mode={creating} onClose={() => setCreating(null)} onOpen={(id) => { setCreating(null); select(id) }} />}
    </>
  )
}

function Thread({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const { db, session, update } = useStore()
  const [text, setText] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const count = chat.messages.length
  const meKey = session ? `${session.role}:${session.userId}` : ''

  // Mark as read whenever the thread is open and something new arrives.
  useEffect(() => {
    if (!session || !count) return
    const last = chat.messages[count - 1].at
    if ((chat.reads[meKey] ?? '') >= last) return
    update((d) => {
      const c = d.chats.find((x) => x.id === chat.id)
      if (c) c.reads[meKey] = new Date().toISOString()
    })
  }, [count, chat.id, chat.messages, chat.reads, meKey, session, update])

  // Keep pinned to the newest message; animate it in.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    const lastEl = el.lastElementChild
    if (lastEl && !prefersReducedMotion()) gsap.from(lastEl, { y: 12, autoAlpha: 0, scale: 0.98, duration: 0.3, ease: 'back.out(1.6)', clearProps: 'all' })
  }, [count])

  if (!session) return null
  const me = sessionMember(session)
  const allowed = canPost(chat, session)
  const title = chatTitle(db, chat, session)
  const other = chat.kind === 'direct' ? chat.members.find((m) => memberKey(m) !== meKey) : undefined

  const send = () => {
    const body = text.trim()
    if (!body || !allowed) return
    const at = new Date().toISOString()
    update((d) => {
      const c = d.chats.find((x) => x.id === chat.id)
      if (!c) return
      c.messages.push({ id: uid('cm'), from: { ...me, name: displayName(d, me) }, text: body, at })
      c.reads[meKey] = at
      const others = c.members.map(memberKey).filter((k) => k !== meKey)
      const sender = displayName(d, me)
      notify(d, others, { kind: 'chat', important: false, title: c.kind === 'group' ? `${sender} in ${c.name}` : sender, body: body.length > 140 ? body.slice(0, 140) + '…' : body, link: (to) => `/${to.split(':')[0]}/chat?c=${c.id}` })
    })
    setText('')
  }

  // Day separators
  const rows: ({ type: 'day'; label: string } | { type: 'msg'; m: Chat['messages'][number]; first: boolean })[] = []
  let lastDay = ''
  let lastFrom = ''
  for (const m of chat.messages) {
    const dLabel = dayOf(m.at)
    if (dLabel !== lastDay) {
      rows.push({ type: 'day', label: dLabel })
      lastDay = dLabel
      lastFrom = ''
    }
    rows.push({ type: 'msg', m, first: memberKey(m.from) !== lastFrom })
    lastFrom = memberKey(m.from)
  }
  const myLast = [...chat.messages].reverse().find((m) => memberKey(m.from) === meKey)
  const seenBy = myLast ? chat.members.filter((mm) => memberKey(mm) !== meKey && (chat.reads[memberKey(mm)] ?? '') >= myLast.at).length : 0

  return (
    <>
      <div className="tk-head chat-head">
        <div className="row gap-s" style={{ flexWrap: 'nowrap' }}>
          <button className="icon-btn" aria-label="Back to chats" onClick={onBack}><ArrowLeft size={18} /></button>
          {other ? <Avatar name={displayName(db, other)} src={photoOf(db, other)} size={40} /> : <span className="group-ava">{chat.announceOnly ? <Megaphone size={18} /> : <Users size={18} />}</span>}
          <div className="stack-s" style={{ gap: 0, minWidth: 0, flex: 1 }}>
            <h3 className="ellipsis" style={{ fontSize: 17 }}>{title}</h3>
            <span className="muted tiny ellipsis">{other ? roleLabel(db, other) : `${chat.members.length} members${chat.topic ? ` · ${chat.topic}` : ''}`}</span>
          </div>
          {chat.kind === 'group' && <Button size="sm" variant="secondary" icon={<Users size={14} />} onClick={() => setShowMembers(true)}>Members</Button>}
        </div>
      </div>
      <div className="thread" ref={scroller} aria-live="polite">
        {rows.length === 0 && <p className="muted tiny center">No messages yet — say hello 👋</p>}
        {rows.map((r, i) =>
          r.type === 'day' ? (
            <div key={`d${i}`} className="day-sep"><span>{r.label}</span></div>
          ) : (
            <MessageRow key={r.m.id} m={r.m} mine={memberKey(r.m.from) === meKey} showName={chat.kind === 'group' && r.first} />
          ),
        )}
        {myLast && seenBy > 0 && <div className="seen"><Check size={12} /> Seen{chat.kind === 'group' ? ` by ${seenBy}` : ''}</div>}
      </div>
      <div className="composer">
        {allowed ? (
          <div className="row gap-s" style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}>
            <textarea
              className="input"
              rows={1}
              placeholder="Type a message…"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              aria-label="Message"
              style={{ resize: 'none' }}
            />
            <Button icon={<Send size={16} />} disabled={!text.trim()} onClick={send} aria-label="Send">Send</Button>
          </div>
        ) : (
          <p className="muted tiny row gap-s"><Lock size={14} /> Only group admins can post here.</p>
        )}
      </div>
      {showMembers && (
        <Modal open title={`${chat.name} · ${chat.members.length} members`} onClose={() => setShowMembers(false)}>
          <ul className="member-list">
            {chat.members.map((m) => (
              <li key={memberKey(m)}>
                <Avatar name={displayName(db, m)} src={photoOf(db, m)} size={34} />
                <span className="stack-s" style={{ gap: 0, flex: 1, minWidth: 0 }}>
                  <strong className="ellipsis">{displayName(db, m)}{memberKey(m) === meKey ? ' (you)' : ''}</strong>
                  <small className="muted">{roleLabel(db, m)}</small>
                </span>
                {chat.admins.includes(memberKey(m)) && <Badge tone="primary">admin</Badge>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}

function MessageRow({ m, mine, showName }: { m: Chat['messages'][number]; mine: boolean; showName: boolean }) {
  const { db } = useStore()
  return (
    <div className={`msg-row ${mine ? 'mine' : ''}`}>
      {!mine && <span className="msg-ava">{showName ? <Avatar name={m.from.name} src={photoOf(db, m.from)} size={30} /> : null}</span>}
      <div className={`bubble ${mine ? 'mine' : ''}`}>
        {showName && !mine && <small className="msg-name">{m.from.name} · {roleLabel(db, m.from).split(' · ')[0]}</small>}
        <p>{m.text}</p>
        <small className="msg-time">{timeOf(m.at)}</small>
      </div>
    </div>
  )
}

function NewChat({ mode, onClose, onOpen }: { mode: 'direct' | 'group'; onClose: () => void; onOpen: (id: string) => void }) {
  const { db, session, update, toast } = useStore()
  const [tab, setTab] = useState<'direct' | 'group'>(mode)
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [topic, setTopic] = useState('')
  const [announce, setAnnounce] = useState(false)
  const [picked, setPicked] = useState<Map<string, ChatMember>>(new Map())
  const contacts = useMemo(() => (session ? directContacts(db, session) : []), [db, session])
  if (!session) return null
  const me = sessionMember(session)
  const meKey = memberKey(me)
  const t = q.trim().toLowerCase()
  const shown = contacts.filter((c) => !t || c.name.toLowerCase().includes(t) || c.sub.toLowerCase().includes(t)).slice(0, 60)

  const openDirect = (m: ChatMember) => {
    const existing = db.chats.find((c) => c.kind === 'direct' && c.members.some((x) => memberKey(x) === meKey) && c.members.some((x) => memberKey(x) === memberKey(m)))
    if (existing) return onOpen(existing.id)
    const id = uid('chat')
    update((d) => {
      d.chats.push({ id, kind: 'direct', name: '', topic: '', scope: 'direct', members: [me, m], admins: [], announceOnly: false, createdBy: meKey, createdAt: new Date().toISOString(), messages: [], reads: {} })
    })
    onOpen(id)
  }

  const toggle = (m: ChatMember) =>
    setPicked((p) => {
      const n = new Map(p)
      const k = memberKey(m)
      if (n.has(k)) n.delete(k)
      else n.set(k, m)
      return n
    })
  const addMany = (ms: ChatMember[]) => setPicked((p) => { const n = new Map(p); ms.forEach((m) => memberKey(m) !== meKey && n.set(memberKey(m), m)); return n })

  // Quick-add presets by role & responsibility
  const presets: { label: string; members: () => ChatMember[] }[] = []
  if (session.role === 'staff') {
    const myClasses = [...new Set(db.timetable.filter((tt) => db.subjects.find((s) => s.id === tt.subjectId)?.staffId === session.userId).map((tt) => tt.classKey))]
    myClasses.forEach((k) => presets.push({ label: `Students · ${classLabel(k)}`, members: () => db.students.filter((s) => studentClassKey(s) === k).map((s) => ({ role: 'student' as const, userId: s.id })) }))
    const dept = db.staff.find((s) => s.id === session.userId)?.department
    if (dept) presets.push({ label: `${dept} department staff`, members: () => db.staff.filter((s) => s.department === dept).map((s) => ({ role: 'staff' as const, userId: s.id })) })
  }
  if (session.role === 'admin') {
    presets.push({ label: 'All HODs', members: () => db.departments.map((d) => d.hodId).filter(Boolean).map((id) => ({ role: 'staff' as const, userId: id! })) })
    presets.push({ label: 'All staff', members: () => db.staff.map((s) => ({ role: 'staff' as const, userId: s.id })) })
    presets.push({ label: 'Accounts team', members: () => db.accountants.map((a) => ({ role: 'accountant' as const, userId: a.id })) })
    db.departments.forEach((d) => presets.push({ label: `${d.code} staff`, members: () => db.staff.filter((s) => s.department === d.code).map((s) => ({ role: 'staff' as const, userId: s.id })) }))
  }
  if (session.role === 'accountant') presets.push({ label: 'Accounts team', members: () => db.accountants.map((a) => ({ role: 'accountant' as const, userId: a.id })) })

  const create = () => {
    if (name.trim().length < 3 || picked.size === 0) return
    const id = uid('chat')
    update((d) => {
      d.chats.push({ id, kind: 'group', name: name.trim(), topic: topic.trim(), scope: 'custom', members: [me, ...picked.values()], admins: [meKey], announceOnly: announce, createdBy: meKey, createdAt: new Date().toISOString(), messages: [], reads: {} })
      notify(d, [...picked.keys()], { kind: 'chat', important: false, title: `${displayName(d, me)} added you to “${name.trim()}”`, body: topic.trim() || `${picked.size + 1} members`, link: (to) => `/${to.split(':')[0]}/chat?c=${id}` })
    })
    toast(`Group “${name.trim()}” created`)
    onOpen(id)
  }

  return (
    <Modal
      open
      wide={tab === 'group'}
      title={tab === 'group' ? 'New group' : 'New message'}
      onClose={onClose}
      footer={tab === 'group' ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Users size={16} />} disabled={name.trim().length < 3 || picked.size === 0} onClick={create}>Create group ({picked.size + 1})</Button></> : undefined}
    >
      {session.role !== 'student' && <Segmented label="Chat type" value={tab} onChange={setTab} options={[{ id: 'direct', label: 'Direct message' }, { id: 'group', label: 'Group' }]} />}
      {tab === 'group' && (
        <div className="form-grid">
          <Field label="Group name">{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Project Expo 2026 volunteers" autoFocus />}</Field>
          <Field label="Topic (optional)">{(id) => <input id={id} className="input" value={topic} onChange={(e) => setTopic(e.target.value)} />}</Field>
          <label className="checkbox span-2"><input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} /> Announcements only — only you can post</label>
          {presets.length > 0 && (
            <div className="field span-2">
              <label>Quick add</label>
              <div className="chips">{presets.map((p) => <button key={p.label} type="button" className="chip sm" onClick={() => addMany(p.members())}><Plus size={12} /> {p.label}</button>)}</div>
            </div>
          )}
        </div>
      )}
      <div className="search" style={{ maxWidth: 'none' }}>
        <Search size={16} />
        <input className="input" placeholder={session.role === 'student' ? 'Search your teachers…' : 'Search people…'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus={tab === 'direct'} aria-label="Search people" />
      </div>
      <ul className="member-list pick">
        {shown.map((c) => {
          const k = memberKey(c)
          const on = picked.has(k)
          return (
            <li key={k}>
              <button type="button" className={`member-pick ${on ? 'on' : ''}`} onClick={() => (tab === 'direct' ? openDirect(c) : toggle(c))} aria-pressed={tab === 'group' ? on : undefined}>
                <Avatar name={c.name} src={photoOf(db, c)} size={34} />
                <span className="stack-s" style={{ gap: 0, flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <strong className="ellipsis">{c.name}{c.role === 'staff' && isHod(db, c.userId) ? ' · HOD' : ''}</strong>
                  <small className="muted ellipsis">{c.sub}</small>
                </span>
                {tab === 'group' ? <span className={`pick-box ${on ? 'on' : ''}`}>{on && <Check size={14} />}</span> : <Send size={14} className="muted" />}
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="muted tiny center" style={{ padding: 16 }}>No one matches.</li>}
      </ul>
      {session.role === 'student' && <p className="muted tiny">Students can message their teachers, their HOD and the office.</p>}
    </Modal>
  )
}
