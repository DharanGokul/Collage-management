import { useStore } from '../../store/AppStore'
import { DAYS, weekdayIndex } from '../../lib/utils'
import type { TimetableSlot } from '../../types'

export interface CellInfo {
  title: string
  lines: string[]
  warn?: string
}

/**
 * Week grid (periods × days). `cell` decides what to show for a slot,
 * `onCellClick` makes the grid editable.
 */
export default function TimetableGrid({
  slots,
  cell,
  onCellClick,
  days = 5,
}: {
  slots: TimetableSlot[]
  cell: (slot: TimetableSlot) => CellInfo
  onCellClick?: (day: number, period: number, slot: TimetableSlot | undefined) => void
  days?: number
}) {
  const { db } = useStore()
  const today = weekdayIndex(new Date())
  const periods = [...db.periods].sort((a, b) => a.no - b.no)
  return (
    <div className="tt-wrap">
      <table className="tt">
        <thead>
          <tr>
            <th className="tt-corner">Period</th>
            {DAYS.slice(0, days).map((d, i) => (
              <th key={d} className={i === today ? 'today' : ''}>
                <span className="tt-day-long">{d}</span>
                <span className="tt-day-short">{d.slice(0, 3)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.no}>
              <th className="tt-period">
                <strong>P{p.no}</strong>
                <small>{p.start}–{p.end}</small>
              </th>
              {Array.from({ length: days }, (_, day) => {
                const matching = slots.filter((s) => s.day === day && s.period === p.no)
                const slot = matching[0]
                const info = slot ? cell(slot) : null
                const content = (
                  <>
                    {info ? (
                      <>
                        <strong>{info.title}</strong>
                        {info.lines.map((l, i) => <small key={i}>{l}</small>)}
                        {matching.length > 1 && <small className="text-red">+{matching.length - 1} more (clash)</small>}
                        {info.warn && <small className="text-red">⚠ {info.warn}</small>}
                      </>
                    ) : (
                      <span className="tt-free">{onCellClick ? '+ Add' : 'Free'}</span>
                    )}
                  </>
                )
                return (
                  <td key={day} className={`${day === today ? 'today' : ''} ${slot ? 'filled' : ''} ${info?.warn || matching.length > 1 ? 'warn' : ''}`}>
                    {onCellClick ? (
                      <button className="tt-cell" onClick={() => onCellClick(day, p.no, slot)} aria-label={`${DAYS[day]} period ${p.no}`}>{content}</button>
                    ) : (
                      <div className="tt-cell">{content}</div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
