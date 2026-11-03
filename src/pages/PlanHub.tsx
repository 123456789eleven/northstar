// Plan hub (/plan): what you will do, when, and why. Previews of Tasks, Planner, Goals and Habits; each card opens its page.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { PageHeader, Progress } from '../components/ui'
import { useNow } from '../components/useNow'
import { addDays, today } from '../lib/dates'
import { buildTodayView } from '../features/today/todayQueue'
import { fmtTime, sortedUpcoming, toMin } from '../features/planner/layout'
import { goalProgress } from '../features/goals/progress'
import { HubCard, HubList } from '../features/hubs/HubCard'
import '../features/hubs/hubs.css'

export default function PlanHub() {
  const d = today()
  const now = useNow()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').equals(d).toArray(), [d])
  const events = useLiveQuery(() => db.calendar.where('date').between(d, addDays(d, 1), true, true).toArray(), [d])
  const v = useMemo(() => buildTodayView(tasks ?? [], d), [tasks, d])
  const upcoming = events ? sortedUpcoming(events, d, now.getHours() * 60 + now.getMinutes()).slice(0, 3) : []
  const doneIds = new Set((logs ?? []).map((l) => l.habitId))
  const hs = habits ?? []
  const top = [...v.focus, ...v.suggestions, ...v.due].filter((t) => t.status === 'open').slice(0, 3)
  const gs = [...(goals ?? [])].sort((a, b) => Number(b.horizon === 'quarter') - Number(a.horizon === 'quarter')).slice(0, 3)
  const loaded = tasks !== undefined

  return (
    <>
      <PageHeader title="Plan" sub="What you will do, when, and why: tasks, calendar, goals and routines." />
      <div className="hub-grid">
        <HubCard to="/tasks" icon="tasks" title="Tasks" sub={loaded ? `${v.dueTodayCount} due today · ${v.overdueCount ? `${v.overdueCount} overdue` : 'none overdue'}` : ' '} stat={loaded ? v.openCount : undefined}>
          <HubList items={top.map((t) => ({ key: t.id!, label: t.title, meta: t.priority === 1 ? 'High' : t.due === d ? 'Today' : undefined }))} empty="Nothing open. Capture one with / or the + button." />
        </HubCard>
        <HubCard to="/planner" icon="calendar" title="Planner" sub="Today and tomorrow" stat={events ? events.length : undefined}>
          <HubList
            items={upcoming.map((e) => ({ key: e.id!, label: e.title, meta: `${e.date === d ? 'Today' : 'Tomorrow'}${e.allDay || !e.start ? '' : ` ${fmtTime(toMin(e.start))}`}` }))}
            empty="No events today or tomorrow."
          />
        </HubCard>
        <HubCard to="/goals" icon="goals" title="Goals" sub="Your quest log" stat={goals ? goals.length : undefined}>
          {gs.length ? (
            <span className="hub-list">
              {gs.map((g) => {
                const p = goalProgress(g, tasks ?? [])
                return (
                  <span key={g.id} className="hub-li hub-li-goal">
                    <span className="row-between"><span className="hub-li-label">{g.title}</span><span className="hub-li-meta">{Math.round(p.pct)}%</span></span>
                    <Progress value={p.pct} label={`${g.title} progress`} />
                  </span>
                )
              })}
            </span>
          ) : <span className="hub-empty">No active goals. Set one: it powers your daily quests.</span>}
        </HubCard>
        <HubCard to="/habits" icon="habits" title="Habits" sub={habits ? `${hs.filter((h) => doneIds.has(h.id!)).length} of ${hs.length} done today` : ' '}>
          <HubList items={hs.slice(0, 4).map((h) => ({ key: h.id!, label: h.name, meta: doneIds.has(h.id!) ? 'Done' : `${h.perWeek}x a week` }))} empty="No routines yet. Add one on Habits." />
        </HubCard>
      </div>
    </>
  )
}
