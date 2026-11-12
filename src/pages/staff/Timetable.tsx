import { Printer } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, PageHeader } from '../../components/ui'
import TimetableGrid from '../shared/TimetableGrid'
import { classLabel } from '../../lib/utils'

export default function StaffTimetable() {
  const { db, session } = useStore()
  const ids = new Set(db.subjects.filter((s) => s.staffId === session?.userId).map((s) => s.id))
  const slots = db.timetable.filter((t) => ids.has(t.subjectId))
  return (
    <>
      <PageHeader title="My timetable" subtitle={`${slots.length} periods per week`} actions={<Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>} />
      <Card pad={false}>
        <div className="print-area">
          <h3 className="print-only">{session?.name} — Weekly timetable</h3>
          <TimetableGrid slots={slots} cell={(s) => ({ title: db.subjects.find((x) => x.id === s.subjectId)?.name ?? '', lines: [classLabel(s.classKey), s.room] })} />
        </div>
      </Card>
    </>
  )
}
