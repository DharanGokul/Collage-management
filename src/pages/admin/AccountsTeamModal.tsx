import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Field, Modal } from '../../components/ui'
import { isValidEmail, uid } from '../../lib/utils'

/**
 * Admin tool: the accounts office. Accounts users record bills, invoices and bank statements, so they are added by
 * management only. A new person signs in with their email or employee ID (first sign-in sends an activation link
 * when the college runs in invite-only mode).
 */
export default function AccountsTeamModal({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [f, setF] = useState({ name: '', email: '', empId: '', phone: '', designation: 'Accountant' })
  const [touched, setTouched] = useState(false)
  const email = f.email.trim().toLowerCase()
  const empId = f.empId.trim().toUpperCase()
  const takenEmail = [...db.staff, ...db.accountants, ...db.students].some((p) => p.email.toLowerCase() === email)
  const takenId = [...db.staff, ...db.accountants].some((p) => p.empId.toUpperCase() === empId)
  const errs = {
    name: f.name.trim().length < 2 ? 'Name is required' : null,
    email: !isValidEmail(email) ? 'Enter a valid email' : takenEmail ? 'This email is already used by someone in the college' : null,
    empId: !empId ? 'Employee ID is required' : takenId ? 'This employee ID is already used' : null,
  }
  const hasErr = Object.values(errs).some(Boolean)
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))

  const add = () => {
    setTouched(true)
    if (hasErr) return
    update((d) => { d.accountants.push({ id: uid('acc'), empId, name: f.name.trim(), email, phone: f.phone.trim(), designation: f.designation.trim() || 'Accountant', status: 'active' }) })
    toast(`${f.name.trim()} added to the accounts team`)
    setF({ name: '', email: '', empId: '', phone: '', designation: 'Accountant' })
    setTouched(false)
  }
  const toggle = (id: string, name: string, to: 'active' | 'inactive') => {
    if (to === 'inactive' && !confirm(`Deactivate ${name}? They will no longer be able to sign in.`)) return
    update((d) => { const a = d.accountants.find((x) => x.id === id); if (a) a.status = to })
    toast(`${name} ${to === 'active' ? 'reactivated' : 'deactivated'}`)
  }

  return (
    <Modal open title="Accounts team" onClose={onClose} wide footer={<Button onClick={onClose}>Done</Button>}>
      <p className="muted tiny">The accounts office records bills, invoices and bank statements. Only management can add or remove accounts users. Purchases and bills over the approval limit still need management approval.</p>
      <div className="stack-s" style={{ margin: '12px 0' }}>
        {db.accountants.length === 0 && <p className="muted">No accounts users yet. Add one below so someone can manage fees, bills and reports.</p>}
        {db.accountants.map((a) => (
          <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <strong>{a.name}</strong> <span className="muted tiny mono">{a.empId}</span>
              <div className="muted tiny">{a.designation} · {a.email}</div>
            </div>
            <Badge tone={a.status === 'active' ? 'green' : 'gray'}>{a.status === 'active' ? 'Active' : 'Inactive'}</Badge>
            <Button size="sm" variant="secondary" onClick={() => toggle(a.id, a.name, a.status === 'active' ? 'inactive' : 'active')}>{a.status === 'active' ? 'Deactivate' : 'Reactivate'}</Button>
          </div>
        ))}
      </div>
      <h4 style={{ margin: '16px 0 8px' }}>Add accounts user</h4>
      <div className="form-grid">
        <Field label="Full name" error={touched ? errs.name : null}>{(id) => <input id={id} className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="off" />}</Field>
        <Field label="Email" error={touched ? errs.email : null}>{(id) => <input id={id} className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoCapitalize="none" spellCheck={false} />}</Field>
        <Field label="Employee ID" error={touched ? errs.empId : null}>{(id) => <input id={id} className="input mono" value={f.empId} onChange={(e) => set('empId', e.target.value)} placeholder="e.g. ACC-03" />}</Field>
        <Field label="Phone">{(id) => <input id={id} className="input" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label="Designation">{(id) => <input id={id} className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />}</Field>
      </div>
      <Button icon={<Plus size={16} />} variant="secondary" onClick={add}>Add accounts user</Button>
    </Modal>
  )
}
