// Mood constellation: one star per day of the month, sized by words written and tinted by mood (violet scale).
// Tap a day to open it. Table view via ChartFrame.
import { useMemo, useState } from 'react'
import type { JournalEntry } from '../../db'
import ChartFrame from '../../components/ChartFrame'
import { formatDate, monthKey, today } from '../../lib/dates'
import { shiftMonth } from './insights'
import { monthStars, MAX_STAR } from './constellation'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MOOD_WORD = ['no mood', 'mood 1', 'mood 2', 'mood 3', 'mood 4', 'mood 5']

export function MonthMap({ entries, goal, selected, onOpen, compact = false }: { entries: JournalEntry[]; goal: number; selected: string; onOpen: (date: string) => void; compact?: boolean }) {
  const [month, setMonth] = useState(() => monthKey(selected))
  const { lead, stars } = useMemo(() => monthStars(month, entries, goal), [month, entries, goal])
  const t = today()
  const label = formatDate(`${month}-01`, { month: 'long', year: 'numeric' })
  const days = stars.filter((c) => c.words > 0)
  const total = days.reduce((n, c) => n + c.words, 0)
  const nextDisabled = month >= monthKey(t)
  const size = MAX_STAR * 2 + 2
  return (
    <ChartFrame
      title="Mood constellation"
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
          <thead><tr><th>Date</th><th style={{ textAlign: 'right' }}>Words</th><th style={{ textAlign: 'right' }}>Mood</th></tr></thead>
          <tbody>
            {days.length === 0 ? <tr><td colSpan={3}>Nothing written this month.</td></tr> : days.map((c) => (
              <tr key={c.date}><td>{formatDate(c.date, { month: 'short', day: 'numeric' })}</td><td className="mono" style={{ textAlign: 'right' }}>{c.words}</td><td className="mono" style={{ textAlign: 'right' }}>{c.step || '–'}</td></tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className={`jr-map jr-const ${compact ? 'is-compact' : ''}`} role="group" aria-label={`${label}, words written per day, tinted by mood`}>
        {DOW.map((d, i) => <span key={i} className="jr-map-dow" aria-hidden>{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`p${i}`} />)}
        {stars.map((c) => (
          <button
            key={c.date}
            type="button"
            className="jr-star"
            data-m={c.step}
            data-sel={c.date === selected ? '1' : undefined}
            data-on={c.r > 0 ? '1' : undefined}
            disabled={c.date > t}
            aria-label={`${formatDate(c.date, { month: 'long', day: 'numeric' })}: ${c.words} words, ${MOOD_WORD[c.step]}`}
            aria-current={c.date === t ? 'date' : undefined}
            onClick={() => onOpen(c.date)}
          >
            <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden focusable="false">
              {c.r > 0 ? <circle className="jr-star-dot" r={c.r} /> : <circle className="jr-star-empty" r={1.4} />}
            </svg>
            <span className="jr-star-day" aria-hidden>{c.day}</span>
          </button>
        ))}
      </div>
      <div className="jr-map-key small muted" aria-hidden>
        Size = words (goal {goal}) · tint = mood, low
        {[1, 2, 3, 4, 5].map((m) => <i key={m} className="jr-sq-key" data-m={m} />)}
        high
      </div>
    </ChartFrame>
  )
}
