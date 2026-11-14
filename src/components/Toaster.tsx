import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CheckCircle2, AlertCircle, Info, Bell, Pin, MessageSquareText, ClipboardCheck, Wallet, CalendarRange, UserRound } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { gsap, prefersReducedMotion } from './motion'
import type { AppNotification } from '../types'

/**
 * Bottom-right toaster.
 *  - Local action feedback (store.toast) and realtime notifications addressed
 *    to the signed-in person (db.notifications, synced live across tabs).
 *  - Toasts enter one at a time (sequenced), sliding in from the right.
 *  - Normal toasts auto-close with a progress bar that pauses on hover.
 *  - Important notifications never auto-close; they stay until dismissed and
 *    survive reloads until then.
 */

interface Item {
  id: string
  title: string
  body?: string
  tone: 'success' | 'error' | 'info' | 'notify'
  important: boolean
  kind?: AppNotification['kind']
  link?: string
  ms: number
}

const MAX_VISIBLE_WIDE = 4
const STAGGER_MS = 380
const dismissedKey = (who: string) => `cms:dismissed:${who}`

function readDismissed(who: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(dismissedKey(who)) || '[]'))
  } catch {
    return new Set()
  }
}
function saveDismissed(who: string, s: Set<string>) {
  try {
    localStorage.setItem(dismissedKey(who), JSON.stringify([...s].slice(-300)))
  } catch {
    /* ignore */
  }
}

const KIND_ICON: Record<AppNotification['kind'], ReactNode> = {
  chat: <MessageSquareText size={18} />,
  approval: <ClipboardCheck size={18} />,
  request: <ClipboardCheck size={18} />,
  leave: <CalendarRange size={18} />,
  profile: <UserRound size={18} />,
  ticket: <MessageSquareText size={18} />,
  event: <CalendarRange size={18} />,
  finance: <Wallet size={18} />,
  info: <Bell size={18} />,
}

export default function Toaster() {
  // Phones: keep the stack short so persistent toasts never bury the page.
  const MAX_VISIBLE = typeof window !== 'undefined' && window.innerWidth <= 600 ? 2 : MAX_VISIBLE_WIDE
  const { db, session, toasts, dismissToast } = useStore()
  const go = useNavigate()
  const me = session ? `${session.role}:${session.userId}` : ''
  const [queue, setQueue] = useState<Item[]>([])
  const [shown, setShown] = useState<Item[]>([])
  const seen = useRef<Set<string>>(new Set())
  const mountedAt = useRef(new Date().toISOString())
  const dismissed = useRef<Set<string>>(new Set())

  useEffect(() => {
    dismissed.current = me ? readDismissed(me) : new Set()
    mountedAt.current = new Date().toISOString()
    seen.current = new Set()
  }, [me])

  // Local feedback toasts
  useEffect(() => {
    const fresh = toasts.filter((t) => !seen.current.has(t.id))
    if (!fresh.length) return
    fresh.forEach((t) => seen.current.add(t.id))
    setQueue((q) => [...q, ...fresh.map<Item>((t) => ({ id: t.id, title: t.text, tone: t.kind, important: false, ms: t.kind === 'error' ? 6000 : 4000 }))])
    fresh.forEach((t) => dismissToast(t.id)) // consumed: the toaster owns their lifetime now
  }, [toasts, dismissToast])

  // Realtime notifications for me: new ones since mount, plus undismissed important ones (persist until closed)
  const mine = useMemo(() => (me ? db.notifications.filter((n) => n.to === me) : []), [db.notifications, me])
  useEffect(() => {
    const fresh = mine.filter((n) => !seen.current.has(n.id) && !dismissed.current.has(n.id) && (n.at >= mountedAt.current || (n.important && Date.now() - new Date(n.at).getTime() < 7 * 86400000)))
    if (!fresh.length) return
    fresh.forEach((n) => seen.current.add(n.id))
    setQueue((q) => [...q, ...fresh.filter((n) => !q.some((x) => x.id === n.id)).map<Item>((n) => ({ id: n.id, title: n.title, body: n.body, tone: 'notify', important: n.important, kind: n.kind, link: n.link, ms: 6500 }))])
  }, [mine])

  // Backlog: make room by retiring the oldest normal toast (important ones always stay).
  const [expire, setExpire] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!queue.length || shown.length < MAX_VISIBLE) return
    const oldest = shown.find((x) => !x.important && !expire.has(x.id))
    if (oldest) setExpire((e) => new Set(e).add(oldest.id))
  }, [queue.length, shown, expire])

  // Release queued toasts one by one so they arrive back to back, not all at once.
  useEffect(() => {
    if (!queue.length || shown.length >= MAX_VISIBLE) return
    const t = setTimeout(() => {
      setQueue((q) => q.slice(1))
      setShown((s) => (s.some((x) => x.id === queue[0].id) ? s : [...s, queue[0]]))
    }, shown.length ? STAGGER_MS : 0)
    return () => clearTimeout(t)
  }, [queue, shown.length])

  const remove = (it: Item) => {
    if (it.tone === 'notify' && me) {
      dismissed.current.add(it.id)
      saveDismissed(me, dismissed.current)
    }
    setShown((s) => s.filter((x) => x.id !== it.id))
    setExpire((e) => {
      if (!e.has(it.id)) return e
      const n = new Set(e)
      n.delete(it.id)
      return n
    })
  }

  return (
    <div className="toaster" aria-live="polite" aria-relevant="additions">
      {shown.map((it) => (
        <ToastCard
          key={it.id}
          item={it}
          expire={expire.has(it.id)}
          onClose={() => remove(it)}
          onOpen={
            it.link
              ? () => {
                  go(it.link!)
                  remove(it)
                }
              : undefined
          }
        />
      ))}
      {queue.length > 0 && shown.length >= MAX_VISIBLE && <div className="toast-more">+{queue.length} more</div>}
    </div>
  )
}

