import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Modal } from '../../components/ui'
import { downloadCSV, isValidEmail, uid } from '../../lib/utils'
import type { Student } from '../../types'

const HEADERS = ['Roll No', 'Name', 'Email', 'Phone', 'Department', 'Year', 'Section', 'Guardian', 'Guardian Phone']

/** Minimal RFC-4180 style CSV parser (quotes, escaped quotes, CRLF, BOM). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = [] }
    else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows
}

/** Bulk-add students from a CSV (same columns as the Export CSV). Invalid / duplicate rows are skipped and listed. */
export default function StudentImport({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const ref = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [good, setGood] = useState<Student[]>([])
  const [bad, setBad] = useState<string[]>([])

  const read = async (f?: File) => {
    if (!f) return
    setFileName(f.name)
    if (f.size > 5 * 1024 * 1024) { setGood([]); return setBad(['File is larger than 5 MB - split it into batches.']) }
    const rows = parseCsv(await f.text())
    const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase())
    const col = (name: string) => head.indexOf(name.toLowerCase())
    if (col('roll no') < 0 || col('name') < 0 || col('email') < 0) { setGood([]); return setBad(['Header row must contain at least: Roll No, Name, Email. Download the template to see the layout.']) }
    const get = (r: string[], name: string) => (r[col(name)] ?? '').trim()
    const rolls = new Set(db.students.map((s) => s.rollNo.toLowerCase()))
    const emails = new Set(db.students.map((s) => s.email.toLowerCase()))
    const ok: Student[] = [], errs: string[] = []
    rows.slice(1).forEach((r, i) => {
      const line = i + 2
      const roll = get(r, 'Roll No').toUpperCase(), name = get(r, 'Name'), email = get(r, 'Email').toLowerCase()
      const dept = get(r, 'Department').toUpperCase() || db.departments[0]?.code || ''
      const year = +get(r, 'Year') || 1
      const section = get(r, 'Section').toUpperCase() || db.sections[0] || 'A'
      const why = !roll ? 'missing roll no' : !name ? 'missing name' : !isValidEmail(email) ? 'invalid email' : rolls.has(roll.toLowerCase()) ? 'roll no already exists' : emails.has(email) ? 'email already in use' : !db.departments.some((d) => d.code === dept) ? `unknown department "${dept}"` : year < 1 || year > 4 ? 'year must be 1-4' : null
      if (why) return void errs.push(`Line ${line} (${roll || name || 'blank'}): ${why}`)
      rolls.add(roll.toLowerCase()); emails.add(email)
      ok.push({ id: uid('stu'), rollNo: roll, name, email, phone: get(r, 'Phone'), department: dept, year, section, guardianName: get(r, 'Guardian'), guardianPhone: get(r, 'Guardian Phone'), status: 'active', joinedOn: new Date().toISOString().slice(0, 10) })
    })
    setGood(ok); setBad(errs)
  }

  return (
    <Modal open title="Import students from CSV" onClose={onClose} wide footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!good.length} onClick={() => { update((d) => { d.students.push(...good) }); toast(`${good.length} students imported${bad.length ? `, ${bad.length} skipped` : ''}`); onClose() }}>Import {good.length || ''} students</Button>
      </>
    }>
      <div className="stack">
        <p className="muted tiny">Columns: {HEADERS.join(', ')}. Department must be an existing code; year 1-4. Rows with duplicate roll numbers or emails are skipped.</p>
        <div className="row gap-s">
          <Button variant="secondary" icon={<Upload size={16} />} onClick={() => ref.current?.click()}>Choose CSV file</Button>
          <Button variant="ghost" icon={<Download size={16} />} onClick={() => downloadCSV('students-template.csv', [HEADERS, ['CS2025001', 'Asha Verma', 'asha@example.com', '9876543210', db.departments[0]?.code ?? 'CSE', 1, 'A', 'Mr Verma', '9876543211']])}>Template</Button>
          <input ref={ref} type="file" hidden accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => { read(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {fileName && <p className="tiny"><strong>{fileName}</strong>: {good.length} ready to import, {bad.length} problem{bad.length === 1 ? '' : 's'}</p>}
        {bad.length > 0 && <div className="alert alert-warn" role="alert" style={{ maxHeight: 180, overflow: 'auto' }}>{bad.slice(0, 50).map((b) => <div key={b}>{b}</div>)}{bad.length > 50 && <div>...and {bad.length - 50} more</div>}</div>}
      </div>
    </Modal>
  )
}
