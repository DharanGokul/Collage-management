import { useRef, useState } from 'react'
import { Camera, Trash2, Send, Lock, ShieldCheck, Clock, Undo2, Save } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Field, PageHeader } from '../../components/ui'
import { ThemeSwitchWithDefault } from '../../components/ThemeSwitch'
import { readImage } from '../../lib/theme'
import { formatDate, isValidEmail, uid } from '../../lib/utils'
import { displayName, hodOf, isHod, photoOf, roleLabel } from '../../lib/workflow'
import type { ProfileChange, Student } from '../../types'

type Editable = { name: string; email: string; phone: string; guardianName: string; guardianPhone: string; bio: string; designation: string; photo: string | null }

const FIELD_LABEL: Record<string, string> = { name: 'Full name', email: 'Email', phone: 'Phone', guardianName: 'Guardian name', guardianPhone: 'Guardian phone', photo: 'Photo' }

/**
 * My profile — what each role may change:
 *  - student: photo & personal details, but every change needs their HOD's approval
 *  - staff / HOD / accounts: photo, phone and bio directly; official fields are set by the admin
 *  - admin: everything on their own profile
 */
export default function Profile() {
  const { db, session, update, toast } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  if (!session) return null
  const me = { role: session.role, userId: session.userId }
  const student = session.role === 'student' ? db.students.find((s) => s.id === session.userId) : undefined
  const staff = session.role === 'staff' ? db.staff.find((s) => s.id === session.userId) : undefined
  const acct = session.role === 'accountant' ? db.accountants.find((s) => s.id === session.userId) : undefined
  const admin = session.role === 'admin' ? db.adminProfile : undefined
  const pending = student ? db.profileChanges.find((p) => p.studentId === student.id && p.status === 'pending') : undefined
  const history = student ? db.profileChanges.filter((p) => p.studentId === student.id && p.status !== 'pending').slice(-3).reverse() : []

  const current: Editable = {
    name: student?.name ?? staff?.name ?? acct?.name ?? admin?.name ?? '',
    email: student?.email ?? staff?.email ?? acct?.email ?? admin?.email ?? '',
    phone: student?.phone ?? staff?.phone ?? acct?.phone ?? admin?.phone ?? '',
    guardianName: student?.guardianName ?? '',
    guardianPhone: student?.guardianPhone ?? '',
    bio: staff?.bio ?? '',
    designation: staff?.designation ?? acct?.designation ?? admin?.designation ?? '',
    photo: photoOf(db, me),
  }
  return <ProfileForm key={JSON.stringify(current) + (pending?.id ?? '')} current={current} student={student} pending={pending} history={history} fileRef={fileRef} onSave={save} />

  function save(next: Editable, reason: string) {
    if (!session) return
    if (student) {
      // Students: collect the diff and send it to the HOD.
      const changes: ProfileChange['changes'] = {}
      for (const k of ['name', 'email', 'phone', 'guardianName', 'guardianPhone', 'photo'] as const) if ((next[k] ?? null) !== ((current[k] as string | null) ?? null)) (changes as Record<string, unknown>)[k] = next[k]
      if (!Object.keys(changes).length) return toast('Nothing changed', 'info')
      const hod = hodOf(db, student.department)
      const id = uid('pc')
      update((d) => {
        d.profileChanges.push({ id, studentId: student.id, changes, reason: reason.trim(), status: 'pending', createdAt: new Date().toISOString() })
        notify(d, hod ? [`staff:${hod}`] : ['admin:admin'], { kind: 'profile', important: true, title: `Profile change request — ${student.name}`, body: `${Object.keys(changes).map((k) => FIELD_LABEL[k] ?? k).join(', ')} · ${student.rollNo}`, link: hod ? '/staff/approvals?tab=profile' : '/admin/approvals' })
      })
      toast(`Sent to your HOD for approval`)
      return
    }
    update((d) => {
      if (session.role === 'admin') d.adminProfile = { ...d.adminProfile, name: next.name.trim() || 'Administrator', email: next.email.trim(), phone: next.phone.trim(), designation: next.designation.trim(), photo: next.photo }
      const st = d.staff.find((x) => x.id === session.userId && session.role === 'staff')
      if (st) Object.assign(st, { phone: next.phone.trim(), bio: next.bio.trim(), photo: next.photo })
      const ac = d.accountants.find((x) => x.id === session.userId && session.role === 'accountant')
      if (ac) Object.assign(ac, { phone: next.phone.trim(), photo: next.photo })
    })
    toast('Profile updated')
  }
}

