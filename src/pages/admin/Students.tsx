import { useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Download, Mail, GraduationCap } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Avatar, Badge, Button, Card, Empty, Field, Modal, PageHeader } from '../../components/ui'
import { downloadCSV, isValidEmail, studentFeeStatus, summarize, uid } from '../../lib/utils'
import type { Student } from '../../types'

const blank = (dept: string, section: string): Student => ({
  id: '',
  rollNo: '',
  name: '',
  email: '',
  phone: '',
  department: dept,
  year: 1,
  section,
  guardianName: '',
  guardianPhone: '',
  status: 'active',
  joinedOn: new Date().toISOString().slice(0, 10),
})

export default function Students() {
  const { db, update, toast, sendBulkEmail } = useStore()
  const [q, setQ] = useState('')
  const [dept, setDept] = useState('all')
  const [year, setYear] = useState('all')
  const [editing, setEditing] = useState<Student | null>(null)

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return db.students.filter(
      (s) =>
        (dept === 'all' || s.department === dept) &&
        (year === 'all' || s.year === +year) &&
        (!t || s.name.toLowerCase().includes(t) || s.rollNo.toLowerCase().includes(t) || s.email.toLowerCase().includes(t)),
    )
  }, [db.students, q, dept, year])

  const remove = (s: Student) => {
    if (!confirm(`Delete ${s.name}? Their attendance and payment history will be removed as well.`)) return
    update((d) => {
      d.students = d.students.filter((x) => x.id !== s.id)
      d.payments = d.payments.filter((p) => p.studentId !== s.id)
      for (const a of d.attendance) delete a.marks[s.id]
    })
    toast(`${s.name} deleted`)
  }

  const welcome = async (s: Student) => {
    const tpl = db.templates.find((t) => t.id === 'tpl-welcome')
    if (!tpl) return toast('Welcome template not found', 'error')
    const r = await sendBulkEmail({ recipients: [{ email: s.email, vars: { name: s.name, student_name: s.name } }], subject: tpl.subject, body: tpl.body })
    r.sent ? toast(`Welcome email sent to ${s.email}`) : toast('Email failed – check Email settings', 'error')
  }

  const exportCsv = () =>
    downloadCSV('students.csv', [
      ['Roll No', 'Name', 'Email', 'Phone', 'Department', 'Year', 'Section', 'Guardian', 'Guardian Phone', 'Status'],
      ...rows.map((s) => [s.rollNo, s.name, s.email, s.phone, s.department, s.year, s.section, s.guardianName, s.guardianPhone, s.status]),
    ])

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${db.students.length} enrolled across ${db.departments.length} departments`}
        actions={
          <>
            <Button variant="secondary" icon={<Download size={16} />} onClick={exportCsv}>Export CSV</Button>
            <Button icon={<Plus size={16} />} onClick={() => setEditing(blank(db.departments[0]?.code ?? '', db.sections[0] ?? 'A'))}>Add student</Button>
          </>
        }
      />
      <Card pad={false}>
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input className="input" placeholder="Search name, roll no, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          </div>
          <select className="input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Department">
            <option value="all">All departments</option>
            {db.departments.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}
          </select>
          <select className="input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            <option value="all">All years</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
        {rows.length === 0 ? (
          <Empty icon={<GraduationCap />} title="No students match">Try clearing the filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll no</th>
                  <th>Class</th>
                  <th>Attendance</th>
                  <th>Fees</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const att = summarize(db.attendance, s.id)
                  const fees = studentFeeStatus(db, s)
                  const due = fees.filter((f) => f.status !== 'paid')
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <Avatar name={s.name} size={32} />
                          <div>
                            <strong>{s.name}</strong>
                            <div className="muted tiny">{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{s.rollNo}</td>
                      <td>{s.department} · Y{s.year} · {s.section}</td>
                      <td>
                        {att.total ? <Badge tone={att.pct >= 85 ? 'green' : att.pct >= 75 ? 'amber' : 'red'}>{att.pct}%</Badge> : <span className="muted">—</span>}
                      </td>
                      <td>
                        {due.length === 0 ? <Badge tone="green">Paid</Badge> : due.some((f) => f.status === 'overdue') ? <Badge tone="red">{due.length} overdue</Badge> : <Badge tone="amber">{due.length} due</Badge>}
                      </td>
                      <td><Badge tone={s.status === 'active' ? 'green' : 'gray'}>{s.status}</Badge></td>
                      <td className="right nowrap">
                        <button className="icon-btn" title="Send welcome email" aria-label={`Email ${s.name}`} onClick={() => welcome(s)}><Mail size={16} /></button>
                        <button className="icon-btn" title="Edit" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={16} /></button>
                        <button className="icon-btn danger" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 size={16} /></button>
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
        <StudentForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(s) => {
            const isNew = !s.id
            update((d) => {
              if (isNew) d.students.push({ ...s, id: uid('stu') })
              else d.students = d.students.map((x) => (x.id === s.id ? s : x))
            })
            toast(isNew ? `${s.name} added` : 'Student updated')
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

function StudentForm({ initial, onClose, onSave }: { initial: Student; onClose: () => void; onSave: (s: Student) => void }) {
  const { db } = useStore()
  const [f, setF] = useState(initial)
  const [touched, setTouched] = useState(false)
  const set = <K extends keyof Student>(k: K, v: Student[K]) => setF((p) => ({ ...p, [k]: v }))
  const errors = {
    name: f.name.trim().length < 2 ? 'Name is required' : null,
    rollNo: !f.rollNo.trim() ? 'Roll number is required' : db.students.some((s) => s.id !== f.id && s.rollNo.toLowerCase() === f.rollNo.trim().toLowerCase()) ? 'Roll number already exists' : null,
    email: !isValidEmail(f.email) ? 'Enter a valid email' : db.students.some((s) => s.id !== f.id && s.email.toLowerCase() === f.email.trim().toLowerCase()) ? 'Email already in use' : null,
  }
  const hasErr = Object.values(errors).some(Boolean)
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null)

  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? 'Edit student' : 'Add student'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!hasErr) onSave({ ...f, name: f.name.trim(), rollNo: f.rollNo.trim().toUpperCase(), email: f.email.trim().toLowerCase() })
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Full name" error={err('name')}>{(id) => <input id={id} className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />}</Field>
        <Field label="Roll number" error={err('rollNo')}>{(id) => <input id={id} className="input mono" value={f.rollNo} onChange={(e) => set('rollNo', e.target.value)} />}</Field>
        <Field label="Email" error={err('email')}>{(id) => <input id={id} type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label="Phone">{(id) => <input id={id} className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        <Field label="Department">
          {(id) => (
            <select id={id} className="input" value={f.department} onChange={(e) => set('department', e.target.value)}>
              {db.departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <div className="form-grid inner">
          <Field label="Year">
            {(id) => (
              <select id={id} className="input" value={f.year} onChange={(e) => set('year', +e.target.value)}>
                {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </Field>
          <Field label="Section">
            {(id) => (
              <select id={id} className="input" value={f.section} onChange={(e) => set('section', e.target.value)}>
                {db.sections.map((s) => <option key={s}>{s}</option>)}
              </select>
            )}
          </Field>
        </div>
        <Field label="Guardian name">{(id) => <input id={id} className="input" value={f.guardianName} onChange={(e) => set('guardianName', e.target.value)} />}</Field>
        <Field label="Guardian phone">{(id) => <input id={id} className="input" value={f.guardianPhone} onChange={(e) => set('guardianPhone', e.target.value)} />}</Field>
        <Field label="Joined on">{(id) => <input id={id} type="date" className="input" value={f.joinedOn} onChange={(e) => set('joinedOn', e.target.value)} />}</Field>
        <Field label="Status">
          {(id) => (
            <select id={id} className="input" value={f.status} onChange={(e) => set('status', e.target.value as Student['status'])}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          )}
        </Field>
      </div>
    </Modal>
  )
}
