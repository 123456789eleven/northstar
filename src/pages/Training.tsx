// Gym, Training floor: this week's sessions as a ring with the seven days beside it. Tap a day (or Log workout) and the ring
// advances; tap again to take it back. Then the weekly target, the last eight weeks and recent sessions. The lift habit is
// created on the first tap (it shows on Plan > Habits too).
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageSkeleton } from '../components/ui'
import { useNumberRoll } from '../components/motion'
import { useToast } from '../components/toastContext'
import { PHONE_QUERY, useMedia } from '../components/useMedia'
import { db, type Habit, type ISODate } from '../db'
import { addDays, daysBetween, formatDate, startOfWeek, today } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { GoalPanel } from '../features/body/BodyPanels'
import { createLiftHabit, findLiftHabit, readBodySettings, saveBodySetting } from '../features/body/bodyData'
import { Ring } from '../features/game/ui/Ring'
import { celebrate } from '../features/game/ui/feedback'
import { checkIn, undoCheckIn } from '../features/habits/habitData'
import { weekCount } from '../features/habits/stats'
import '../features/body/body.css'
import '../features/body/gym.css'

const WEEKS = 8

export default function Training() {
  const toast = useToast()
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const settingRows = useLiveQuery(() => db.settings.where('key').startsWith('body.').toArray(), [])
  const habit = habits ? findLiftHabit(habits) : undefined
  const logs = useLiveQuery(
    async () => (habit?.id == null ? [] : (await db.habitLogs.where('habitId').equals(habit.id).toArray()).sort((a, b) => b.date.localeCompare(a.date))),
    [habit?.id],
  )
  const t = today()
  const dates = new Set((logs ?? []).map((l) => l.date))
  const done = weekCount(dates, t)
  const shown = useNumberRoll(done, 500)
  const [busy, setBusy] = useState(false)
  const phone = useMedia(PHONE_QUERY)
  if (!habits || !settingRows || !logs) return <PageSkeleton rows={3} />

  const s = readBodySettings(settingRows)
  const goal = habit?.perWeek ?? s.trainDays
  const wk = startOfWeek(t)
  const week = Array.from({ length: 7 }, (_, i) => addDays(wk, i))

  async function toggle(day: ISODate) {
    if (busy) return
    setBusy(true)
    try {
      let h: Habit | undefined = habit
      if (!h) h = await db.habits.get(await createLiftHabit(goal))
      if (!h) return
      const r = await checkIn(h, day)
      const hh = h
      const label = day === t ? 'today' : formatDate(day, { weekday: 'long' })
      if (!r.checked) { toast({ message: `Session removed for ${label}` }); return }
      celebrate('tick')
      const n = weekCount(new Set([...dates, day]), t)
      toast({
        message: n >= goal ? `Session ${n} of ${goal}. Week on target.` : `Session ${n} of ${goal}. ${goal - n} to go.`,
        undo: () => undoCheckIn(hh, day, r.milestone),
      })
    } finally {
      setBusy(false)
    }
  }

  async function setTarget(n: number) {
    const v = Math.min(7, Math.max(1, n))
    await saveBodySetting('trainDays', v)
    if (habit?.id != null) await db.habits.update(habit.id, { perWeek: v })
  }

  const left = Math.max(0, goal - done)
  const checked = dates.has(t)
  const hero = (
    <section className="card floor-hero tr-hero" aria-label="Training">
      <Ring value={goal ? done / goal : 0} size={phone ? 96 : 132} stroke={10} tone={done >= goal ? 'reward' : 'body'} label={`${done} of ${goal} sessions this week`}>
        <span className="train-num"><span className="train-big mono" data-testid="train-count">{shown}</span><span className="train-of">of {goal}</span></span>
      </Ring>
      <div className="tr-side">
        <p className="tr-line">{done >= goal ? 'Week on target.' : done === 0 ? 'First session sets the week going.' : `${left} more to hit ${goal}.`}</p>
        <ol className="tr-week" aria-label="This week">
          {week.map((d) => {
            const on = dates.has(d)
            const future = d > t
            return (
              <li key={d}>
                <button
                  className={`tr-day${on ? ' is-on' : ''}${d === t ? ' is-today' : ''}`}
                  aria-pressed={on}
                  disabled={future || busy}
                  aria-label={`${formatDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}${on ? ', session logged' : ''}`}
                  onClick={() => void toggle(d)}
                >
                  <span aria-hidden="true">{formatDate(d, { weekday: 'narrow' })}</span>
                  <span className="mono" aria-hidden="true">{formatDate(d, { day: 'numeric' })}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="tr-actions">
          {checked ? (
            <button className="btn" onClick={() => void toggle(t)}>Logged today. Tap to remove</button>
          ) : (
            <button className="btn btn-primary train-log" onClick={() => void toggle(t)}>Log workout</button>
          )}
        </div>
      </div>
    </section>
  )

  // Last eight weeks, oldest first: sessions per week against the target.
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(wk, -7 * (WEEKS - 1 - i))
    return { start, n: weekCount(dates, start) }
  })
  let run = 0
  for (let i = WEEKS - 2; i >= 0 && weeks[i].n >= goal; i--) run++
  if (done >= goal) run++
  const peak = Math.max(goal, ...weeks.map((w) => w.n))

  const target = (
    <FloorCard key="target" title="Weekly target">
      <div className="tr-target">
        <button className="btn" aria-label="Fewer sessions a week" disabled={goal <= 1} onClick={() => void setTarget(goal - 1)}>-</button>
        <span className="mono" aria-live="polite" aria-label={`${goal} sessions a week`}>{goal}</span>
        <button className="btn" aria-label="More sessions a week" disabled={goal >= 7} onClick={() => void setTarget(goal + 1)}>+</button>
        <span className="faint small">a week</span>
      </div>
    </FloorCard>
  )

  const history = (
    <FloorCard key="weeks" title="Last 8 weeks">
      <ol className="tr-weeks" aria-label={`Sessions per week, last ${WEEKS} weeks`}>
        {weeks.map((w) => (
          <li key={w.start} className={w.n >= goal ? 'is-hit' : ''} style={{ height: `${Math.max(6, (w.n / peak) * 100)}%` }} title={`Week of ${formatDate(w.start)}: ${w.n}`}>
            <span className="sr-only">Week of {formatDate(w.start)}: {w.n} sessions</span>
          </li>
        ))}
      </ol>
      <p className="small faint" style={{ margin: '8px 0 0' }}>{run > 0 ? `${run} week${run === 1 ? '' : 's'} on target in a row` : 'Hit the target to start a run'}</p>
    </FloorCard>
  )

  const recent = logs.length > 0 && (
    <FloorCard key="recent" title="Last sessions">
      <ul className="train-list">
        {logs.slice(0, 5).map((l) => (
          <li key={l.id}><span>{formatDate(l.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="faint small">{l.date === t ? 'today' : daysBetween(l.date, t) === 1 ? 'yesterday' : `${daysBetween(l.date, t)} days ago`}</span></li>
        ))}
      </ul>
    </FloorCard>
  )

  const more = (
    <FloorMore
      floor="Training"
      items={[
        ...(habit?.id != null ? [{ id: 'habit', label: 'Habit details', value: habit.name, to: `/habits?focus=${habit.id}` }] : []),
        { id: 'goal', label: 'Body goal', panel: <GoalPanel s={s} /> },
      ]}
    />
  )

  return <FloorView label="Training" className="gym-floor" hero={hero} support={[history, target, recent]} more={more} />
}
