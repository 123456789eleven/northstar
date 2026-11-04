// Plan hub (/plan): a real overview. This week's focus (3 slots), the top boss with HP, the habits ring, the next time block
// and quick links. Calm mode keeps the same overview without HP / XP wording.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { PageHeader, Skeleton } from '../components/ui'
import { useNow } from '../components/useNow'
import { addDays, startOfWeek, today } from '../lib/dates'
import { MAX_FOCUS } from '../features/tasks/taskActions'
import { buildTodayView } from '../features/today/todayQueue'
import { fmtTime, sortedUpcoming, timeLabel, toMin } from '../features/planner/layout'
import { bossCheckpoints, bossHp, bossNumber, daysLeftInQuarter, nextStep, pickBosses } from '../features/goals/boss'
import { BossBar } from '../features/goals/BossBar'
import { goalMetric } from '../features/progress/metrics'
import { loadMetricData } from '../features/progress/metricsData'
import { Ring } from '../features/game/ui/Ring'
import { usePlayerState } from '../features/game/ui/playerContext'
import { isDueToday, weekRing } from '../features/habits/week'
import '../features/goals/quest.css'
import '../features/hubs/planhub.css'

const QUICK = [
  { to: '/tasks', label: 'Tasks' },
  { to: '/planner', label: 'Planner' },
  { to: '/goals', label: 'Goals' },
  { to: '/habits', label: 'Habits' },
]

export default function PlanHub() {
  const d = today()
  const now = useNow()
  const calm = usePlayerState().calm
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const metricData = useLiveQuery(() => loadMetricData(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const weekStart = startOfWeek(d)
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(weekStart, addDays(weekStart, 6), true, true).toArray(), [weekStart])
  const events = useLiveQuery(() => db.calendar.where('date').between(d, addDays(d, 7), true, true).toArray(), [d])

  const v = useMemo(() => buildTodayView(tasks ?? [], d), [tasks, d])
  const focus = [...v.focus, ...v.suggestions].filter((t) => t.status === 'open').slice(0, MAX_FOCUS)
  const boss = useMemo(() => pickBosses(goals ?? [], 1)[0], [goals])
  const metric = boss?.metric && metricData ? goalMetric(boss, metricData) : null
  const next = events ? sortedUpcoming(events, d, now.getHours() * 60 + now.getMinutes())[0] : undefined

  const ring = useMemo(() => {
    const byHabit = new Map<number, Set<string>>()
    for (const l of logs ?? []) {
      if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Set())
      byHabit.get(l.habitId)!.add(l.date)
    }
    let done = 0
    let target = 0
    let due = 0
    for (const h of habits ?? []) {
      const dates = byHabit.get(h.id!) ?? new Set<string>()
      const w = weekRing(dates, d, h.perWeek)
      done += Math.min(w.done, w.target)
      target += w.target
      if (isDueToday(dates, d, h.perWeek)) due++
    }
    return { done, target, due }
  }, [habits, logs, d])

  const loaded = tasks !== undefined && goals !== undefined && habits !== undefined && logs !== undefined && events !== undefined

  return (
    <>
      <PageHeader title="Plan" sub="What you will do, when, and why." />
      {!loaded ? (
        <div className="plan-over"><div className="card"><Skeleton lines={4} label="Loading plan" /></div><div className="card"><Skeleton lines={4} label="Loading plan" /></div></div>
      ) : (
        <div className="plan-over">
          <section className="card plan-focus" aria-labelledby="pf-h">
            <div className="plan-head"><h2 id="pf-h" className="quest-h">This week&apos;s focus</h2><Link to="/tasks" className="plan-more">Tasks</Link></div>
            <ol className="plan-slots">
              {Array.from({ length: MAX_FOCUS }, (_, i) => {
                const t = focus[i]
                return t ? (
                  <li key={t.id} className="plan-slot is-filled"><span className="plan-slot-n" aria-hidden>{i + 1}</span><span className="plan-slot-t">{t.title}</span></li>
                ) : (
                  <li key={`e${i}`} className="plan-slot"><span className="plan-slot-n" aria-hidden>{i + 1}</span><Link className="plan-slot-t is-empty" to="/tasks">Open slot: pin a task</Link></li>
                )
              })}
            </ol>
          </section>

          <section className="card plan-boss" aria-labelledby="pb-h">
            <div className="plan-head"><h2 id="pb-h" className="quest-h">{calm ? 'Top goal this quarter' : 'Season boss'}</h2><Link to="/goals" className="plan-more">Goals</Link></div>
            {boss ? (
              <div className="plan-boss-body">
                <div className="boss-title">{boss.title}</div>
                <div className="boss-numrow">
                  <span className="boss-num">{bossNumber(boss, tasks ?? [], metric)}</span>
                  <span className="boss-hp">{calm ? `${Math.round(bossHp(boss, tasks ?? [], metric).progress * 100)}% done` : `HP ${Math.round(bossHp(boss, tasks ?? [], metric).hp * 100)}%`} · {daysLeftInQuarter(d)}d left</span>
                </div>
                <BossBar hp={bossHp(boss, tasks ?? [], metric)} flags={bossCheckpoints(boss, metric, metricData)} label={boss.title} calm={calm} />
                <div className="boss-next"><span className="boss-next-k">Next step</span><span className="boss-next-v">{nextStep(boss, tasks ?? []).text}</span></div>
              </div>
            ) : (
              <p className="hub-empty">No quarter goal yet. <Link to="/goals">Create your first boss</Link>.</p>
            )}
          </section>

          <section className="card plan-habits" aria-labelledby="ph-h">
            <div className="plan-head"><h2 id="ph-h" className="quest-h">Habits this week</h2><Link to="/habits" className="plan-more">Habits</Link></div>
            {ring.target > 0 ? (
              <div className="plan-habits-body">
                <Ring value={ring.target ? ring.done / ring.target : 0} size={64} stroke={5} label={`${ring.done} of ${ring.target} check-ins this week`}>
                  <span className="mono plan-ring-n" data-testid="plan-ring">{ring.done}/{ring.target}</span>
                </Ring>
                <div className="plan-habits-text">
                  <strong>{ring.done} of {ring.target} check-ins</strong>
                  <span>{ring.due ? `${ring.due} ${ring.due === 1 ? 'habit' : 'habits'} due today` : 'Nothing due today'}</span>
                </div>
              </div>
            ) : (
              <p className="hub-empty">No habits yet. <Link to="/habits">Add one</Link>.</p>
            )}
          </section>

          <section className="card plan-next" aria-labelledby="pn-h">
            <div className="plan-head"><h2 id="pn-h" className="quest-h">Next time block</h2><Link to="/planner" className="plan-more">Planner</Link></div>
            {next ? (
              <div className="plan-next-body">
                <div className="plan-next-t">{next.title}</div>
                <div className="plan-next-when">{next.date === d ? 'Today' : next.date === addDays(d, 1) ? 'Tomorrow' : next.date} · {next.allDay || !next.start ? 'All day' : `${fmtTime(toMin(next.start))}${next.end ? ` - ${fmtTime(toMin(next.end))}` : ''}`}</div>
                <span className="sr-only">{timeLabel(next)}</span>
              </div>
            ) : (
              <p className="hub-empty">Nothing scheduled in the next 7 days.</p>
            )}
          </section>

          <nav className="plan-quick" aria-label="Quick links">
            {QUICK.map((q) => <Link key={q.to} to={q.to} className="chip plan-quick-link">{q.label}</Link>)}
          </nav>
        </div>
      )}
    </>
  )
}
