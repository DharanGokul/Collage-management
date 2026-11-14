import type { AttendanceSession, Database, FeeItem, Payment, Student } from '../types'

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

export const classKey = (dept: string, year: number, section: string) => `${dept}|${year}|${section}`

export const classLabel = (key: string) => {
  const [d, y, s] = key.split('|')
  return `${d} · Year ${y} · Sec ${s}`
}

export const studentClassKey = (s: Pick<Student, 'department' | 'year' | 'section'>) =>
  classKey(s.department, s.year, s.section)

export function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday = 0 … Sunday = 6 */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

export function formatMoney(amount: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = iso.length === 10 ? new Date(iso + 'T00:00:00') : new Date(iso)
  // toLocaleDateString rejects time options, so use toLocaleString when they're present.
  const hasTime = 'timeStyle' in opts || 'hour' in opts || 'minute' in opts
  return hasTime ? d.toLocaleString(undefined, opts) : d.toLocaleDateString(undefined, opts)
}

export const initials = (name: string) =>
  name
    .replace(/^(Dr|Prof|Ms|Mr|Mrs)\.\s*/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

export const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

/* ---------- Fees ---------- */

export const feeAppliesTo = (fee: FeeItem, s: Student) =>
  (fee.department === 'All' || fee.department === s.department) && (fee.year === 0 || fee.year === s.year)

export function lateFeeFor(fee: FeeItem, onDate = new Date()) {
  if (!fee.lateFeePerDay) return 0
  const due = new Date(fee.dueDate + 'T23:59:59')
  const days = Math.floor((onDate.getTime() - due.getTime()) / 86400000) + 1
  return days > 0 ? days * fee.lateFeePerDay : 0
}

export interface FeeStatus {
  fee: FeeItem
  payment: Payment | undefined
  lateFee: number
  total: number
  status: 'paid' | 'due' | 'overdue'
}

// Index successful payments by student+fee. Cached per payments array (arrays are replaced on every update),
// so looking up fee status is O(1) instead of scanning every payment for every student.
const paymentIndexCache = new WeakMap<Payment[], Map<string, Payment>>()
function paymentIndex(payments: Payment[]) {
  let idx = paymentIndexCache.get(payments)
  if (!idx) {
    idx = new Map()
    for (const p of payments) if (p.status === 'success' && !idx.has(`${p.studentId}|${p.feeId}`)) idx.set(`${p.studentId}|${p.feeId}`, p)
    paymentIndexCache.set(payments, idx)
  }
  return idx
}

export function studentFeeStatus(db: Database, s: Student): FeeStatus[] {
  const idx = paymentIndex(db.payments)
  return db.fees
    .filter((f) => feeAppliesTo(f, s))
    .map((fee) => {
      const payment = idx.get(`${s.id}|${fee.id}`)
      const lateFee = payment ? payment.lateFee : lateFeeFor(fee)
      const overdue = !payment && new Date(fee.dueDate + 'T23:59:59') < new Date()
      return {
        fee,
        payment,
        lateFee,
        total: fee.amount + lateFee,
        status: payment ? 'paid' : overdue ? 'overdue' : 'due',
      }
    })
}

/* ---------- Attendance ---------- */

export interface AttendanceSummary {
  total: number
  present: number
  late: number
  absent: number
  pct: number
}

export function summarize(sessions: AttendanceSession[], studentId: string): AttendanceSummary {
  let total = 0,
    present = 0,
    late = 0,
    absent = 0
  for (const s of sessions) {
    const m = s.marks[studentId]
    if (!m) continue
    total++
    if (m === 'P') present++
    else if (m === 'L') late++
    else absent++
  }
  // Late counts as present for percentage purposes.
  const pct = total ? Math.round(((present + late) / total) * 1000) / 10 : 0
  return { total, present, late, absent, pct }
}

export function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m))
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => {
      // Strip float noise (0.1+0.2); neutralise spreadsheet formulas in text cells.
      let v = typeof c === 'number' ? String(Math.round(c * 1e6) / 1e6) : String(c)
      if (typeof c === 'string' && /^[=@]/.test(v)) v = `'${v}`
      return `"${v.replace(/"/g, '""')}"`
    }).join(','))
    .join('\r\n')
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }) // BOM so Excel reads UTF-8 (₹, names)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const newReceiptNo = () =>
  `RCPT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 4).toUpperCase()}`
