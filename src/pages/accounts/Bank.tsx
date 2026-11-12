import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Upload, Wand2, Landmark, Link2, CheckCircle2, CircleDashed, Search } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Pager, Progress, Stat, usePaged } from '../../components/ui'
import { ReportActions, money2, usePeriod } from './common'
import { accountBalance, inPeriod, parseStatementCsv, periodLabel, periodRange, suggestMatch } from '../../lib/finance'
import { downloadCSV, formatDate, uid } from '../../lib/utils'
import type { BankTxn } from '../../types'

export default function Bank() {
  const { db, update, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const [acc, setAcc] = useState(db.bankAccounts[0]?.id ?? '')
  const [show, setShow] = useState<'all' | 'unmatched'>('all')
  const [q, setQ] = useState('')
  const [importing, setImporting] = useState(false)
  const [manual, setManual] = useState<BankTxn | null>(null)
  const { period, picker } = usePeriod('month')

  useEffect(() => {
    if (params.get('import')) {
      setImporting(true)
      params.delete('import')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const account = db.bankAccounts.find((a) => a.id === acc)
  const [from] = periodRange(period)
  const opening = useMemo(() => {
    const prev = new Date(from + 'T00:00:00')
    prev.setDate(prev.getDate() - 1)
    return accountBalance(db, acc, prev.toISOString().slice(0, 10))
  }, [db, acc, from])
  const lines = useMemo(() => {
    let bal = opening
    return db.bankTxns
      .filter((t) => t.accountId === acc && inPeriod(t.date, period))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
      .map((t) => ((bal += t.credit - t.debit), { ...t, balance: bal }))
      .reverse() // newest first, like net banking; balances computed in date order above
  }, [db.bankTxns, acc, period, opening])
  const shown = lines.filter((l) => (show === 'all' || !l.match) && (!q.trim() || `${l.description} ${l.ref}`.toLowerCase().includes(q.trim().toLowerCase())))
  const paged = usePaged(shown, 30)
  const credits = lines.reduce((a, l) => a + l.credit, 0)
  const debits = lines.reduce((a, l) => a + l.debit, 0)
  const matched = lines.filter((l) => l.match).length
  const unmatched = lines.length - matched

  const autoMatch = () => {
    let n = 0
    update((d) => {
      for (const t of d.bankTxns.filter((x) => x.accountId === acc && !x.match && inPeriod(x.date, period))) {
        const m = suggestMatch(d, t)
        if (m) {
          t.match = m
          n++
        }
      }
    })
    toast(n ? `${n} line${n > 1 ? 's' : ''} reconciled automatically` : 'No new matches found', n ? 'success' : 'info')
  }

  const describe = (t: BankTxn) => {
    if (!t.match) return null
    if (t.match.type === 'payment') {
      const p = db.payments.find((x) => x.id === t.match!.id)
      const s = db.students.find((x) => x.id === p?.studentId)
      return `Fee · ${s?.name ?? ''} · ${p?.receiptNo ?? ''}`
    }
    if (t.match.type === 'bill') {
      const b = db.bills.find((x) => x.id === t.match!.id)
      return `Bill ${b?.billNo ?? ''} · ${db.vendors.find((v) => v.id === b?.vendorId)?.name ?? ''}`
    }
    if (t.match.type === 'invoice') return `Invoice ${db.invoices.find((x) => x.id === t.match!.id)?.invoiceNo ?? ''}`
    return t.match.note ?? 'Reconciled manually'
  }

  return (
    <>
      <PageHeader title="Bank & reconciliation" subtitle={`Statements by month or year · ${periodLabel(period)}`} actions={<>{picker}<Button variant="secondary" icon={<Wand2 size={16} />} onClick={autoMatch}>Auto-reconcile</Button><Button icon={<Upload size={16} />} onClick={() => setImporting(true)}>Import statement</Button></>} />
      <div className="bank-accounts">
        {db.bankAccounts.map((a) => (
          <button key={a.id} className={`bank-card ${a.id === acc ? 'active' : ''}`} onClick={() => setAcc(a.id)}>
            <span className="row gap-s"><Landmark size={18} /><strong>{a.bank}</strong></span>
            <span className="tiny muted">{a.accountName}</span>
            <span className="mono tiny">•••• {a.accountNo.slice(-4)} · {a.ifsc}</span>
            <span className="bank-bal">{money2(accountBalance(db, a.id))}</span>
          </button>
        ))}
      </div>
      <div className="grid stats-grid">
        <Stat label="Opening balance" value={money2(opening)} icon={<Landmark size={20} />} />
        <Stat label="Credits" value={money2(credits)} icon={<Landmark size={20} />} tone="green" />
        <Stat label="Debits" value={money2(debits)} icon={<Landmark size={20} />} tone="red" />
        <Stat label="Reconciled" value={`${lines.length ? Math.round((matched / lines.length) * 100) : 100}%`} icon={<CheckCircle2 size={20} />} tone={unmatched ? 'amber' : 'green'} hint={`${unmatched} unmatched line${unmatched === 1 ? '' : 's'}`} />
      </div>
      <Card pad={false} title={account ? `${account.bank} · •••• ${account.accountNo.slice(-4)}` : 'Statement'}>
        <div className="toolbar">
          <div className="search"><Search size={16} /><input className="input" placeholder="Description or reference…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search statement" /></div>
          <select className="input" value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label="Show"><option value="all">All lines</option><option value="unmatched">Unmatched only</option></select>
          <div style={{ minWidth: 140, flex: '0 1 200px' }}><Progress value={lines.length ? (matched / lines.length) * 100 : 100} /></div>
          <span className="spacer" />
          <ReportActions onCsv={() => downloadCSV(`statement-${account?.bank.replace(/\s+/g, '-')}-${periodLabel(period).replace(/\s+/g, '-')}.csv`, [['Date', 'Description', 'Ref', 'Debit', 'Credit', 'Balance', 'Reconciled with'], ...lines.map((l) => [l.date, l.description, l.ref, l.debit || '', l.credit || '', l.balance, describe(l) ?? 'UNMATCHED'])])} />
        </div>
        {shown.length === 0 ? <Empty icon={<Landmark />} title="No statement lines">Import the bank’s CSV for this period.</Empty> : (
          <div className="table-wrap print-area">
            <h3 className="print-only">{account?.bank} statement · {periodLabel(period)} · opening {money2(opening)}</h3>
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th className="right">Debit</th><th className="right">Credit</th><th className="right hide-sm">Balance</th><th>Reconciliation</th></tr></thead>
              <tbody>
                {paged.items.map((l) => {
                  const sug = !l.match ? suggestMatch(db, l) : undefined
                  return (
                    <tr key={l.id}>
                      <td className="nowrap">{formatDate(l.date, { day: 'numeric', month: 'short' })}</td>
                      <td>{l.description}<div className="muted tiny mono">{l.ref}</div></td>
                      <td className="right text-red">{l.debit ? money2(l.debit) : ''}</td>
                      <td className="right text-green">{l.credit ? money2(l.credit) : ''}</td>
                      <td className="right hide-sm">{money2(l.balance)}</td>
                      <td>
                        {l.match ? (
                          <span className="row gap-s tiny" style={{ flexWrap: 'nowrap' }}><CheckCircle2 size={14} className="text-green" /><span className="ellipsis" style={{ maxWidth: 220 }}>{describe(l)}</span></span>
                        ) : (
                          <span className="row gap-s">
                            <Badge tone="amber"><CircleDashed size={12} /> unmatched</Badge>
                            {sug && <Button size="sm" variant="secondary" icon={<Link2 size={12} />} onClick={() => { update((d) => { const x = d.bankTxns.find((y) => y.id === l.id); if (x) x.match = sug }); toast('Matched') }}>Match</Button>}
                            <Button size="sm" variant="ghost" onClick={() => setManual(l)}>Mark</Button>
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot><tr><td colSpan={2}><strong>Closing balance</strong></td><td className="right">{money2(debits)}</td><td className="right">{money2(credits)}</td><td className="right hide-sm"><strong>{money2(opening + credits - debits)}</strong></td><td /></tr></tfoot>
            </table>
          </div>
        )}
        <Pager {...paged} />
      </Card>
      {importing && <ImportStatement defaultAccount={acc} onClose={() => setImporting(false)} />}
      {manual && (
        <ManualMatch
          txn={manual}
          onClose={() => setManual(null)}
          onSave={(note) => {
            update((d) => { const x = d.bankTxns.find((y) => y.id === manual.id); if (x) x.match = { type: 'manual', id: uid('man'), note } })
            toast('Marked as reconciled')
            setManual(null)
          }}
        />
      )}
    </>
  )
}

function ManualMatch({ txn, onClose, onSave }: { txn: BankTxn; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState(txn.debit ? 'Bank charges' : 'Inter-account transfer')
  return (
    <Modal open title="Mark as reconciled" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!note.trim()} onClick={() => onSave(note.trim())}>Save</Button></>}>
      <p className="tiny">{formatDate(txn.date)} · {txn.description} · {txn.debit ? `Debit ${money2(txn.debit)}` : `Credit ${money2(txn.credit)}`}</p>
      <Field label="Explanation">{(id) => <select id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)}>{['Bank charges', 'Inter-account transfer', 'Salary disbursement', 'Interest credited', 'Refund to student', 'Fee received — identify later', 'Other'].map((o) => <option key={o}>{o}</option>)}</select>}</Field>
    </Modal>
  )
}

const SAMPLE = `Date,Description,Ref,Debit,Credit
05/11/2026,UPI COLL 25CSE004,UPI1234567890,,65000
06/11/2026,NEFT DR SHARMA STATIONERS,NEFT-SS-4410,62592,
07/11/2026,INTEREST CREDIT,INT-Q3,,18450`

function ImportStatement({ defaultAccount, onClose }: { defaultAccount: string; onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [acc, setAcc] = useState(defaultAccount)
  const [text, setText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const rows = useMemo(() => parseStatementCsv(text), [text])
  const dupes = rows.filter((r) => db.bankTxns.some((t) => t.accountId === acc && t.date === r.date && t.debit === r.debit && t.credit === r.credit && t.ref === r.ref))
  const fresh = rows.filter((r) => !dupes.includes(r))
  const matches = fresh.filter((r) => suggestMatch(db, r)).length
  const go = () => {
    let auto = 0
    update((d) => {
      for (const r of fresh) {
        const t: BankTxn = { id: uid('bt'), accountId: acc, ...r }
        const m = suggestMatch(d, t)
        if (m) { t.match = m; auto++ }
        d.bankTxns.push(t)
      }
    })
    toast(`${fresh.length} lines imported · ${auto} auto-reconciled`)
    onClose()
  }
  return (
    <Modal open wide title="Import bank statement" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button icon={<Upload size={16} />} disabled={!fresh.length} onClick={go}>Import {fresh.length} line{fresh.length === 1 ? '' : 's'}</Button></>}>
      <div className="form-grid">
        <Field label="Account">{(id) => <select id={id} className="input" value={acc} onChange={(e) => setAcc(e.target.value)}>{db.bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.bank} · {a.accountNo.slice(-4)}</option>)}</select>}</Field>
        <div className="field"><label>File</label><div className="row gap-s"><Button variant="secondary" icon={<Upload size={14} />} onClick={() => fileRef.current?.click()}>Choose CSV</Button><Button variant="ghost" onClick={() => setText(SAMPLE)}>Use sample</Button></div></div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = '' }} />
        <Field label="Or paste CSV" span={2} hint="Columns: Date, Description, Ref, Debit, Credit · dates DD/MM/YYYY or YYYY-MM-DD">{(id) => <textarea id={id} className="input mono-ish" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />}</Field>
      </div>
      {rows.length > 0 && (
        <>
          <p className="tiny"><strong>{rows.length}</strong> lines read · <strong>{fresh.length}</strong> new · {dupes.length} already imported · <strong>{matches}</strong> will auto-reconcile</p>
          <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
            <table className="table"><tbody>{rows.slice(0, 50).map((r, i) => <tr key={i} style={dupes.includes(r) ? { opacity: 0.45 } : undefined}><td className="nowrap">{r.date}</td><td>{r.description}</td><td className="right text-red">{r.debit ? money2(r.debit) : ''}</td><td className="right text-green">{r.credit ? money2(r.credit) : ''}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </Modal>
  )
}
