import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, Users, Wallet, CalendarCheck, Megaphone, Trash2, Plus, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, Stat } from '../../components/ui'
import { BarChart } from '../../components/charts'
import { formatDate, formatMoney, studentFeeStatus, summarize, uid } from '../../lib/utils'
import type { Announcement } from '../../types'

export default function AdminDashboard() {
  const { db, update, toast } = useStore()
  const cur = db.branding.currency
  const [annOpen, setAnnOpen] = useState(false)

  const stats = useMemo(() => {
    let collected = 0
    let pending = 0
    let defaulters = 0
    const byDept: Record<string, number> = {}
    for (const s of db.students.filter((x) => x.status === 'active')) {
      const st = studentFeeStatus(db, s)
      let owes = false
      for (const f of st) {
        if (f.status === 'paid') {
          collected += f.payment!.amount + f.payment!.lateFee
          byDept[s.department] = (byDept[s.department] ?? 0) + f.payment!.amount + f.payment!.lateFee
        } else {
          pending += f.total
          if (f.status === 'overdue') owes = true
        }
      }
      if (owes) defaulters++
    }
    const dates = [...new Set(db.attendance.map((a) => a.date))].sort().slice(-10)
    const trend = dates.map((d) => {
      let p = 0
      let t = 0
      for (const a of db.attendance.filter((x) => x.date === d))
        for (const m of Object.values(a.marks)) {
          t++
          if (m !== 'A') p++
        }
      return { label: formatDate(d, { day: 'numeric', month: 'short' }), short: String(+d.slice(8)), value: t ? Math.round((p / t) * 100) : 0 }
    })
    const low = db.students.filter((s) => {
      const sum = summarize(db.attendance, s.id)
      return sum.total > 0 && sum.pct < 75
    }).length
    return { collected, pending, defaulters, byDept, trend, low }
  }, [db])

  const recent = [...db.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt)).slice(0, 6)
  const avgAttendance = stats.trend.length ? Math.round(stats.trend.reduce((a, b) => a + b.value, 0) / stats.trend.length) : 0

  return (
    <>
      <PageHeader title={`Welcome back 👋`} subtitle={`Here's what's happening at ${db.branding.collegeName} today.`} actions={<Button icon={<Megaphone size={16} />} onClick={() => setAnnOpen(true)}>New announcement</Button>} />

      <div className="grid stats-grid">
        <Stat label="Active students" value={db.students.filter((s) => s.status === 'active').length} icon={<GraduationCap size={20} />} hint={`${db.departments.length} departments`} />
        <Stat label="Faculty & staff" value={db.staff.filter((s) => s.status === 'active').length} icon={<Users size={20} />} tone="blue" hint={`${db.subjects.length} subjects`} />
        <Stat label="Fees collected" value={formatMoney(stats.collected, cur)} icon={<Wallet size={20} />} tone="green" hint={`${formatMoney(stats.pending, cur)} outstanding`} />
        <Stat label="Avg. attendance" value={`${avgAttendance}%`} icon={<CalendarCheck size={20} />} tone="amber" hint="last 10 working days" />
      </div>

      {(stats.defaulters > 0 || stats.low > 0) && (
        <div className="grid two">
          {stats.defaulters > 0 && (
            <Link to="/admin/fees" className="alert alert-warn link-alert">
              <AlertTriangle size={18} /> <span><strong>{stats.defaulters} students</strong> have overdue fees. Send reminders from Fees.</span>
            </Link>
          )}
          {stats.low > 0 && (
            <Link to="/admin/attendance" className="alert alert-error link-alert">
              <AlertTriangle size={18} /> <span><strong>{stats.low} students</strong> are below 75% attendance.</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid two">
        <Card title="Attendance trend" actions={<Link className="link" to="/admin/attendance">View details</Link>}>
          <BarChart data={stats.trend} format={(v) => `${v}%`} max={100} />
        </Card>
        <Card title="Fee collection by department" actions={<Link className="link" to="/admin/fees">Open ledger</Link>}>
          <BarChart data={db.departments.map((d) => ({ label: d.code, value: stats.byDept[d.code] ?? 0 }))} format={(v) => formatMoney(v, cur).replace(/\.00$/, '')} />
        </Card>
      </div>

      <div className="grid two">
        <Card title="Recent payments" pad={false}>
          {recent.length === 0 ? (
            <Empty title="No payments yet" />
          ) : (
            <table className="table">
              <tbody>
                {recent.map((p) => {
                  const s = db.students.find((x) => x.id === p.studentId)
                  const f = db.fees.find((x) => x.id === p.feeId)
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{s?.name ?? 'Unknown'}</strong>
                        <div className="muted tiny">{f?.name}</div>
                      </td>
                      <td className="muted tiny">{formatDate(p.paidAt)}</td>
                      <td className="right">
                        <strong>{formatMoney(p.amount + p.lateFee, cur)}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Announcements">
          {db.announcements.length === 0 ? (
            <Empty icon={<Megaphone />} title="Nothing announced yet" />
          ) : (
            <ul className="feed">
              {db.announcements.map((a) => (
                <li key={a.id}>
                  <div className="feed-head">
                    <strong>{a.title}</strong>
                    <Badge tone={a.audience === 'all' ? 'primary' : a.audience === 'staff' ? 'blue' : 'green'}>{a.audience}</Badge>
                    <button
                      className="icon-btn sm"
                      aria-label="Delete announcement"
                      onClick={() => {
                        update((d) => {
                          d.announcements = d.announcements.filter((x) => x.id !== a.id)
                        })
                        toast('Announcement removed')
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="muted">{a.body}</p>
                  <small className="muted">{formatDate(a.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <AnnouncementModal
        open={annOpen}
        onClose={() => setAnnOpen(false)}
        onSave={(a) => {
          update((d) => {
            d.announcements.unshift(a)
          })
          toast('Announcement published')
          setAnnOpen(false)
        }}
      />
    </>
  )
}

function AnnouncementModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: Announcement) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<Announcement['audience']>('all')
  const valid = title.trim().length > 2
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New announcement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            icon={<Plus size={16} />}
            disabled={!valid}
            onClick={() => {
              onSave({ id: uid('ann'), title: title.trim(), body: body.trim(), audience, createdAt: new Date().toISOString() })
              setTitle('')
              setBody('')
            }}
          >
            Publish
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Title" span={2}>{(id) => <input id={id} className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />}</Field>
        <Field label="Audience" span={2}>
          {(id) => (
            <select id={id} className="input" value={audience} onChange={(e) => setAudience(e.target.value as Announcement['audience'])}>
              <option value="all">Everyone</option>
              <option value="staff">Staff only</option>
              <option value="students">Students only</option>
            </select>
          )}
        </Field>
        <Field label="Message" span={2}>{(id) => <textarea id={id} className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
