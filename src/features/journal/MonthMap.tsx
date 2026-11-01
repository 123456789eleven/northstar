// Month of days, one square each, shaded by words written. Table view via ChartFrame.
import { useMemo, useState } from 'react'
import type { JournalEntry } from '../../db'
import ChartFrame from '../../components/ChartFrame'
import { formatDate, monthKey, today } from '../../lib/dates'
import { monthCells, shiftMonth } from './insights'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function MonthMap({ entries, goal, selected, onOpen }: { entries: JournalEntry[]; goal: number; selected: string; onOpen: (date: string) => void }) {
  const [month, setMonth] = useState(() => monthKey(selected))
  const cells = useMemo(() => monthCells(month, entries, goal), [month, entries, goal])
  const t = today()
  const label = formatDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const days = cells.filter((c) => c.date && c.words > 0)
  const total = days.reduce((n, c) => n + c.words, 0)
  const nextDisabled = month >= monthKey(t)
  return (
    <ChartFrame
      title="Writing, by day"
      controls={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <span className="small" aria-live="polite">{label}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={nextDisabled} onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
          <span className="small muted">{days.length} {days.length === 1 ? 'day' : 'days'} · {total} words</span>
        </>
      }
      table={
        <table className="table">
          <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Words</th></tr></thead>
          <tbody>
            {days.length === 0 ? <tr><td colSpan={2}>Nothing written this month.</td></tr> : days.map((c) => (
              <tr key={c.date}><td>{formatDate(c.date!, { month: 'short', day: 'numeric' })}</td><td className="mono" style={{ textAlign: 'right' }}>{c.words}</td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="jr-map" role="group" aria-label={`${label}, words written per day`}>
        {DOW.map((d, i) => <span key={i} className="jr-map-dow" aria-hidden>{d}</span>)}
        {cells.map((c, i) =>
          c.date ? (
            <button
              key={c.date}
              type="button"
              className="jr-sq"
              data-l={c.level}
              data-sel={c.date === selected ? '1' : undefined}
              disabled={c.date > t}
              aria-label={`${formatDate(c.date, { month: 'long', day: 'numeric' })}: ${c.words} words`}
              aria-current={c.date === t ? 'date' : undefined}
              onClick={() => onOpen(c.date!)}
            >{c.day}</button>
          ) : <span key={`p${i}`} />,
        )}
      </div>
      <div className="jr-map-key small muted" aria-hidden>
        Less <i className="jr-sq-key" data-l="0" /><i className="jr-sq-key" data-l="1" /><i className="jr-sq-key" data-l="2" /><i className="jr-sq-key" data-l="3" /><i className="jr-sq-key" data-l="4" /> goal ({goal})
      </div>
    </ChartFrame>
  )
}
