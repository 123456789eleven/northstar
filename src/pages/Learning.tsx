import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, PageHeader, Tabs } from '../components/ui'
import KpiStrip from '../components/KpiStrip'
import { db, type LearningItem } from '../db'
import { startOfWeek, today } from '../lib/dates'
import ItemModal from '../features/learning/ItemModal'
import { ActiveCard, DoneRow, PlannedRow } from '../features/learning/ItemCards'
import LogView from '../features/learning/LogView'
import { fmtMinutes } from '../features/learning/learningData'
import '../features/learning/learning.css'

type View = 'active' | 'planned' | 'done' | 'log'
type ModalState = { item?: LearningItem; status?: LearningItem['status'] } | null

export default function Learning() {
  const [view, setView] = useState<View>('active')
  const [modal, setModal] = useState<ModalState>(null)
  const items = useLiveQuery(() => db.learning.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const sessions = useLiveQuery(() => db.studySessions.toArray(), [])

  const weekStart = startOfWeek(today())
  const weekByItem = new Map<number, number>()
  const totalByItem = new Map<number, number>()
  let weekTotal = 0
  for (const s of sessions ?? []) {
    totalByItem.set(s.itemId, (totalByItem.get(s.itemId) ?? 0) + s.minutes)
    if (s.date >= weekStart) {
      weekByItem.set(s.itemId, (weekByItem.get(s.itemId) ?? 0) + s.minutes)
      weekTotal += s.minutes
    }
  }
  const goalTitle = (id?: number) => (id == null ? undefined : goals?.find((g) => g.id === id)?.title)

  const all = items ?? []
  const active = all.filter((i) => i.status === 'active').sort((a, b) => (weekByItem.get(b.id!) ?? 0) - (weekByItem.get(a.id!) ?? 0))
  const planned = all.filter((i) => i.status === 'planned').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const done = all.filter((i) => i.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  const addFor = (status: LearningItem['status']) => () => setModal({ status })
  const loaded = items !== undefined

  return (
    <>
      <PageHeader
        title="Learning"
        sub={weekTotal ? `${fmtMinutes(weekTotal)} of study this week` : 'Courses, certifications, books and skills.'}
        actions={
          <button className="btn btn-primary" onClick={addFor(view === 'planned' ? 'planned' : view === 'done' ? 'done' : 'active')}>
            Add item
          </button>
        }
      />
      {loaded && (
        <KpiStrip
          items={[
            { label: 'Active', value: active.length },
            { label: 'Planned', value: planned.length },
            { label: 'Completed', value: done.length },
            { label: 'Study this week', value: fmtMinutes(weekTotal) },
          ]}
        />
      )}
      <Tabs
        value={view}
        onChange={setView}
        options={[
          { value: 'active', label: 'Active' },
          { value: 'planned', label: 'Planned' },
          { value: 'done', label: 'Completed' },
          { value: 'log', label: 'Log' },
        ]}
      />

      {view === 'active' &&
        loaded &&
        (active.length === 0 ? (
          <Card>
            <Empty>
              <div className="stack">
                <span>
                  {all.length === 0
                    ? 'Add one concrete thing you’re learning right now — a course you’re enrolled in, a certification you’re studying for, or the book on your nightstand.'
                    : 'Nothing in progress. Start something from Planned, or add what you’re working on now.'}
                </span>
                <button className="btn btn-primary" onClick={addFor('active')}>
                  Add what you’re learning
                </button>
              </div>
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-2">
            {active.map((i) => (
              <ActiveCard key={i.id} item={i} weekMinutes={weekByItem.get(i.id!) ?? 0} goalTitle={goalTitle(i.goalId)} onEdit={() => setModal({ item: i })} />
            ))}
          </div>
        ))}

      {view === 'planned' && loaded && (
        <Card>
          {planned.length === 0 ? (
            <Empty>
              <div className="stack">
                <span>Keep a short list of what’s next — the course after this one, a certification you want by year end.</span>
                <button className="btn" onClick={addFor('planned')}>
                  Add a planned item
                </button>
              </div>
            </Empty>
          ) : (
            <div className="list">
              {planned.map((i) => (
                <PlannedRow key={i.id} item={i} goalTitle={goalTitle(i.goalId)} onEdit={() => setModal({ item: i })} />
              ))}
            </div>
          )}
        </Card>
      )}

      {view === 'done' && loaded && (
        <Card>
          {done.length === 0 ? (
            <Empty>Finished items land here and on your Achievements wall. Already have a certification or course behind you? Add it with status Completed.</Empty>
          ) : (
            <div className="list">
              {done.map((i) => (
                <DoneRow key={i.id} item={i} totalMinutes={totalByItem.get(i.id!) ?? 0} goalTitle={goalTitle(i.goalId)} onEdit={() => setModal({ item: i })} />
              ))}
            </div>
          )}
        </Card>
      )}

      {view === 'log' && <LogView items={all} />}

      {modal && <ItemModal item={modal.item} defaultStatus={modal.status} onClose={() => setModal(null)} />}
    </>
  )
}
