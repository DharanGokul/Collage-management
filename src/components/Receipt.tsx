import { Printer } from 'lucide-react'
import { useStore } from '../store/AppStore'
import { Button, Logo, Modal } from './ui'
import { formatDate, formatMoney } from '../lib/utils'
import type { Payment } from '../types'

const METHOD: Record<Payment['method'], string> = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', cash: 'Cash', cheque: 'Cheque' }

export function ReceiptModal({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const { db } = useStore()
  if (!payment) return null
  const s = db.students.find((x) => x.id === payment.studentId)
  const f = db.fees.find((x) => x.id === payment.feeId)
  const cur = db.branding.currency
  return (
    <Modal open title="Payment receipt" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={<Printer size={16} />} onClick={() => window.print()}>Print / Save PDF</Button></>}>
      <div className="receipt print-area">
        <div className="receipt-head">
          <Logo size={44} />
          <div>
            <h3>{db.branding.collegeName}</h3>
            <small className="muted">{db.branding.address}</small>
          </div>
        </div>
        <div className="receipt-title">
          <span>FEE RECEIPT</span>
          <span className={`badge badge-${payment.status === 'success' ? 'green' : 'red'}`}>{payment.status}</span>
        </div>
        <dl className="receipt-grid">
          <dt>Receipt no.</dt><dd className="mono">{payment.receiptNo}</dd>
          <dt>Date</dt><dd>{formatDate(payment.paidAt, { dateStyle: 'medium', timeStyle: 'short' } as Intl.DateTimeFormatOptions)}</dd>
          <dt>Student</dt><dd>{s?.name ?? '—'}</dd>
          <dt>Roll no.</dt><dd className="mono">{s?.rollNo ?? '—'}</dd>
          <dt>Class</dt><dd>{s ? `${s.department} · Year ${s.year} · Sec ${s.section}` : '—'}</dd>
          <dt>Payment mode</dt><dd>{METHOD[payment.method]}</dd>
          <dt>Transaction ref.</dt><dd className="mono">{payment.txnRef}</dd>
        </dl>
        <table className="table receipt-table">
          <tbody>
            <tr><td>{f?.name ?? 'Fee'}</td><td className="right">{formatMoney(payment.amount, cur)}</td></tr>
            {payment.lateFee > 0 && <tr><td>Late fee</td><td className="right">{formatMoney(payment.lateFee, cur)}</td></tr>}
            <tr className="total"><td>Total paid</td><td className="right">{formatMoney(payment.amount + payment.lateFee, cur)}</td></tr>
          </tbody>
        </table>
        <p className="tiny muted center">Computer-generated receipt. For queries contact {db.branding.supportEmail}.</p>
      </div>
    </Modal>
  )
}

export { METHOD as PAYMENT_METHOD_LABEL }
