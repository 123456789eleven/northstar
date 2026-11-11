// Plan hub (/plan): one overview. The hero says what is open, what is next and how the season goals stand; below it sit
// today's focus, the habit week and links to the four tools.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { PageHeader, Skeleton } from '../components/ui'
import { useNow } from '../components/useNow'
import { useNumberRoll } from '../components/motion'
import { addDays, startOfWeek, today } from '../lib/dates'
import { MAX_FOCUS } from '../features/tasks/taskActions'
import { buildTodayView } from '../features/today/todayQueue'
import { fmtTime, sortedUpcoming, toMin } from '../features/planner/layout'
import { bossNumber, daysLeftInQuarter, pickBosses } from '../features/goals/boss'
import { goalCoach } from '../features/goals/goalCoach'
import { goalMetric } from '../features/progress/metrics'
import { loadMetricData } from '../features/progress/metricsData'
import { Ring } from '../features/game/ui/Ring'
import { isDueToday, weekRing } from '../features/habits/week'
import '../features/goals/quest.css'
import '../features/goals/season.css'
import '../features/hubs/planhub.css'
import '../features/hubs/planhub2.css'
import '../features/space/space.css'

export default function PlanHub() {
  const d = today()
  const now = useNow()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const metricData = useLiveQuery(() => loadMetricData(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const weekStart = startOfWeek(d)
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(weekStart, addDays(weekStart, 6), true, true).toArray(), [weekStart])
  const events = useLiveQuery(() => db.calendar.where('date').between(d, addDays(d, 7), true, true).toArray(), [d])

  const v = useMemo(() => buildTodayView(tasks ?? [], d), [tasks, d])
  const focus = [...v.focus, ...v.suggestions].filter((t) => t.status === 'open').slice(0, MAX_FOCUS)
  const seasons = useMemo(() => pickBosses(goals ?? [], 3), [goals])
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
  const openRoll = useNumberRoll(v.openCount)
  const nextWhen = next
    ? `${next.date === d ? 'Today' : next.date === addDays(d, 1) ? 'Tomorrow' : next.date}${next.allDay || !next.start ? ', all day' : `, ${fmtTime(toMin(next.start))}`}`
    : ''
  const tools = [
    { to: '/tasks', label: 'Tasks', note: `${v.openCount} open${v.overdueCount ? `, ${v.overdueCount} overdue` : ''}`, warn: v.overdueCount > 0 },
    { to: '/planner', label: 'Planner', note: next ? `${next.title}, ${nextWhen}` : 'Nothing in 7 days', warn: false },
    { to: '/goals', label: 'Goals', note: `${(goals ?? []).filter((g) => g.status === 'active').length} active`, warn: false },
    { to: '/habits', label: 'Habits', note: ring.target ? `${ring.done} of ${ring.target} this week` : 'None yet', warn: false },
  ]

  return (
    <>
      <PageHeader title="Plan" sub="What is open, what is next, and how the season is shaping up." />
      {!loaded ? (
        <div className="plan-over">
          <div className="card plan-hero"><Skeleton lines={4} label="Loading plan" /></div>
          <div className="card"><Skeleton lines={4} label="Loading plan" /></div>
        </div>
      ) : (
        <div className="plan-over sp-plan">
          <section className="card plan-hero sp-hero" aria-label="Plan overview">
            <div className="plan-hero-main">
              <span className="stat-label">Open tasks</span>
              <div className="plan-hero-num" data-testid="plan-open">
                <span className="plan-hero-big mono">{openRoll}</span>
                <span className="plan-hero-unit">open</span>
              </div>
              <div className="plan-hero-line">
                {v.overdueCount > 0 ? <span className="plan-overdue">{v.overdueCount} overdue</span> : <span>None overdue</span>}
                <span>{v.dueTodayCount} due today</span>
              </div>
              <div className="plan-hero-next">
                <span className="stat-label">Next</span>
                {next ? <span><strong>{next.title}</strong>, {nextWhen}</span> : <span className="faint">Nothing scheduled in the next 7 days.</span>}
              </div>
            </div>
            <div className="plan-hero-seasons">
              <div className="plan-head"><h2 id="pb-h" className="quest-h">Season goals</h2><Link to="/goals" className="plan-more">Goals</Link></div>
              {seasons.length ? (
                <ul className="plan-season-list" aria-labelledby="pb-h">
                  {seasons.map((g) => {
                    const m = g.metric && metricData ? goalMetric(g, metricData) : null
                    const { hp, note } = goalCoach(g, tasks ?? [], m, metricData, d)
                    const pct = Math.round(hp.progress * 100)
                    return (
                      <li key={g.id}>
                        <Link to="/goals" className="plan-season">
                          <Ring value={hp.progress} size={52} stroke={4} tone={note.tone === 'met' ? 'reward' : undefined} label={`${g.title}: ${pct}% done`}>
                            <span className="mono plan-ring-n">{pct}</span>
                          </Ring>
                          <span className="plan-season-text">
                            <span className="plan-season-title">{g.title}</span>
                            <span className="plan-season-num">{bossNumber(g, tasks ?? [], m)} · {daysLeftInQuarter(d)}d left</span>
                            <span className={`boss-coach tone-${note.tone}`}>{note.text}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="hub-empty">No season goal yet. <Link to="/goals">Pick the one that matters on Goals</Link>.</p>
              )}
            </div>
          </section>

          <section className="card plan-focus sp-flat" aria-labelledby="pf-h">
            <div className="plan-head"><h2 id="pf-h" className="quest-h">Today&apos;s focus</h2><Link to="/tasks" className="plan-more">Tasks</Link></div>
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

          <section className="card plan-habits sp-flat" aria-labelledby="ph-h">
            <div className="plan-head"><h2 id="ph-h" className="quest-h">Habits this week</h2><Link to="/habits" className="plan-more">Habits</Link></div>
            {ring.target > 0 ? (
              <div className="plan-habits-body">
                <Ring value={ring.target ? ring.done / ring.target : 0} size={52} stroke={4} label={`${ring.done} of ${ring.target} check-ins this week`}>
                  <span className="mono plan-ring-n" data-testid="plan-ring">{ring.done}/{ring.target}</span>
                </Ring>
                <div className="plan-habits-text">
                  <strong>{ring.done} of {ring.target} check-ins</strong>
                  <span>{ring.due ? `${ring.due} ${ring.due === 1 ? 'habit' : 'habits'} due today` : 'Nothing due today'}</span>
                </div>
              </div>
            ) : (
              <p className="hub-empty">No habits yet. <Link to="/habits">Start with one small one</Link>.</p>
            )}
          </section>

          <nav className="plan-tools" aria-label="Plan tools">
            {tools.map((q) => (
              <Link key={q.to} to={q.to} className="card card-interactive plan-tool sp-flat">
                <span className="plan-tool-name">{q.label}</span>
                <span className={`plan-tool-note ${q.warn ? 'is-warn' : ''}`}>{q.note}</span>
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}
