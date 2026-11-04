// Training: this week's lift sessions as a ring against the weekly target, one-tap "Log workout" (with Undo), last sessions.
import { useLiveQuery } from 'dexie-react-hooks'
import { Card } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { useNumberRoll } from '../../components/motion'
import { db, type Habit } from '../../db'
import { daysBetween, formatDate, today } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import { checkIn, undoCheckIn } from '../habits/habitData'
import { weekCount } from '../habits/stats'
import { createLiftHabit, findLiftHabit } from './bodyData'

export default function TrainingPanel({ habits, target }: { habits: Habit[]; target: number }) {
  const toast = useToast()
  const habit = findLiftHabit(habits)
  const logs = useLiveQuery(async () => (habit?.id == null ? [] : (await db.habitLogs.where('habitId').equals(habit.id).toArray()).sort((a, b) => b.date.localeCompare(a.date))), [habit?.id])
  const dates = new Set((logs ?? []).map((l) => l.date))
  const done = weekCount(dates, today())
  const shown = useNumberRoll(done)
  const goal = habit?.perWeek ?? target
  const checked = dates.has(today())

  async function log() {
    let h = habit
    if (!h) {
      const id = await createLiftHabit(target)
      h = await db.habits.get(id)
    }
    if (!h) return
    const r = await checkIn(h, today())
    if (!r.checked) { toast({ message: 'Workout removed for today' }); return }
    const hh = h
    toast({ message: 'Workout logged', undo: () => undoCheckIn(hh, today(), r.milestone) })
  }

  return (
    <Card title="Training">
      <div className="train">
        <Ring value={goal ? done / goal : 0} size={112} stroke={9} tone="body" label={`${done} of ${goal} sessions this week`}>
          <span className="train-num"><span className="train-big mono" data-testid="train-count">{shown}</span><span className="train-of">of {goal}</span></span>
        </Ring>
        <div className="train-side">
          <p className="train-line">{done >= goal ? 'Weekly target met.' : `${goal - done} more session${goal - done === 1 ? '' : 's'} to hit this week's target.`}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            {checked ? (
              <button className="btn" onClick={() => void log()}>Logged today. Tap to remove</button>
            ) : (
              <button className="btn btn-primary train-log" onClick={() => void log()}>Log workout</button>
            )}
          </div>
          {!habit && <p className="faint small" style={{ margin: 0 }}>The first log creates a Lift habit ({target}x/week). Change the target under Set goal.</p>}
        </div>
      </div>
      {(logs?.length ?? 0) > 0 && (
        <div className="train-recent">
          <div className="stat-label">Last sessions</div>
          <ul className="train-list">
            {logs!.slice(0, 6).map((l) => (
              <li key={l.id}><span>{formatDate(l.date, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="faint small">{l.date === today() ? 'today' : `${daysBetween(l.date, today())} days ago`}</span></li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
