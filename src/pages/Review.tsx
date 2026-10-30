import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Card, PageHeader } from '../components/ui'
import { addDays, formatDate, parseISODate, startOfWeek, today } from '../lib/dates'
import { avgRating, reviewStreak } from '../features/review/summary'
import { Digest, ReviewForm } from '../features/review/ReviewParts'
import { RatingsTrend } from '../features/review/RatingsTrend'
import '../features/review/review.css'

function Chevron({ dir }: { dir: 'l' | 'r' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'l' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  )
}

function weekRange(w: string) {
  const end = addDays(w, 6)
  const sameMonth = w.slice(0, 7) === end.slice(0, 7)
  return `${formatDate(w)} – ${sameMonth ? parseISODate(end).getDate() : formatDate(end)}`
}

export default function Review() {
  const thisWeek = startOfWeek(today())
  const lastWeek = addDays(thisWeek, -7)
  const [weekOf, setWeekOf] = useState(thisWeek)

  const reviews = useLiveQuery(() => db.reviews.orderBy('weekOf').reverse().toArray(), [])
  const loaded = useLiveQuery(async () => ({ weekOf, row: (await db.reviews.where('weekOf').equals(weekOf).first()) ?? null }), [weekOf])
  // useLiveQuery keeps the previous result while new deps load; ignore it so the form never mounts with another week's data.
  const current = loaded && loaded.weekOf === weekOf ? loaded.row : undefined

  const dow = parseISODate(today()).getDay() // 0 Sun … 6 Sat
  const have = new Set((reviews ?? []).map((r) => r.weekOf))
  const suggestLast = reviews !== undefined && (dow === 1 || dow === 2) && weekOf === thisWeek && !have.has(lastWeek)
  const streak = reviews ? reviewStreak(reviews) : 0

  const sub = reviews === undefined ? '' : reviews.length === 0
    ? 'Ten minutes each week: what went well, what didn’t, what’s next.'
    : streak > 0 ? `${streak}-week streak · ${reviews.length} reviews in total` : `${reviews.length} reviews · no current streak`

  return (
    <>
      <PageHeader title="Weekly review" sub={sub} />

      {suggestLast && (
        <div className="rv-suggest">
          <span>It’s early in the week. Review last week ({weekRange(lastWeek)}) instead?</span>
          <button className="btn btn-sm btn-primary" onClick={() => setWeekOf(lastWeek)}>Review last week</button>
        </div>
      )}

      <div className="rv-weeknav">
        <button className="btn" aria-label="Previous week" onClick={() => setWeekOf(addDays(weekOf, -7))}><Chevron dir="l" /></button>
        <button className="btn" aria-label="Next week" disabled={weekOf >= thisWeek} onClick={() => setWeekOf(addDays(weekOf, 7))}><Chevron dir="r" /></button>
        <span className="rv-week-label">
          {weekOf === thisWeek ? 'This week' : weekOf === lastWeek ? 'Last week' : 'Week of'} · {weekRange(weekOf)}
        </span>
        <span className={current ? 'rv-week-state is-done' : 'rv-week-state'}>{current ? 'Reviewed' : current === null ? 'Not reviewed yet' : ''}</span>
        {weekOf !== thisWeek && <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '0 10px' }} onClick={() => setWeekOf(thisWeek)}>Back to this week</button>}
      </div>

      <div className="rv-layout">
        <div className="stack" style={{ gap: 16 }}>
          <Digest weekOf={weekOf} />
          {current !== undefined && <ReviewForm key={weekOf} weekOf={weekOf} existing={current} />}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Ratings over time">
            <RatingsTrend reviews={reviews ?? []} />
          </Card>
          <Card title="Past reviews">
            {reviews && reviews.length > 0 ? (
              <div className="rv-past">
                {reviews.slice(0, 30).map((r) => {
                  const avg = avgRating(r)
                  const line = r.wins || r.focusNext || r.struggles || 'No notes'
                  return (
                    <button key={r.id} className={r.weekOf === weekOf ? 'rv-past-item is-current' : 'rv-past-item'} onClick={() => setWeekOf(r.weekOf)}>
                      <span className="rv-past-week">{formatDate(r.weekOf)}</span>
                      <span className="rv-past-text">{line.split('\n')[0]}</span>
                      {avg != null && <span className="rv-past-avg" title="Average rating">{avg.toFixed(1)}</span>}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="small faint" style={{ margin: 0 }}>Your first review will appear here. Fill in the form and save.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
