import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Field, Modal, PageHeader } from '../../components/ui'
import { uid } from '../../lib/utils'
import type { Subject } from '../../types'

export default function Subjects() {
  const { db, update, toast } = useStore()
  const [dept, setDept] = useState(db.departments[0]?.code ?? '')
  const [adding, setAdding] = useState(false)
  const list = db.subjects.filter((s) => s.department === dept).sort((a, b) => a.year - b.year || a.code.localeCompare(b.code))

  const remove = (s: Subject) => {
    const slots = db.timetable.filter((t) => t.subjectId === s.id).length
    if (!confirm(`Delete ${s.name}?${slots ? ` It is used in ${slots} timetable slot(s), which will be cleared.` : ''}`)) return
    update((d) => {
      d.subjects = d.subjects.filter((x) => x.id !== s.id)
      d.timetable = d.timetable.filter((t) => t.subjectId !== s.id)
    })
    toast('Subject deleted')
  }

  return (
    <>
      <PageHeader title="Subjects" subtitle="Courses offered and the faculty who teach them" actions={<Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add subject</Button>} />
      <Card pad={false}>
        <div className="toolbar">
          <div className="chips">
            {db.departments.map((d) => (
              <button key={d.code} className={`chip ${dept === d.code ? 'active' : ''}`} onClick={() => setDept(d.code)}>{d.code}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Subject</th><th>Year</th><th>Credits</th><th>Faculty</th><th /></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td><strong>{s.name}</strong></td>
                  <td>Year {s.year}</td>
                  <td>{s.credits}</td>
                  <td>
                    <select
                      className="input sm"
                      aria-label={`Faculty for ${s.name}`}
                      value={s.staffId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value || null
                        update((d) => {
                          const x = d.subjects.find((y) => y.id === s.id)
                          if (x) x.staffId = v
                        })
                        toast('Faculty assigned')
                      }}
                    >
                      <option value="">Unassigned</option>
                      {db.staff.filter((x) => x.status === 'active').map((x) => <option key={x.id} value={x.id}>{x.name} ({x.department})</option>)}
                    </select>
                  </td>
                  <td className="right"><button className="icon-btn danger" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="center muted">No subjects yet for {dept}.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      {adding && <SubjectForm dept={dept} onClose={() => setAdding(false)} onSave={(s) => { update((d) => { d.subjects.push(s) }); toast(`${s.name} added`); setAdding(false) }} />}
    </>
  )
}

function SubjectForm({ dept, onClose, onSave }: { dept: string; onClose: () => void; onSave: (s: Subject) => void }) {
  const { db } = useStore()
  const [f, setF] = useState<Subject>({ id: uid('sub'), code: '', name: '', department: dept, year: 1, staffId: null, credits: 3 })
  const dup = db.subjects.some((s) => s.code.toLowerCase() === f.code.trim().toLowerCase())
  const valid = f.name.trim().length > 1 && f.code.trim().length > 1 && !dup
  return (
    <Modal open title="Add subject" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => onSave({ ...f, code: f.code.trim().toUpperCase(), name: f.name.trim() })}>Add</Button></>}>
      <div className="form-grid">
        <Field label="Code" error={dup ? 'Code already exists' : null}>{(id) => <input id={id} className="input mono" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} autoFocus />}</Field>
        <Field label="Name">{(id) => <input id={id} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Department">{(id) => <select id={id} className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{db.departments.map((d) => <option key={d.code} value={d.code}>{d.code}</option>)}</select>}</Field>
        <Field label="Year">{(id) => <select id={id} className="input" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}>{[1, 2, 3, 4].map((y) => <option key={y}>{y}</option>)}</select>}</Field>
        <Field label="Credits">{(id) => <input id={id} type="number" min={1} max={10} className="input" value={f.credits} onChange={(e) => setF({ ...f, credits: Math.max(1, +e.target.value || 1) })} />}</Field>
        <Field label="Faculty">{(id) => <select id={id} className="input" value={f.staffId ?? ''} onChange={(e) => setF({ ...f, staffId: e.target.value || null })}><option value="">Unassigned</option>{db.staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</Field>
      </div>
    </Modal>
  )
}