function ToastCard({ item, expire, onClose, onOpen }: { item: Item; expire: boolean; onClose: () => void; onOpen?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const leaving = useRef(false)

  // Slide in from the right with a little overshoot.
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return
    const t = gsap.fromTo(ref.current, { xPercent: 115, autoAlpha: 0, scale: 0.96 }, { xPercent: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' })
    return () => {
      t.kill()
    }
  }, [])

  const close = () => {
    if (leaving.current) return
    leaving.current = true
    const el = ref.current
    if (!el || prefersReducedMotion()) return onClose()
    gsap
      .timeline({ onComplete: onClose })
      .to(el, { xPercent: 115, autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
      .to(el, { height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0, duration: 0.2, ease: 'power2.inOut' })
  }

  useEffect(() => {
    if (expire) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expire])

  // Auto-close (not for important ones); the countdown pauses while hovered.
  const remaining = useRef(item.ms)
  useEffect(() => {
    if (item.important || paused) return
    const start = Date.now()
    const t = setTimeout(close, remaining.current)
    return () => {
      clearTimeout(t)
      remaining.current -= Date.now() - start
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, item.important])

  const icon =
    item.tone === 'success' ? <CheckCircle2 size={18} /> : item.tone === 'error' ? <AlertCircle size={18} /> : item.tone === 'info' ? <Info size={18} /> : KIND_ICON[item.kind ?? 'info']

  return (
    <div
      ref={ref}
      className={`toast2 tone-${item.tone} ${item.important ? 'important' : ''} ${onOpen ? 'clickable' : ''}`}
      role={item.important ? 'alert' : 'status'}
      onPointerMove={(e) => e.pointerType === 'mouse' && !paused && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.toast2-close')) return
        onOpen?.()
      }}
    >
      <span className="toast2-icon">{icon}</span>
      <div className="toast2-main">
        <div className="toast2-title">
          {item.important && (
            <span className="toast2-pin" title="Important — stays until you close it">
              <Pin size={12} /> Important
            </span>
          )}
          <strong>{item.title}</strong>
        </div>
        {item.body && <p>{item.body}</p>}
        {onOpen && <span className="toast2-link">Open →</span>}
      </div>
      <button className="toast2-close" aria-label="Dismiss notification" onClick={close}>
        <X size={14} />
      </button>
      {!item.important && <span className="toast2-bar" style={{ animationDuration: `${item.ms}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
    </div>
  )
}
