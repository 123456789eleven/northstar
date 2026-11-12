import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Empty } from '../components/ui'
import { FloorMore, FloorView } from '../features/buildings/Floor'
import { addDays, formatDate, parseISODate, startOfWeek, today } from '../lib/dates'
import { avgRating, reviewStreak, type LockableReview } from '../features/review/summary'
import { Digest, ReviewForm } from '../features/review/ReviewParts'
import { RatingsTrend } from '../features/review/RatingsTrend'
import { WeekInNumbers } from '../features/review/WeekInNumbers'
import { InsightsWeek } from '../features/insights/InsightsCard'
import { SeasonHeader, SeasonStories } from '../features/review/SeasonParts'
import '../features/review/review.css'
import '../features/hubs/palette.css'

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
  const planned = reviews?.find((r) => r.weekOf === addDays(weekOf, -7))?.focusNext || undefined
  const streak = reviews ? reviewStreak(reviews) : 0

  const hero = (
    <section className="rv-hero" aria-label="Weekly recap">
      <div className="rv-weeknav">
        <button className="btn" aria-label="Previous week" onClick={() => setWeekOf(addDays(weekOf, -7))}><Chevron dir="l" /></button>
        <button className="btn" aria-label="Next week" disabled={weekOf >= thisWeek} onClick={() => setWeekOf(addDays(weekOf, 7))}><Chevron dir="r" /></button>
        <span className="rv-week-label">
          {weekOf === thisWeek ? 'This week' : weekOf === lastWeek ? 'Last week' : 'Week of'} · {weekRange(weekOf)}
        </span>
        <span className={current ? 'rv-week-state is-done' : 'rv-week-state'}>{current ? ((current as LockableReview).lockedAt ? 'Reviewed and locked' : 'Reviewed') : current === null ? 'Not reviewed yet' : ''}</span>
        {weekOf !== thisWeek && <button className="btn btn-ghost btn-sm" style={{ width: 'auto', padding: '0 10px' }} onClick={() => setWeekOf(thisWeek)}>Back to this week</button>}
        {suggestLast && <button className="btn btn-sm btn-primary" onClick={() => setWeekOf(lastWeek)}>Review last week</button>}
      </div>
      {current !== undefined && <SeasonStories weekOf={weekOf} snapshot={(current as LockableReview | null)?.numbers} wins={current?.wins} focusNext={current?.focusNext} planned={planned} />}
    </section>
  )

  const more = (
    <FloorMore
      floor="Season"
      items={[
        {
          id: 'past', label: 'Past recaps', value: reviews?.length || undefined,
          panel: (close) => reviews && reviews.length > 0 ? (
            <div className="rv-past">
              {reviews.slice(0, 30).map((r) => {
                const avg = avgRating(r)
                const line = r.wins || r.focusNext || r.struggles || 'No notes'
                return (
                  <button key={r.id} className={r.weekOf === weekOf ? 'rv-past-item is-current' : 'rv-past-item'} onClick={() => { setWeekOf(r.weekOf); close() }}>
                    <span className="rv-past-week">{formatDate(r.weekOf)}</span>
                    <span className="rv-past-text">{line.split('\n')[0]}</span>
                    {avg != null && <span className="rv-past-avg" title="Average rating">{avg.toFixed(1)}</span>}
                  </button>
                )
              })}
            </div>
          ) : <Empty>Your first recap lands here. Save one and next week you have something to beat.</Empty>,
        },
        { id: 'ratings', label: 'Ratings', value: streak > 0 ? `${streak}-week run` : undefined, panel: <RatingsTrend reviews={reviews ?? []} /> },
        { id: 'numbers', label: 'Week in numbers', panel: current !== undefined ? <WeekInNumbers weekOf={weekOf} snapshot={(current as LockableReview | null)?.numbers} /> : null },
        { id: 'digest', label: 'Week digest', panel: <Digest weekOf={weekOf} /> },
        ...(weekOf === thisWeek ? [{ id: 'insights', label: 'Insights', panel: <InsightsWeek /> }] : []),
        { id: 'print', label: 'Print', onSelect: () => window.print() },
      ]}
    />
  )

  return (
    <div className="pal-powder">
      <FloorView
        label="Season"
        className="rv-floor"
        hero={hero}
        support={[
          <SeasonHeader key="season" />,
          current !== undefined && <ReviewForm key={weekOf} weekOf={weekOf} existing={current} planned={planned} />,
        ]}
        more={more}
      />
    </div>
  )
}
