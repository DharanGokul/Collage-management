import { useRef, useState } from 'react'
import { Camera, Trash2, Send, Lock, ShieldCheck, Clock, Undo2, Save } from 'lucide-react'
import { notify, useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Field, PageHeader } from '../../components/ui'
import { ThemeSwitchWithDefault } from '../../components/ThemeSwitch'
import { useAuth } from '../../auth/useAuth'
import { AuthError } from '../../auth/types'
import { checkPassword } from '../../auth/policy'
import { PasswordField } from '../auth/parts'
import { readImage } from '../../lib/theme'
import { formatDate, formatMoney, isValidEmail, isValidPhone, studentFeeStatus, uid } from '../../lib/utils'
import { displayName, hodDepartment, hodOf, isHod, leaveBalance, photoOf, roleLabel } from '../../lib/workflow'
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

/** Role-specific facts shown beside the editable details. */
function RoleSummary() {
  const { db, session } = useStore()
  if (!session) return null
  const { role, userId } = session
  type Row = [string, string]
  let title = 'At a glance'
  let rows: Row[] = []

  if (role === 'student') {
    const s = db.students.find((x) => x.id === userId)
    if (!s) return null
    const key = `${s.department}|${s.year}|${s.section}`
    let total = 0, present = 0
    for (const a of db.attendance) if (a.classKey === key && a.marks[s.id]) { total++; if (a.marks[s.id] !== 'A') present++ }
    const pct = total ? Math.round((present / total) * 100) : null
    const open = studentFeeStatus(db, s).filter((f) => f.status !== 'paid')
    const hod = db.staff.find((x) => x.id === hodOf(db, s.department))
    title = 'My academics'
    rows = [
      ['Class', `${s.department} · Year ${s.year} · Sec ${s.section}`],
      ['Attendance', pct === null ? 'No classes yet' : `${pct}%${pct < 75 ? ' · below 75%' : ''}`],
      ['Fees', open.length ? `${open.length} pending · ${formatMoney(open.reduce((a, f) => a + f.total, 0), db.branding.currency)}` : 'All paid'],
      ['Head of department', hod?.name ?? '—'],
      ['Joined', formatDate(s.joinedOn)],
    ]
  } else if (role === 'staff') {
    const st = db.staff.find((x) => x.id === userId)
    if (!st) return null
    const mine = db.subjects.filter((x) => x.staffId === st.id)
    const periods = db.timetable.filter((t) => mine.some((m) => m.id === t.subjectId)).length
    const hodDept = hodDepartment(db, st.id)
    const lv = (t: 'casual' | 'sick' | 'earned') => { const b = leaveBalance(db, st.id, t); return `${b.left} of ${b.quota} left` }
    title = hodDept ? 'Department & teaching' : 'Teaching & leave'
    rows = [
      ['Employee ID', st.empId],
      ['Department', st.department + (hodDept ? ' · Head of department' : '')],
      ['Subjects', mine.length ? mine.map((m) => m.code).join(', ') : 'None assigned'],
      ['Periods per week', String(periods)],
      ['Casual leave', lv('casual')],
      ['Sick leave', lv('sick')],
      ['Earned leave', lv('earned')],
      ...(hodDept ? [['Approvals waiting', String(db.requests.filter((r) => r.status === 'pending_hod' && r.department === hodDept.code).length)] as Row] : []),
    ]
  } else if (role === 'accountant') {
    const ac = db.accountants.find((x) => x.id === userId)
    title = 'Accounts desk'
    rows = [
      ['Employee ID', ac?.empId ?? '—'],
      ['Bills to pay', String(db.bills.filter((b) => b.status === 'approved').length)],
      ['Awaiting management', String(db.bills.filter((b) => b.status === 'pending').length)],
      ['Unreconciled bank lines', String(db.bankTxns.filter((t) => !t.match).length)],
      ['Bank accounts', String(db.bankAccounts.length)],
    ]
  } else {
    title = 'College overview'
    rows = [
      ['Active students', String(db.students.filter((x) => x.status === 'active').length)],
      ['Active staff', String(db.staff.filter((x) => x.status === 'active').length)],
      ['Departments', String(db.departments.length)],
      ['Approvals waiting', String(db.requests.filter((r) => r.status === 'pending_admin').length + db.leaves.filter((l) => l.status === 'pending' && l.approver === 'admin').length)],
    ]
  }

  return (
    <Card title={title}>
      <dl className="kv">
        {rows.map(([k, v]) => (
          <div key={k} className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '6px 0' }}>
            <dt className="muted tiny">{k}</dt>
            <dd style={{ margin: 0, textAlign: 'right' }}><strong>{v}</strong></dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function PasswordCard({ personal }: { personal: string[] }) {
  const { session, toast } = useStore()
  const auth = useAuth()
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const check = checkPassword(pw.next, personal)
  const ready = !!pw.cur && check.ok && pw.next === pw.confirm

  const submit = async () => {
    if (!session?.aid || busy) return
    setBusy(true)
    setError(null)
    try {
      await auth.changePassword(session.aid, pw.cur, pw.next)
      setPw({ cur: '', next: '', confirm: '' })
      toast('Password updated')
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Password" actions={<ShieldCheck size={18} className="muted" />}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <PasswordField label="Current password" value={pw.cur} onChange={(v) => { setPw({ ...pw, cur: v }); setError(null) }} autoComplete="current-password" />
        <PasswordField label="New password" value={pw.next} onChange={(v) => { setPw({ ...pw, next: v }); setError(null) }} autoComplete="new-password" meter personal={personal} />
        <PasswordField label="Confirm new password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" error={pw.confirm && pw.confirm !== pw.next ? 'Does not match' : null} />
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="row gap-s">
          <span className="muted tiny">A confirmation email is sent after every change.</span>
          <span className="spacer" />
          <Button type="submit" variant="secondary" icon={<Lock size={16} />} loading={busy} disabled={!ready}>Change password</Button>
        </div>
      </form>
    </Card>
  )
}

function ProfileForm({ current, student, pending, history, fileRef, onSave }: { current: Editable; student?: Student; pending?: ProfileChange; history: ProfileChange[]; fileRef: React.RefObject<HTMLInputElement | null>; onSave: (e: Editable, reason: string) => void }) {
  const { db, session, update, toast } = useStore()
  const base: Editable = pending ? { ...current, ...(pending.changes as Partial<Editable>) } : current
  const [f, setF] = useState<Editable>(base)
  const [reason, setReason] = useState(pending?.reason ?? '')
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
  const phoneMsg = 'Enter a 10-digit mobile number, e.g. 98765 43210'
  const phoneErr = canEdit('phone') && !isValidPhone(f.phone) ? phoneMsg : null
  const gPhoneErr = student && !isValidPhone(f.guardianPhone) ? phoneMsg : null
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
      <PageHeader title="My profile" subtitle={role === 'student' ? `Changes are reviewed by your HOD${hodName ? ` (${hodName})` : ''} before they appear on your record.` : role === 'admin' ? 'You can edit every detail on your own profile.' : role === 'accountant' ? 'Your photo and phone. Name and designation are set by the administrator.' : 'Your photo, phone and bio. Official details are set by the administrator.'} />
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
          <RoleSummary />
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
              <Field label="Phone" error={phoneErr}>{(id) => <input id={id} className="input" inputMode="tel" autoComplete="tel" value={f.phone} readOnly={ro('phone')} onChange={(e) => set('phone', e.target.value)} />}</Field>
              {role !== 'student' && <Field label="Designation" hint={ro('designation') ? roHint : undefined}>{(id) => <input id={id} className="input" value={f.designation} readOnly={ro('designation')} onChange={(e) => set('designation', e.target.value)} />}</Field>}
              {student && (
                <>
                  <Field label="Guardian name">{(id) => <input id={id} className="input" value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} />}</Field>
                  <Field label="Guardian phone" error={gPhoneErr}>{(id) => <input id={id} className="input" inputMode="tel" autoComplete="off" value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />}</Field>
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
              <Button icon={student ? <Send size={16} /> : <Save size={16} />} disabled={!dirty || !!emailErr || !!nameErr || !!phoneErr || !!gPhoneErr} onClick={() => onSave(f, reason)}>
                {student ? (pending ? 'Update request' : 'Submit for approval') : 'Save changes'}
              </Button>
            </div>
          </Card>
          <PasswordCard personal={[f.name, f.email.split('@')[0]]} />
        </div>
      </div>
    </>
  )
}
