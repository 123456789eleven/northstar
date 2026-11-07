import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type ISODate } from '../db'
import { Card, Empty, PageHeader, Skeleton } from '../components/ui'
import { today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import { HabitModal } from '../features/habits/HabitParts'
import { HabitCard, HabitDetail, TodayRow } from '../features/habits/HabitRow'
import { isDueToday } from '../features/habits/week'
import { HabitHero } from '../features/habits/HabitHero'
import '../features/goals/quest.css'
import '../features/habits/habits.css'
import '../features/habits/rings.css'
import '../features/habits/hero.css'
import '../features/goals/season.css'

export default function Habits() {
  const d = today()
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const byHabit = useMemo(() => {
    const m = new Map<number, Set<ISODate>>()
    for (const l of logs ?? []) {
      if (!m.has(l.habitId)) m.set(l.habitId, new Set())
      m.get(l.habitId)!.add(l.date)
    }
    return m
  }, [logs])
  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id!, g.title])), [goals])

  const active = (habits ?? []).filter((h) => !h.archived)
  const archived = (habits ?? []).filter((h) => h.archived)
  useFocusTarget({
    ready: habits !== undefined,
    exists: (id) => (habits ?? []).some((h) => String(h.id) === id),
    reveal: (id) => { if ((habits ?? []).find((h) => String(h.id) === id)?.archived) setShowArchived(true) },
  })
  const dueToday = active.filter((h) => isDueToday(byHabit.get(h.id!) ?? new Set(), d, h.perWeek))
  const opened = openId != null ? (habits ?? []).find((h) => h.id === openId) : undefined
  const doneToday = active.filter((h) => byHabit.get(h.id!)?.has(d)).length
  const card = (h: Habit) => (
    <HabitCard key={h.id} habit={h} dates={byHabit.get(h.id!) ?? new Set()} today={d} goalTitle={h.goalId != null ? goalTitle.get(h.goalId) : undefined} onOpen={(x) => setOpenId(x.id ?? null)} />
  )

  return (
    <>
      <PageHeader
        title="Habits"
        sub={habits === undefined ? ' ' : active.length ? `${doneToday} of ${active.length} done today` : 'No habits yet'}
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>New habit</button>}
      />
      {habits !== undefined && logs !== undefined && active.length > 0 && <HabitHero habits={active} byHabit={byHabit} today={d} />}
      <TodayRow habits={dueToday} byHabit={byHabit} today={d} />
      {habits === undefined && (
        <div className="habit-list" aria-busy="true">
          <Card><Skeleton lines={4} label="Loading habits" /></Card>
          <Card><Skeleton lines={4} label="Loading habits" /></Card>
        </div>
      )}
      {habits !== undefined && active.length === 0 && (
        <Card>
          <Empty
            title="No habits yet"
            action={<button className="btn btn-primary" onClick={() => setEditing('new')}>New habit</button>}
          >
            Pick one you can finish in two minutes, like a 10-minute walk. Check it off here or on Today.
          </Empty>
        </Card>
      )}
      <div className="habit-list">{active.map(card)}</div>
      {archived.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && <div className="habit-list" style={{ marginTop: 12 }}>{archived.map(card)}</div>}
        </div>
      )}
      {opened && (
        <HabitDetail
          habit={opened}
          dates={byHabit.get(opened.id!) ?? new Set()}
          today={d}
          goalTitle={opened.goalId != null ? goalTitle.get(opened.goalId) : undefined}
          onClose={() => setOpenId(null)}
          onEdit={(h) => { setOpenId(null); setEditing(h) }}
        />
      )}
      {editing && <HabitModal habit={editing === 'new' ? null : editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
