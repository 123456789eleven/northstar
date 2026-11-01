import { useState, type FormEvent } from 'react'
import { Card, Field } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import type { Habit, HabitLog, ISODate } from '../../db'
import { daysBetween, formatDate, today } from '../../lib/dates'
import { toggleCheckIn } from '../habits/habitData'
import { weekCount } from '../habits/stats'
import { applyFoodTargets, createLiftHabit, findLiftHabit, saveBodySetting, type BodySettings } from './bodyData'
import { adaptiveMaintenance, adviceFor, dailyTargets, FAST_RATE, isFlat, weeksToGo, type WeightPoint } from './model'

const numOrUndef = (s: string) => {
  const n = Number(s.trim())
  return s.trim() && Number.isFinite(n) && n > 0 ? n : undefined
}

export function GoalPanel({ s, firstWeight }: { s: BodySettings; firstWeight?: number }) {
  const toast = useToast()
  const [goal, setGoal] = useState(String(s.goal))
  const [goalDate, setGoalDate] = useState(s.goalDate ?? '')
  const [start, setStart] = useState(s.startWeight != null ? String(s.startWeight) : '')
  const [height, setHeight] = useState(s.height != null ? String(s.height) : '')
  const [days, setDays] = useState(String(s.trainDays))
  async function save(e: FormEvent) {
    e.preventDefault()
    await saveBodySetting('goal', numOrUndef(goal))
    await saveBodySetting('goalDate', goalDate || undefined)
    await saveBodySetting('startWeight', numOrUndef(start))
    await saveBodySetting('height', numOrUndef(height))
    const d = numOrUndef(days)
    await saveBodySetting('trainDays', d ? Math.min(7, Math.round(d)) : undefined)
    toast({ message: 'Goal saved' })
  }
  return (
    <Card title="Set goal">
      <form className="stack" onSubmit={save}>
        <div className="body-goalgrid">
          <Field label="Goal weight (lb)"><input className="input" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} /></Field>
          <Field label="Goal date (optional)"><input className="input" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} /></Field>
          <Field label="Starting weight (lb)"><input className="input" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder={firstWeight != null ? `${firstWeight} (first log)` : 'from your first log'} /></Field>
          <Field label="Height (in, optional)"><input className="input" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          <Field label="Training days / week"><input className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-primary" type="submit">Save</button></div>
      </form>
    </Card>
  )
}

