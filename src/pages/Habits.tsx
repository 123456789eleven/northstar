import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit, type ISODate } from '../db'
import { Empty, PageHeader } from '../components/ui'
import { today } from '../lib/dates'
import { HabitCard, HabitModal } from '../features/habits/HabitParts'
import '../features/habits/habits.css'

export default function Habits() {
  const d = today()
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

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
  const doneToday = active.filter((h) => byHabit.get(h.id!)?.has(d)).length
  const card = (h: Habit) => (
    <HabitCard key={h.id} habit={h} dates={byHabit.get(h.id!) ?? new Set()} today={d} goalTitle={h.goalId != null ? goalTitle.get(h.goalId) : undefined} onEdit={setEditing} />
  )

  return (
    <>
      <PageHeader
        title="Habits"
        sub={habits === undefined ? ' ' : active.length ? `${doneToday} of ${active.length} done today` : 'Small things, repeated'}
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}>New habit</button>}
      />
      {habits !== undefined && active.length === 0 && (
        <Empty>No habits yet. Tap New habit and start with one you can do in two minutes.</Empty>
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
      {editing && <HabitModal habit={editing === 'new' ? null : editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
