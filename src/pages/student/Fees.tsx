import { useState } from 'react'
import { CreditCard, Smartphone, Landmark, Lock, CheckCircle2, Receipt } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { useNow } from '../../lib/useNow'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Segmented } from '../../components/ui'
import { ReceiptModal, PAYMENT_METHOD_LABEL } from '../../components/Receipt'
import { formatDate, formatMoney, newReceiptNo, studentFeeStatus, uid, type FeeStatus } from '../../lib/utils'
import type { Payment } from '../../types'

export default function StudentFees() {
  const { db, session } = useStore()
  const me = db.students.find((s) => s.id === session?.userId)
  const [paying, setPaying] = useState<FeeStatus | null>(null)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  if (!me) return <Empty title="Student record not found" />
  const cur = db.branding.currency
  const fees = studentFeeStatus(db, me)
  const history = db.payments.filter((p) => p.studentId === me.id).sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  const due = fees.filter((f) => f.status !== 'paid')

  return (
    <>
      <PageHeader title="Fee payment" subtitle="Pay securely online and download receipts instantly" />
      <div className="grid stats-grid three">
        <div className="card stat-plain"><small className="muted">Total payable</small><strong>{formatMoney(due.reduce((a, f) => a + f.total, 0), cur)}</strong></div>
        <div className="card stat-plain"><small className="muted">Total paid</small><strong>{formatMoney(history.filter((p) => p.status === 'success').reduce((a, p) => a + p.amount + p.lateFee, 0), cur)}</strong></div>
        <div className="card stat-plain"><small className="muted">Next due</small><strong>{due[0] ? formatDate(due[0].fee.dueDate) : '—'}</strong></div>
      </div>
      <Card title="Fee items" pad={false}>
        {fees.length === 0 ? <Empty title="No fees assigned" /> : (
          <ul className="fee-list">
            {fees.map((f) => (
              <li key={f.fee.id} className={f.status}>
                <div className="fee-main">
                  <strong>{f.fee.name}</strong>
                  <small className="muted">{f.fee.term} · Due {formatDate(f.fee.dueDate)}</small>
                </div>
                <div className="fee-amt">
                  <strong>{formatMoney(f.total, cur)}</strong>
                  {f.lateFee > 0 && <small className="text-red">incl. {formatMoney(f.lateFee, cur)} late fee</small>}
                </div>
                <div className="fee-act">
                  {f.status === 'paid' ? (
                    <>
                      <Badge tone="green">Paid</Badge>
                      <Button size="sm" variant="ghost" icon={<Receipt size={14} />} onClick={() => setReceipt(f.payment!)}>Receipt</Button>
                    </>
                  ) : (
                    <>
                      {f.status === 'overdue' ? <Badge tone="red">Overdue</Badge> : <Badge tone="amber">Due</Badge>}
                      <Button size="sm" onClick={() => setPaying(f)}>Pay now</Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Payment history" pad={false}>
        {history.length === 0 ? <Empty title="No payments yet" /> : (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Table (scrolls sideways)">
            <table className="table">
              <thead><tr><th>Date</th><th>Fee</th><th className="hide-sm">Mode</th><th>Amount</th><th className="hide-sm">Status</th><th /></tr></thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.paidAt)}</td>
                    <td>{db.fees.find((f) => f.id === p.feeId)?.name}</td>
                    <td className="hide-sm">{PAYMENT_METHOD_LABEL[p.method]}</td>
                    <td><strong>{formatMoney(p.amount + p.lateFee, cur)}</strong></td>
                    <td className="hide-sm"><Badge tone={p.status === 'success' ? 'green' : 'gray'}>{p.status}</Badge></td>
                    <td className="right"><button className="icon-btn" aria-label="Receipt" onClick={() => setReceipt(p)}><Receipt size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {paying && <Checkout item={paying} onClose={() => setPaying(null)} onPaid={(p) => { setPaying(null); setReceipt(p) }} />}
      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />
    </>
  )
}

const luhn = (num: string) => {
  let sum = 0
  let dbl = false
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i]
    if (dbl) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    dbl = !dbl
  }
  return num.length >= 13 && sum % 10 === 0
}

function Checkout({ item, onClose, onPaid }: { item: FeeStatus; onClose: () => void; onPaid: (p: Payment) => void }) {
  const { db, session, update, sendBulkEmail, toast } = useStore()
  const cur = db.branding.currency
  const [method, setMethod] = useState<'upi' | 'card' | 'netbanking'>('upi')
  const [vpa, setVpa] = useState('')
  const [card, setCard] = useState({ number: '', name: '', exp: '', cvv: '' })
  const [bank, setBank] = useState('')
  const [stage, setStage] = useState<'form' | 'processing' | 'done'>('form')
  const [touched, setTouched] = useState(false)

  const digits = card.number.replace(/\D/g, '')
  const [mm, yy] = card.exp.split('/').map((x) => +x)
  const nowD = new Date(useNow())
  const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 0) >= new Date(nowD.getFullYear(), nowD.getMonth(), 1)
  const error =
    method === 'upi' ? (!/^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa.trim()) ? 'Enter a valid UPI ID, e.g. name@okbank' : null)
    : method === 'card' ? (!luhn(digits) ? 'Card number is invalid' : !card.name.trim() ? 'Name on card is required' : !expOk ? 'Expiry must be a future MM/YY' : !/^\d{3,4}$/.test(card.cvv) ? 'CVV must be 3–4 digits' : null)
    : !bank ? 'Select your bank' : null

  const pay = async () => {
    setTouched(true)
    if (error || stage !== 'form') return
    setStage('processing')
    await new Promise((r) => setTimeout(r, 1600))
    const me = db.students.find((s) => s.id === session?.userId)!
    const p: Payment = { id: uid('pay'), receiptNo: newReceiptNo(), studentId: me.id, feeId: item.fee.id, amount: item.fee.amount, lateFee: item.lateFee, method, txnRef: `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`, paidAt: new Date().toISOString(), status: 'success', recordedBy: 'online' }
    update((d) => { d.payments.push(p) })
    setStage('done')
    toast('Payment successful')
    const tpl = db.templates.find((t) => t.id === 'tpl-fee-receipt')
    if (tpl) sendBulkEmail({ subject: tpl.subject, body: tpl.body, recipients: [{ email: me.email, vars: { name: me.name, student_name: me.name, amount: formatMoney(p.amount + p.lateFee, cur), fee_name: item.fee.name, receipt_no: p.receiptNo, txn_ref: p.txnRef } }] })
    setTimeout(() => onPaid(p), 900)
  }

  return (
    <Modal open title="Secure checkout" onClose={stage === 'processing' ? () => {} : onClose}>
      {stage === 'done' ? (
        <div className="center stack pay-done"><CheckCircle2 size={56} className="text-green" /><h3>Payment successful</h3><p className="muted">Opening your receipt…</p></div>
      ) : (
        <div className="stack">
          <div className="checkout-sum">
            <div><small className="muted">Paying for</small><strong>{item.fee.name}</strong></div>
            <div className="right"><small className="muted">Amount</small><strong className="big">{formatMoney(item.total, cur)}</strong></div>
          </div>
          <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ id: 'upi', label: 'UPI', icon: <Smartphone size={16} /> }, { id: 'card', label: 'Card', icon: <CreditCard size={16} /> }, { id: 'netbanking', label: 'Netbanking', icon: <Landmark size={16} /> }]} />
          {method === 'upi' && <Field label="UPI ID">{(id) => <input id={id} className="input" placeholder="yourname@okbank" value={vpa} onChange={(e) => setVpa(e.target.value)} autoFocus />}</Field>}
          {method === 'card' && (
            <div className="form-grid">
              <Field label="Card number" span={2}>{(id) => <input id={id} className="input mono" inputMode="numeric" autoComplete="cc-number" placeholder="4111 1111 1111 1111" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ') })} />}</Field>
              <Field label="Name on card" span={2}>{(id) => <input id={id} className="input" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />}</Field>
              <Field label="Expiry (MM/YY)">{(id) => <input id={id} className="input mono" inputMode="numeric" autoComplete="cc-exp" placeholder="08/29" value={card.exp} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); setCard({ ...card, exp: v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v }) }} />}</Field>
              <Field label="CVV">{(id) => <input id={id} className="input mono" type="password" inputMode="numeric" autoComplete="cc-csc" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} />}</Field>
            </div>
          )}
          {method === 'netbanking' && (
            <div className="bank-grid">
              {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak', 'Canara Bank'].map((b) => <button key={b} className={`provider ${bank === b ? 'active' : ''}`} onClick={() => setBank(b)} aria-pressed={bank === b}><strong>{b}</strong></button>)}
            </div>
          )}
          {touched && error && <div className="alert alert-error">{error}</div>}
          <Button className="w-full" icon={<Lock size={16} />} loading={stage === 'processing'} onClick={pay}>{stage === 'processing' ? 'Processing…' : `Pay ${formatMoney(item.total, cur)}`}</Button>
          <p className="tiny muted center">Demo gateway — no real money is charged. Connect Razorpay, Stripe or PayU on your backend for live payments.</p>
        </div>
      )}
    </Modal>
  )
}
