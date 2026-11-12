import { useState, type ReactNode } from 'react'
import { MapPin, Package, Check, X } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button } from '../../components/ui'
import { formatDate, formatMoney } from '../../lib/utils'
import { REQUEST_STATUS } from '../../lib/workflow'
import type { DeptRequest } from '../../types'

export const CATEGORY_LABEL: Record<DeptRequest['category'], string> = {
  computer: 'Computers & IT', projector: 'Projector / display', furniture: 'Benches & furniture', lab: 'Lab equipment', network: 'Network / Wi-Fi',
  electrical: 'Electrical', av: 'Audio / video', stationery: 'Stationery', other: 'Other',
}
export const KIND_LABEL: Record<DeptRequest['kind'], string> = { purchase: 'New purchase', repair: 'Repair / issue', setup: 'Setup / installation' }

/** Progress steps for a request; management step only when needed. */
function steps(r: DeptRequest, needsAdmin: boolean) {
  const s = [
    { id: 'submitted', label: 'Submitted' },
    { id: 'hod', label: 'HOD' },
    ...(needsAdmin ? [{ id: 'admin', label: 'Management' }] : []),
    { id: 'work', label: r.kind === 'purchase' ? 'Ordered' : 'In progress' },
    { id: 'done', label: r.kind === 'purchase' ? 'Received' : 'Done' },
  ]
  const reached = (() => {
    switch (r.status) {
      case 'pending_hod': return 1
      case 'pending_admin': return 2
      case 'approved': return needsAdmin ? 3 : 2
      case 'in_progress': return needsAdmin ? 4 : 3
      case 'completed': return s.length
      case 'rejected': return r.timeline.some((t) => /HOD/.test(t.action)) ? 2 : 1
    }
  })()
  return { s, reached }
}

export function RequestCard({ r, actions, compact }: { r: DeptRequest; actions?: ReactNode; compact?: boolean }) {
  const { db } = useStore()
  const [open, setOpen] = useState(false)
  const needsAdmin = r.kind === 'purchase' || r.estimatedCost > db.tax.procurementApprovalLimit || r.timeline.some((t) => /management/i.test(t.action))
  const { s, reached } = steps(r, needsAdmin)
  const st = REQUEST_STATUS[r.status]
  const bill = r.billId ? db.bills.find((b) => b.id === r.billId) : undefined
  return (
    <article className="req-card card">
      <div className="req-top">
        <div className="stack-s" style={{ gap: 4, minWidth: 0 }}>
          <span className="spec">{r.ref} · {KIND_LABEL[r.kind]} · {CATEGORY_LABEL[r.category]}</span>
          <h3 className="ellipsis" style={{ fontSize: 17 }}>{r.title}</h3>
          <span className="row gap-s tiny muted"><MapPin size={13} /> {r.location} · {r.department} · by {r.requestedBy.name}</span>
        </div>
        <div className="stack-s" style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge tone={st.tone}>{st.label}</Badge>
          {(r.priority === 'urgent' || r.priority === 'high') && <Badge tone={r.priority === 'urgent' ? 'red' : 'amber'}>{r.priority}</Badge>}
        </div>
      </div>
      <ol className={`stepper ${r.status === 'rejected' ? 'rejected' : ''}`} aria-label="Progress">
        {s.map((step, i) => (
          <li key={step.id} className={i < reached ? 'done' : i === reached ? 'current' : ''}>
            <span className="dot">{i < reached ? <Check size={11} /> : r.status === 'rejected' && i === reached ? <X size={11} /> : null}</span>
            <span className="lbl">{step.label}</span>
          </li>
        ))}
      </ol>
      <div className="row gap-s tiny" style={{ justifyContent: 'space-between' }}>
        <span className="row gap-s"><Package size={13} className="muted" /> Qty {r.quantity} · est. <strong>{formatMoney(r.estimatedCost, db.branding.currency)}</strong>{bill && <span className="muted"> · bill {bill.billNo} ({bill.status})</span>}</span>
        {!compact && <button className="link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => setOpen(!open)}>{open ? 'Hide history' : 'History'}</button>}
      </div>
      {(open || compact === false) && (
        <>
          {r.description && <p className="tiny" style={{ whiteSpace: 'pre-wrap' }}>{r.description}</p>}
          <ul className="timeline">
            {r.timeline.map((t, i) => (
              <li key={i}>
                <strong>{t.action}</strong> <span className="muted">· {t.by} · {formatDate(t.at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                {t.note && <div className="muted tiny">“{t.note}”</div>}
              </li>
            ))}
          </ul>
        </>
      )}
      {actions && <div className="req-actions">{actions}</div>}
    </article>
  )
}

/** Approve / reject with an optional note. */
export function DecisionBar({ onApprove, onReject, approveLabel = 'Approve' }: { onApprove: (note: string) => void; onReject: (note: string) => void; approveLabel?: string }) {
  const [note, setNote] = useState('')
  return (
    <div className="decision">
      <input className="input sm" style={{ flex: 1, minWidth: 160 }} placeholder="Note (optional, required to reject)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Decision note" />
      <Button size="sm" variant="secondary" icon={<X size={14} />} disabled={!note.trim()} onClick={() => onReject(note.trim())}>Reject</Button>
      <Button size="sm" icon={<Check size={14} />} onClick={() => onApprove(note.trim())}>{approveLabel}</Button>
    </div>
  )
}
