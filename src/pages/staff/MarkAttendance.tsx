import { useMemo } from 'react'
import { useStore } from '../../store/AppStore'
import { PageHeader } from '../../components/ui'
import AttendanceMarker from '../shared/AttendanceMarker'

export default function MarkAttendance() {
  const { db, session } = useStore()
  const subjects = useMemo(() => db.subjects.filter((s) => s.staffId === session?.userId), [db.subjects, session?.userId])
  return (
    <>
      <PageHeader title="Mark attendance" subtitle="Select a scheduled class, mark each student and save" />
      <AttendanceMarker subjects={subjects} markedBy={session?.userId ?? ''} />
    </>
  )
}
