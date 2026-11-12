import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type ISODate } from '../db'
import { Card, Empty, Skeleton } from '../components/ui'
import { today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import { HabitModal } from '../features/habits/HabitParts'
import { HabitCard, HabitDetail, TodayRow } from '../features/habits/HabitRow'
import { isDueToday } from '../features/habits/week'
import { HabitHero } from '../features/habits/HabitHero'
import { FloorMore, FloorView } from '../features/buildings/Floor'
import '../features/goals/quest.css'
import '../features/habits/habits.css'
import '../features/habits/rings.css'
import '../features/habits/hero.css'
import '../features/goals/season.css'
import '../features/town/town.css'

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
  const card = (h: Habit) => (
    <HabitCard key={h.id} habit={h} dates={byHabit.get(h.id!) ?? new Set()} today={d} goalTitle={h.goalId != null ? goalTitle.get(h.goalId) : undefined} onOpen={(x) => setOpenId(x.id ?? null)} />
  )

  const loading = habits === undefined
  const hero = loading ? (
    <Card><Skeleton lines={4} label="Loading habits" /></Card>
  ) : active.length === 0 ? (
    <Card className="floor-hero">
      <Empty title="No habits yet" action={<button className="btn btn-primary" onClick={() => setEditing('new')}>New habit</button>}>
        Pick one small enough for your worst day, like a 10-minute walk. Check it off here or on Today and the form guide starts filling in.
      </Empty>
    </Card>
  ) : (
    <>
      {logs !== undefined && <HabitHero habits={active} byHabit={byHabit} today={d} />}
      <TodayRow habits={dueToday} byHabit={byHabit} today={d} />
    </>
  )

  const list = active.length > 0 && (
    <div key="list" className="habits-list-block">
      <div className="quest-h-row">
        <h2 className="quest-h">Your habits</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>New habit</button>
      </div>
      <div className="habit-list">{active.map(card)}</div>
      {showArchived && archived.length > 0 && <div className="habit-list" style={{ marginTop: 12 }}>{archived.map(card)}</div>}
    </div>
  )

  const more = (
    <FloorMore
      floor="Habits"
      items={[
        ...(archived.length > 0 ? [{ id: 'archived', label: showArchived ? 'Hide archived' : 'Show archived', value: archived.length, onSelect: () => setShowArchived((v) => !v) }] : []),
        { id: 'goals', label: 'Goals', to: '/goals' },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Habits" className="town-floor" hero={hero} support={[list]} more={loading ? undefined : more} />
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
