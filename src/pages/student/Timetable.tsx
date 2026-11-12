import { Printer } from 'lucide-react'
import { useStore } from '../../store/AppStore'
import { Button, Card, Empty, PageHeader } from '../../components/ui'
import TimetableGrid from '../shared/TimetableGrid'
import { classLabel, studentClassKey } from '../../lib/utils'

export default function StudentTimetable() {
  const { db, session } = useStore()
  const me = db.students.find((s) => s.id === session?.userId)
  if (!me) return <Empty title="Student record not found" />
  const key = studentClassKey(me)
  return (
    <>
      <PageHeader title="Class timetable" subtitle={classLabel(key)} actions={<Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Print</Button>} />
      <Card pad={false}>
        <div className="print-area">
          <h3 className="print-only">{db.branding.collegeName} — {classLabel(key)}</h3>
          <TimetableGrid
            slots={db.timetable.filter((t) => t.classKey === key)}
            cell={(s) => {
              const sub = db.subjects.find((x) => x.id === s.subjectId)
              return { title: sub?.name ?? '', lines: [db.staff.find((x) => x.id === sub?.staffId)?.name ?? 'TBA', s.room] }
            }}
          />
        </div>
      </Card>
    </>
  )
}