export function GuidanceCard({ s, weights, rate, weight, intake, remaining, goalDateRate }: {
  s: BodySettings; weights: WeightPoint[]; rate: number | null; weight: number | null; intake: number[]; remaining: number; goalDateRate: number | null
}) {
  const toast = useToast()
  const [maint, setMaint] = useState(s.maintenance != null ? String(s.maintenance) : '')
  const [prot, setProt] = useState(s.protein != null ? String(s.protein) : '')
  if (weight == null) {
    return <Card title="Guidance"><p className="muted small" style={{ margin: 0 }}>Log a weigh-in and this card will suggest daily calorie and protein targets based on your weight.</p></Card>
  }
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const span = sorted.length ? daysBetween(sorted[0].date, sorted[sorted.length - 1].date) : 0
  const flat = rate != null && span >= 14 && isFlat(weights, today())
  const advice = adviceFor(rate, span, flat)
  const t = dailyTargets(weight, { surplus: s.surplus, maintenance: s.maintenance, protein: s.protein })
  const adaptive = adaptiveMaintenance(intake, rate)
  const lo = weeksToGo(remaining, 1.0)
  const hi = weeksToGo(remaining, 0.5)
  return (
    <Card title="Guidance">
      <div className="stack" style={{ gap: 12 }}>
        <div className={`body-adv ${advice.tone === 'warn' ? 'body-adv-warn' : advice.tone === 'good' ? 'body-adv-good' : ''}`}>{advice.text}</div>
        <p className="muted small" style={{ margin: 0 }}>
          A lean-gain pace is roughly 0.5-1.0 lb/week; above about {FAST_RATE} lb/week more of the gain is likely fat.
          {remaining > 0 && lo && hi ? ` For the ${remaining.toFixed(1)} lb still to go, that is about ${lo}-${hi} weeks (${Math.round(lo / 4.345)}-${Math.round(hi / 4.345)} months), and not every pound gained will be muscle.` : ''}
          {goalDateRate != null && s.goalDate ? ` To hit ${formatDate(s.goalDate, { month: 'short', day: 'numeric', year: 'numeric' })} you would need about ${goalDateRate.toFixed(2)} lb/week${goalDateRate > FAST_RATE ? ', which is faster than is sensible' : ''}.` : ''}
          {' '}General information, not medical advice.
        </p>
        <div className="body-targets">
          <Field label={`Maintenance kcal (estimate: ${Math.round(weight)} lb x 15)`}>
            <input className="input" inputMode="numeric" value={maint} placeholder={String(Math.round(weight * 15))} onChange={(e) => setMaint(e.target.value)} onBlur={() => void saveBodySetting('maintenance', numOrUndef(maint))} />
          </Field>
          <Field label={`Surplus: +${s.surplus} kcal`}>
            <input className="body-slider" type="range" min={250} max={500} step={50} value={s.surplus} onChange={(e) => void saveBodySetting('surplus', Number(e.target.value))} aria-label="Daily surplus in kcal" />
          </Field>
          <Field label="Protein g (0.8 per lb)">
            <input className="input" inputMode="numeric" value={prot} placeholder={String(Math.round(weight * 0.8))} onChange={(e) => setProt(e.target.value)} onBlur={() => void saveBodySetting('protein', numOrUndef(prot))} />
          </Field>
        </div>
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="small">Daily target: <strong className="mono">{t.calories.toLocaleString()} kcal</strong> and <strong className="mono">{t.protein} g</strong> protein</span>
          <button className="btn btn-primary btn-sm" onClick={async () => { await applyFoodTargets({ calories: t.calories, protein: t.protein }); toast({ message: 'Food targets updated' }) }}>Use these targets</button>
        </div>
        {adaptive != null && (
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <span className="small">Your estimated maintenance from your data: <strong className="mono">{adaptive.toLocaleString()} kcal</strong> <span className="faint">(average logged intake minus your weight change)</span></span>
            <button className="btn btn-sm" onClick={async () => { await saveBodySetting('maintenance', adaptive); setMaint(String(adaptive)); toast({ message: 'Maintenance set from your data' }) }}>Adopt</button>
          </div>
        )}
      </div>
    </Card>
  )
}

export function TrainingCard({ habits, logs, target }: { habits: Habit[]; logs: HabitLog[]; target: number }) {
  const toast = useToast()
  const habit = findLiftHabit(habits)
  if (!habit) {
    return (
      <Card title="Training">
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
          <span className="muted small">Muscle gain needs consistent lifting. Track sessions as a habit.</span>
          <button className="btn btn-sm" onClick={async () => { await createLiftHabit(target); toast({ message: `Lift habit created (${target}x/week)` }) }}>Create a Lift habit ({target}x/week)</button>
        </div>
      </Card>
    )
  }
  const dates = new Set<ISODate>(logs.filter((l) => l.habitId === habit.id).map((l) => l.date))
  const done = weekCount(dates, today())
  const checked = dates.has(today())
  return (
    <Card title="Training">
      <div className="row wrap" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="small">{habit.name}: <strong className="mono">{done} of {target}</strong> sessions this week{done >= target ? ' - target met' : ''}</span>
        <button className="btn btn-sm" aria-pressed={checked} onClick={() => void toggleCheckIn(habit, today())}>{checked ? 'Today done (undo)' : 'Log today’s session'}</button>
      </div>
    </Card>
  )
}
