import { useMemo, useState } from 'react'
import { Send, Inbox, FileText, PenSquare, Plus, Trash2, Pencil, Eye, RotateCw, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore, type EmailJob } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Tabs } from '../../components/ui'
import { classLabel, formatDate, formatMoney, isValidEmail, renderTemplate, studentClassKey, studentFeeStatus, summarize, uid } from '../../lib/utils'
import { PROVIDERS } from '../../lib/email'
import { portalUrl } from '../../lib/tenant'
import type { EmailLog, EmailTemplate } from '../../types'

type Tab = 'compose' | 'outbox' | 'templates'

export const PLACEHOLDERS = ['name', 'student_name', 'college_name', 'portal_url', 'support_email', 'fee_name', 'amount', 'due_date', 'attendance_pct', 'roll_no', 'class']

export default function EmailCenter() {
  const { db } = useStore()
  const [tab, setTab] = useState<Tab>('compose')
  const provider = PROVIDERS.find((p) => p.id === db.email.provider)
  return (
    <>
      <PageHeader title="Email Center" subtitle={<>Sending as <strong>{db.email.fromName}</strong> &lt;{db.email.fromEmail}&gt; via {provider?.label}</>} actions={<Link to="/admin/settings?tab=email" className="btn btn-secondary btn-md">Email settings</Link>} />
      {!db.email.verified && (
        <div className="alert alert-warn mb">
          <AlertTriangle size={16} /> <span>Your email configuration hasn't been tested yet. <Link to="/admin/settings?tab=email" className="link">Send a test email</Link> to verify it.</span>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} items={[{ id: 'compose', label: 'Compose', icon: <PenSquare size={16} /> }, { id: 'outbox', label: `Outbox (${db.emailLog.length})`, icon: <Inbox size={16} /> }, { id: 'templates', label: 'Templates', icon: <FileText size={16} /> }]} />
      {tab === 'compose' && <Compose onSent={() => setTab('outbox')} />}
      {tab === 'outbox' && <Outbox />}
      {tab === 'templates' && <Templates />}
    </>
  )
}

type Audience = 'students' | 'staff' | 'class' | 'defaulters' | 'low' | 'custom'

function Compose({ onSent }: { onSent: () => void }) {
  const { db, sendBulkEmail, toast } = useStore()
  const [audience, setAudience] = useState<Audience>('students')
  const classes = useMemo(() => [...new Set(db.students.map(studentClassKey))].sort(), [db.students])
  const [cls, setCls] = useState(classes[0] ?? '')
  const [custom, setCustom] = useState('')
  const [tplId, setTplId] = useState('tpl-general')
  const tpl0 = db.templates.find((t) => t.id === tplId)
  const [subject, setSubject] = useState(tpl0?.subject ?? '')
  const [body, setBody] = useState(tpl0?.body ?? '')
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState(false)

  const recipients: EmailJob['recipients'] = useMemo(() => {
    const cur = db.branding.currency
    const studentVars = (s: (typeof db.students)[number]) => {
      const dues = studentFeeStatus(db, s).filter((f) => f.status !== 'paid')
      return {
        name: s.name,
        student_name: s.name,
        roll_no: s.rollNo,
        class: classLabel(studentClassKey(s)),
        attendance_pct: `${summarize(db.attendance, s.id).pct}%`,
        fee_name: dues.map((d) => d.fee.name).join(', '),
        amount: formatMoney(dues.reduce((a, d) => a + d.total, 0), cur),
        due_date: dues[0] ? formatDate(dues[0].fee.dueDate) : '',
      }
    }
    const active = db.students.filter((s) => s.status === 'active')
    switch (audience) {
      case 'students':
        return active.map((s) => ({ email: s.email, vars: studentVars(s) }))
      case 'class':
        return active.filter((s) => studentClassKey(s) === cls).map((s) => ({ email: s.email, vars: studentVars(s) }))
      case 'defaulters':
        return active.filter((s) => studentFeeStatus(db, s).some((f) => f.status === 'overdue')).map((s) => ({ email: s.email, vars: studentVars(s) }))
      case 'low':
        return active.filter((s) => { const r = summarize(db.attendance, s.id); return r.total > 0 && r.pct < 75 }).map((s) => ({ email: s.email, vars: studentVars(s) }))
      case 'staff':
        return db.staff.filter((s) => s.status === 'active').map((s) => ({ email: s.email, vars: { name: s.name } }))
      case 'custom':
        return [...new Set(custom.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))].map((email) => ({ email, vars: { name: email.split('@')[0] } }))
    }
  }, [audience, cls, custom, db])

  const invalid = recipients.filter((r) => !isValidEmail(r.email))
  const canSend = recipients.length > 0 && invalid.length === 0 && subject.trim() && body.trim()

  const applyTemplate = (id: string) => {
    setTplId(id)
    const t = db.templates.find((x) => x.id === id)
    if (t) {
      setSubject(t.subject)
      setBody(t.body)
    }
  }

  const send = async () => {
    if (!canSend) return
    if (recipients.length > 20 && !confirm(`Send this email to ${recipients.length} recipients?`)) return
    setSending(true)
    const r = await sendBulkEmail({ recipients, subject, body })
    setSending(false)
    if (r.failed && !r.sent) toast('Sending failed – check Email settings. Details in Outbox.', 'error')
    else toast(`${r.sent} email(s) sent${r.failed ? `, ${r.failed} failed` : ''}`, r.failed ? 'info' : 'success')
    onSent()
  }

  const sample = recipients[0]
  const base = { college_name: db.branding.collegeName, portal_url: portalUrl(db.domain.subdomain, db.domain.customDomain, db.domain.domainStatus === 'verified'), support_email: db.branding.supportEmail }

  return (
    <div className="grid side">
      <Card title="Recipients">
        <div className="stack">
          <Field label="Audience">
            {(id) => (
              <select id={id} className="input" value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                <option value="students">All active students</option>
                <option value="class">A specific class</option>
                <option value="defaulters">Students with overdue fees</option>
                <option value="low">Students below 75% attendance</option>
                <option value="staff">All staff</option>
                <option value="custom">Custom email addresses</option>
              </select>
            )}
          </Field>
          {audience === 'class' && <Field label="Class">{(id) => <select id={id} className="input" value={cls} onChange={(e) => setCls(e.target.value)}>{classes.map((k) => <option key={k} value={k}>{classLabel(k)}</option>)}</select>}</Field>}
          {audience === 'custom' && <Field label="Email addresses" hint="Separate with commas, spaces or new lines" error={invalid.length ? `Invalid: ${invalid.slice(0, 3).map((r) => r.email).join(', ')}` : null}>{(id) => <textarea id={id} className="input" rows={4} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="parent@example.com, dean@college.edu" />}</Field>}
          <div className="recipient-count">
            <strong>{recipients.length}</strong> recipient{recipients.length === 1 ? '' : 's'}
          </div>
          <Field label="Start from template">{(id) => <select id={id} className="input" value={tplId} onChange={(e) => applyTemplate(e.target.value)}>{db.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>}</Field>
          <div>
            <small className="muted">Personalise with placeholders (click to insert):</small>
            <div className="chips mt-s">
              {PLACEHOLDERS.map((p) => <button key={p} className="chip mono sm" onClick={() => setBody((b) => b + `{{${p}}}`)}>{`{{${p}}}`}</button>)}
            </div>
          </div>
        </div>
      </Card>
      <Card title="Message" actions={<><Button size="sm" variant="secondary" icon={<Eye size={14} />} disabled={!sample} onClick={() => setPreview(true)}>Preview</Button><Button size="sm" icon={<Send size={14} />} disabled={!canSend} loading={sending} onClick={send}>Send</Button></>}>
        <div className="stack">
          <Field label="Subject">{(id) => <input id={id} className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          <Field label="Body">{(id) => <textarea id={id} className="input mono-ish" rows={14} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          {db.email.footer && <p className="muted tiny">Footer added automatically: “{db.email.footer}”</p>}
        </div>
      </Card>
      {preview && sample && (
        <Modal open title="Preview" onClose={() => setPreview(false)} wide>
          <EmailPreview from={`${db.email.fromName} <${db.email.fromEmail}>`} to={sample.email} subject={renderTemplate(subject, { ...base, ...sample.vars })} body={renderTemplate(body, { ...base, ...sample.vars })} footer={db.email.footer} />
        </Modal>
      )}
    </div>
  )
}

export function EmailPreview({ from, to, subject, body, footer }: { from: string; to: string; subject: string; body: string; footer?: string }) {
  const { db } = useStore()
  return (
    <div className="email-preview">
      <dl className="email-meta">
        <dt>From</dt><dd>{from}</dd>
        <dt>To</dt><dd>{to}</dd>
        <dt>Subject</dt><dd><strong>{subject}</strong></dd>
      </dl>
      <div className="email-frame">
        <div className="email-banner">
          {db.branding.logo ? <img src={db.branding.logo} alt="" /> : <span className="brand-mark" style={{ width: 32, height: 32 }}>{db.branding.collegeName[0]}</span>}
          <strong>{db.branding.collegeName}</strong>
        </div>
        <div className="email-body">{body}</div>
        {footer && <div className="email-footer">{footer}</div>}
      </div>
    </div>
  )
}

function Outbox() {
  const { db, update, sendBulkEmail, toast } = useStore()
  const [view, setView] = useState<EmailLog | null>(null)
  const [status, setStatus] = useState<'all' | EmailLog['status']>('all')
  const rows = db.emailLog.filter((l) => status === 'all' || l.status === status)
  const failed = db.emailLog.filter((l) => l.status === 'failed')

  const retry = async () => {
    // Retry with already-rendered content; remove the old failed rows first.
    const ids = new Set(failed.map((f) => f.id))
    update((d) => { d.emailLog = d.emailLog.filter((l) => !ids.has(l.id)) })
    let sent = 0
    for (const f of failed) {
      const r = await sendBulkEmail({ recipients: f.to.map((email) => ({ email, vars: {} })), subject: f.subject, body: f.body })
      sent += r.sent
    }
    toast(`${sent}/${failed.length} resent`, sent === failed.length ? 'success' : 'info')
  }

  return (
    <Card
      pad={false}
      actions={
        <>
          <select className="input sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter status">
            <option value="all">All</option><option value="sent">Sent</option><option value="failed">Failed</option>
          </select>
          {failed.length > 0 && <Button size="sm" variant="secondary" icon={<RotateCw size={14} />} onClick={retry}>Retry failed ({failed.length})</Button>}
          {db.emailLog.length > 0 && <Button size="sm" variant="ghost" onClick={() => { if (confirm('Clear the outbox history?')) update((d) => { d.emailLog = [] }) }}>Clear</Button>}
        </>
      }
      title="Sent messages"
    >
      {rows.length === 0 ? (
        <Empty icon={<Inbox />} title="No emails yet">Messages you send from the portal appear here.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>To</th><th>Subject</th><th>Provider</th><th>Sent</th><th>Status</th><th /></tr></thead>
            <tbody>
              {rows.slice(0, 200).map((l) => (
                <tr key={l.id}>
                  <td className="tiny">{l.to.join(', ')}</td>
                  <td>{l.subject}</td>
                  <td className="tiny">{PROVIDERS.find((p) => p.id === l.provider)?.label}</td>
                  <td className="tiny nowrap">{formatDate(l.sentAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{l.status === 'sent' ? <Badge tone="green">sent</Badge> : <Badge tone="red">{l.status}</Badge>}{l.error && <div className="text-red tiny">{l.error}</div>}</td>
                  <td className="right"><button className="icon-btn" aria-label="View" onClick={() => setView(l)}><Eye size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view && (
        <Modal open wide title="Email" onClose={() => setView(null)}>
          <EmailPreview from={`${db.email.fromName} <${db.email.fromEmail}>`} to={view.to.join(', ')} subject={view.subject} body={view.body} footer={db.email.footer} />
        </Modal>
      )}
    </Card>
  )
}

function Templates() {
  const { db, update, toast } = useStore()
  const [edit, setEdit] = useState<EmailTemplate | null>(null)
  const builtin = new Set(['tpl-fee-reminder', 'tpl-fee-receipt', 'tpl-low-attendance', 'tpl-welcome', 'tpl-general'])
  return (
    <>
      <div className="row mb"><span className="spacer" /><Button icon={<Plus size={16} />} onClick={() => setEdit({ id: '', name: '', subject: '', body: '', category: 'general' })}>New template</Button></div>
      <div className="grid cards">
        {db.templates.map((t) => (
          <Card key={t.id} title={t.name} actions={<><button className="icon-btn" aria-label={`Edit ${t.name}`} onClick={() => setEdit(t)}><Pencil size={16} /></button>{!builtin.has(t.id) && <button className="icon-btn danger" aria-label={`Delete ${t.name}`} onClick={() => { if (confirm(`Delete template “${t.name}”?`)) { update((d) => { d.templates = d.templates.filter((x) => x.id !== t.id) }); toast('Template deleted') } }}><Trash2 size={16} /></button>}</>}>
            <Badge tone="primary">{t.category}</Badge>
            <p className="mt-s"><strong>{t.subject}</strong></p>
            <p className="muted tiny clamp">{t.body}</p>
          </Card>
        ))}
      </div>
      {edit && (
        <Modal
          open
          wide
          title={edit.id ? 'Edit template' : 'New template'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              <Button
                disabled={!edit.name.trim() || !edit.subject.trim() || !edit.body.trim()}
                onClick={() => {
                  update((d) => {
                    if (!edit.id) d.templates.push({ ...edit, id: uid('tpl') })
                    else d.templates = d.templates.map((x) => (x.id === edit.id ? edit : x))
                  })
                  toast('Template saved')
                  setEdit(null)
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Name">{(id) => <input id={id} className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
            <Field label="Category">{(id) => <select id={id} className="input" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as EmailTemplate['category'] })}>{['general', 'fees', 'attendance', 'account'].map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            <Field label="Subject" span={2}>{(id) => <input id={id} className="input" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />}</Field>
            <Field label="Body" span={2} hint={`Placeholders: ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}`}>{(id) => <textarea id={id} className="input mono-ish" rows={10} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />}</Field>
          </div>
        </Modal>
      )}
    </>
  )
}
