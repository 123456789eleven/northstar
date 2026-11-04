// Small read-only mood constellation for the Mind hub: this month's days as stars, linking to the Journal.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { JournalEntry } from '../../db'
import { monthKey, today } from '../../lib/dates'
import { MAX_STAR, monthStars } from './constellation'

export function MoodPreview({ entries, goal }: { entries: Pick<JournalEntry, 'date' | 'text' | 'mood'>[]; goal: number }) {
  const t = today()
  const { lead, stars } = useMemo(() => monthStars(monthKey(t), entries, goal), [t, entries, goal])
  const size = MAX_STAR * 2 + 2
  const days = stars.filter((s) => s.words > 0).length
  return (
    <Link to="/journal" className="jr-preview" aria-label={`Mood constellation: ${days} ${days === 1 ? 'day' : 'days'} written this month. Open Journal`} data-testid="mood-preview">
      <span className="jr-preview-grid" aria-hidden>
        {Array.from({ length: lead }, (_, i) => <span key={`p${i}`} />)}
        {stars.map((s) => (
          <span key={s.date} className="jr-star jr-star-mini" data-m={s.step} data-on={s.r > 0 ? '1' : undefined}>
            <svg viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} focusable="false">
              {s.r > 0 ? <circle className="jr-star-dot" r={s.r} /> : <circle className="jr-star-empty" r={1.4} />}
            </svg>
          </span>
        ))}
      </span>
    </Link>
  )
}
