import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download, Users } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader } from '../../components/ui'
import { downloadCSV, isValidEmail, uid } from '../../lib/utils'
import type { Staff } from '../../types'

export default function StaffPage() {
  const { db, update, toast } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [editing, setEditing] = useState<Staff | null>(null)

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.staff.filter((s) => (dept === 'all' || s.department === dept) && (!t || s.name.toLowerCase().includes(t) || s.empId.toLowerCase().includes(t) || s.email.toLowerCase().includes(t)))
  }, [db.staff, q, dept])

  const remove = (s: Staff) => {
    const n = db.subjects.filter((x) => x.staffId === s.id).length
    if (!confirm(`Delete ${s.name}?${n ? ` ${n} subject(s) will become unassigned.` : ''}`)) return
    update((d) => {
      d.staff = d.staff.filter((x) => x.id !== s.id)
      for (const sub of d.subjects) if (sub.staffId === s.id) sub.staffId = null
    })
    toast(`${s.name} deleted`)
  }

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Faculty and administrative staff"
        actions={
          <>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadCSV('staff.csv', [['Emp ID', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Status'], ...rows.map((s) => [s.empId, s.name, s.email, s.phone, s.department, s.designation, s.status])])}>Export CSV</Button>
            <Button icon={<Plus size={16} />} onClick={() => setEditing({ id: '', empId: '', name: '', email: '', phone: '', department: db.departments[0]?.code ?? '', designation: 'Assistant Professor', status: 'active', joinedOn: new Date().toISOString().slice(0, 10) })}>Add staff</Button>
          </>
        }
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search name, ID, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search staff" />
          </div>
          <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
            <option value="all">All departments</option>
            {db.departments.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<Users />} title="No staff found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Emp ID</th><th>Department</th><th>Designation</th><th>Subjects</th><th>Status</th><th className="right">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const subs = db.subjects.filter((x) => x.staffId === s.id)
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <Avatar name={s.name} size={32} />
                          <div><strong>{s.name}</strong><div className="muted tiny">{s.email}</div></div>
                        </div>
                      </td>
                      <td className="mono">{s.empId}</td>
                      <td>{s.department}</td>
                      <td>{s.designation}</td>
                      <td>{subs.length ? <span title={subs.map((x) => x.name).join(', ')}>{subs.length} assigned</span> : <span className="muted">—</span>}</td>
                      <td><Badge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge></td>
                      <td className="right nowrap">
                        <button className="icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={16} /></button>
                        <button className="icon-btn danger" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing && (
        <StaffForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            const isNew = !s.id
            update((d) => {
              if (isNew) d.staff.push({ ...s, id: uid('stf') })
              else d.staff = d.staff.map((x) => (x.id === s.id ? s : x))
            })
            toast(isNew ? `${s.name} added` : 'Staff updated')
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function StaffForm({ initial, onClose, onSave }: { initial: Staff; onClose: () => void; onSave: (s: Staff) => void }) {
  const { db } = useStore()
  const [f, setF] = useState(initial)
  const [touched, setTouched] = useState(false)
  const set = <K extends keyof Staff>(k: K, v: Staff[K]) => setF((p) => ({ ...p, [k]: v }))
  const errors = {
    name: f.name.trim().length < 2 ? 'Name is required' : null,
    empId: !f.empId.trim() ? 'Employee ID is required' : db.staff.some((s) => s.id !== f.id && s.empId.toLowerCase() === f.empId.trim().toLowerCase()) ? 'Employee ID already exists' : null,
    email: !isValidEmail(f.email) ? 'Enter a valid email' : db.staff.some((s) => s.id !== f.id && s.email.toLowerCase() === f.email.trim().toLowerCase()) ? 'Email already in use' : null,
  }
  const hasErr = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null)
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit staff' : 'Add staff'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { setTouched(true); if (!hasErr) onSave({ ...f, name: f.name.trim(), empId: f.empId.trim().toUpperCase(), email: f.email.trim().toLowerCase() }) }}>Save</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name" error={err('name')}>{(id) => <input id={id} className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />}</Field>
        <Field label="Employee ID" error={err('empId')}>{(id) => <input id={id} className="input mono" value={f.empId} onChange={(e) => set('empId', e.target.value)} />}</Field>
        <Field label="Email" error={err('email')}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <input id={id} className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label="Department">
          {(id) => (
            <select id={id} className="input" value={f.department} onChange={(e) => set('department', e.target.value)}>
              {db.departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Designation">{(id) => <input id={id} className="input" value={f.designation} onChange={(e) => set('designation', e.target.value)} list="designations" />}</Field>
        <datalist id="designations">
          {['Professor & HoD', 'Professor', 'Associate Professor', 'Assistant Professor', 'Lab Instructor', 'Accountant', 'Office Staff'].map((d) => <option key={d} value={d} />)}
        </datalist>
        <Field label="Joined on">{(id) => <input id={id} type="date" className="input" value={f.joinedOn} onChange={(e) => set('joinedOn', e.target.value)} />}</Field>
        <Field label="Status">
          {(id) => (
            <select id={id} className="input" value={f.status} onChange={(e) => set('status', e.target.value as Staff['status'])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