function ProfileForm({ current, student, pending, history, fileRef, onSave }: { current: Editable; student?: Student; pending?: ProfileChange; history: ProfileChange[]; fileRef: React.RefObject<HTMLInputElement | null>; onSave: (e: Editable, reason: string) => void }) {
  const { db, session, update, toast } = useStore()
  const base: Editable = pending ? { ...current, ...(pending.changes as Partial<Editable>) } : current
  const [f, setF] = useState<Editable>(base)
  const [reason, setReason] = useState(pending?.reason ?? '')
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' })
  if (!session) return null
  const role = session.role
  const me = { role, userId: session.userId }
  const canEdit = (k: keyof Editable) => {
    if (role === 'admin') return true
    if (role === 'student') return ['name', 'email', 'phone', 'guardianName', 'guardianPhone', 'photo'].includes(k)
    if (role === 'staff') return ['phone', 'bio', 'photo'].includes(k)
    return ['phone', 'photo'].includes(k)
  }
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setF((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(base)
  const emailErr = canEdit('email') && f.email && !isValidEmail(f.email) ? 'Enter a valid email' : null
  const nameErr = canEdit('name') && f.name.trim().length < 2 ? 'Name is required' : null
  const hodName = student ? db.staff.find((s) => s.id === hodOf(db, student.department))?.name : undefined

  const pick = async (file?: File) => {
    if (!file) return
    try {
      set('photo', await readImage(file, 320))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed', 'error')
    }
  }

  const ro = (k: keyof Editable) => !canEdit(k)
  const roHint = role === 'student' ? undefined : role === 'admin' ? undefined : 'Managed by the administrator'

  return (
    <>
      <PageHeader title="My profile" subtitle={role === 'student' ? `Changes are reviewed by your HOD${hodName ? ` (${hodName})` : ''} before they appear on your record.` : 'Your photo and contact details across the portal.'} />
      <div className="grid side">
        <div className="stack-l">
          <Card>
            <div className="profile-hero">
              <div className="profile-photo">
                <Avatar name={f.name || displayName(db, me)} src={f.photo} size={128} />
                <button className="photo-btn" aria-label="Change photo" onClick={() => fileRef.current?.click()}><Camera size={18} /></button>
                <input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <h2 className="center">{f.name || displayName(db, me)}</h2>
              <span className="muted tiny center">{roleLabel(db, me)}{isHod(db, session.userId) && role === 'staff' ? ' · Head of department' : ''}</span>
              <div className="row gap-s" style={{ justifyContent: 'center' }}>
                <Button size="sm" variant="secondary" icon={<Camera size={14} />} onClick={() => fileRef.current?.click()}>{f.photo ? 'Replace photo' : 'Upload photo'}</Button>
                {f.photo && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => set('photo', null)}>Remove</Button>}
              </div>
              <small className="muted center">JPG, PNG or WEBP · square works best · up to 2 MB</small>
            </div>
          </Card>
          <Card title="Appearance">
            <ThemeSwitchWithDefault />
          </Card>
          {pending && (
            <Card title="Waiting for approval" actions={<Badge tone="amber"><Clock size={12} /> Pending</Badge>}>
              <div className="stack-s">
                <span className="muted tiny">Sent {formatDate(pending.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} to {hodName ?? 'your HOD'}</span>
                <ul className="diff">
                  {Object.entries(pending.changes).map(([k, v]) => (
                    <li key={k}>
                      <span className="spec">{FIELD_LABEL[k] ?? k}</span>
                      {k === 'photo' ? <span className="row gap-s">{v ? <img src={v as string} alt="New" className="diff-photo" /> : 'Remove photo'}</span> : <span><del>{(current as Record<string, unknown>)[k] as string || '—'}</del> → <strong>{(v as string) || '—'}</strong></span>}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Undo2 size={14} />}
                  onClick={() => {
                    update((d) => { d.profileChanges = d.profileChanges.filter((p) => p.id !== pending.id) })
                    toast('Request withdrawn')
                  }}
                >
                  Withdraw request
                </Button>
              </div>
            </Card>
          )}
          {history.length > 0 && (
            <Card title="Recent decisions">
              <ul className="feed">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="row gap-s"><Badge tone={h.status === 'approved' ? 'green' : 'red'}>{h.status}</Badge><span className="tiny muted">{Object.keys(h.changes).map((k) => FIELD_LABEL[k] ?? k).join(', ')}</span></span>
                    {h.note && <small className="muted">“{h.note}” — {h.decidedBy}</small>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        <div className="stack-l">
          <Card title="Details">
            <div className="form-grid">
              <Field label="Full name" error={nameErr} hint={ro('name') ? roHint : undefined}>{(id) => <input id={id} className="input" value={f.name} readOnly={ro('name')} onChange={(e) => set('name', e.target.value)} />}</Field>
              <Field label="Email" error={emailErr} hint={ro('email') ? roHint : undefined}>{(id) => <input id={id} className="input" type="email" value={f.email} readOnly={ro('email')} onChange={(e) => set('email', e.target.value)} />}</Field>
              <Field label="Phone">{(id) => <input id={id} className="input" inputMode="tel" value={f.phone} readOnly={ro('phone')} onChange={(e) => set('phone', e.target.value)} />}</Field>
              {role !== 'student' && <Field label="Designation" hint={ro('designation') ? roHint : undefined}>{(id) => <input id={id} className="input" value={f.designation} readOnly={ro('designation')} onChange={(e) => set('designation', e.target.value)} />}</Field>}
              {student && (
                <>
                  <Field label="Guardian name">{(id) => <input id={id} className="input" value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} />}</Field>
                  <Field label="Guardian phone">{(id) => <input id={id} className="input" inputMode="tel" value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />}</Field>
                  <Field label="Roll number" hint="Set by the college">{(id) => <input id={id} className="input mono" value={student.rollNo} readOnly />}</Field>
                  <Field label="Class" hint="Set by the college">{(id) => <input id={id} className="input" value={`${student.department} · Year ${student.year} · Sec ${student.section}`} readOnly />}</Field>
                </>
              )}
              {role === 'staff' && <Field label="About me" span={2} hint="Shown to students on your chat profile">{(id) => <textarea id={id} className="input" rows={3} value={f.bio} onChange={(e) => set('bio', e.target.value)} maxLength={280} />}</Field>}
              {student && <Field label="Reason for the change" span={2} hint="Helps your HOD approve faster">{(id) => <input id={id} className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. New phone number, updated ID photo" />}</Field>}
            </div>
            <div className="row gap-s mt">
              <span className="spacer" />
              {dirty && <Button variant="ghost" onClick={() => { setF(base); setReason(pending?.reason ?? '') }}>Discard</Button>}
              <Button icon={student ? <Send size={16} /> : <Save size={16} />} disabled={!dirty || !!emailErr || !!nameErr} onClick={() => onSave(f, reason)}>
                {student ? (pending ? 'Update request' : 'Submit for approval') : 'Save changes'}
              </Button>
            </div>
          </Card>
          <Card title="Password" actions={<ShieldCheck size={18} className="muted" />}>
            <div className="form-grid">
              <Field label="Current password">{(id) => <input id={id} className="input" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />}</Field>
              <span />
              <Field label="New password" hint="At least 8 characters" error={pw.next && pw.next.length < 8 ? 'Too short' : null}>{(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />}</Field>
              <Field label="Confirm" error={pw.confirm && pw.confirm !== pw.next ? 'Does not match' : null}>{(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}</Field>
            </div>
            <div className="row gap-s mt">
              <span className="muted tiny">Demo mode: sign-in accepts any password.</span>
              <span className="spacer" />
              <Button variant="secondary" icon={<Lock size={16} />} disabled={!pw.cur || pw.next.length < 8 || pw.next !== pw.confirm} onClick={() => { setPw({ cur: '', next: '', confirm: '' }); toast('Password updated') }}>Change password</Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
