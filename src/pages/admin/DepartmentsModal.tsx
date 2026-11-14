import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Field, Modal } from '../../components/ui'

/** Admin tool: add / rename / remove departments and appoint each department's HOD. */
export default function DepartmentsModal({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const c = code.trim().toUpperCase()
  const err = !c ? 'Code is required' : !/^[A-Z0-9]{2,8}$/.test(c) ? 'Use 2-8 letters or digits' : db.departments.some((d) => d.code === c) ? 'Code already exists' : null
  const nameErr = name.trim().length < 2 ? 'Name is required' : null

  const usage = (dc: string) =>
    db.students.filter((s) => s.department === dc).length + db.staff.filter((s) => s.department === dc).length + db.subjects.filter((s) => s.department === dc).length

  const add = () => {
    setTouched(true)
    if (err || nameErr) return
    update((d) => { d.departments.push({ code: c, name: name.trim(), hodId: null }) })
    toast(`${name.trim()} added`)
    setCode(''); setName(''); setTouched(false)
  }
  const remove = (dc: string, dn: string) => {
    if (usage(dc) > 0) return toast(`${dn} still has students, staff or subjects - move them first`, 'error')
    if (!confirm(`Delete department ${dn}?`)) return
    update((d) => { d.departments = d.departments.filter((x) => x.code !== dc) })
    toast(`${dn} deleted`)
  }
  const setHod = (dc: string, id: string) => {
    toast(id ? 'HOD appointed' : 'HOD removed')
    update((d) => {
      // A person heads one department only.
      if (id) for (const x of d.departments) if (x.hodId === id) x.hodId = null
      const x = d.departments.find((y) => y.code === dc)
      if (x) x.hodId = id || null
    })
  }

  return (
    <Modal open title="Departments & HODs" onClose={onClose} wide footer={<Button onClick={onClose}>Done</Button>}>
      <p className="muted tiny">The HOD is the first approver for their department's leave, purchase and repair requests. Department codes cannot be changed once created.</p>
      <div className="stack-s" style={{ margin: '12px 0' }}>
        {db.departments.map((d) => (
          <div key={d.code} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border, rgba(128,128,128,.25))' }}>
            <div style={{ flex: '1 1 160px', minWidth: 0 }}><strong>{d.name}</strong> <span className="muted tiny mono">{d.code}</span></div>
            <select className="input sm" style={{ flex: '1 1 160px', minWidth: 0 }} aria-label={`HOD for ${d.name}`} value={d.hodId ?? ''} onChange={(e) => setHod(d.code, e.target.value)}>
              <option value="">HOD: not appointed</option>
              {db.staff.filter((s) => s.status === 'active' && (s.department === d.code || s.id === d.hodId)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="icon-btn danger" aria-label={`Delete ${d.name}`} onClick={() => remove(d.code, d.name)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <h4 style={{ margin: '16px 0 8px' }}>Add department</h4>
      <div className="form-grid">
        <Field label="Code" error={touched ? err : null}>{(id) => <input id={id} className="input mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MBA" maxLength={8} />}</Field>
        <Field label="Name" error={touched ? nameErr : null}>{(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Administration" onKeyDown={(e) => e.key === 'Enter' && add()} />}</Field>
      </div>
      <Button icon={<Plus size={16} />} variant="secondary" onClick={add}>Add department</Button>
    </Modal>
  )
}
