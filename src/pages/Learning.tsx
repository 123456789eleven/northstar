import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Ring } from '../features/game/ui/Ring'
import { Ladder } from '../features/learning/Ladder'
import { FocusChip, FocusSheet } from '../features/learning/FocusSheet'
import { getFocusRun } from '../features/learning/focusStore'
import { Card, Empty, PageHeader, PageSkeleton, Tabs } from '../components/ui'
import { db, getSetting, setSetting, type LearningItem } from '../db'
import { startOfWeek, today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import ItemModal from '../features/learning/ItemModal'
import { ActiveCard, DoneRow, PlannedRow } from '../features/learning/ItemCards'
import LogView from '../features/learning/LogView'
import { fmtMinutes } from '../features/learning/learningData'
import '../features/learning/learning.css'

type View = 'ladder' | 'active' | 'planned' | 'done' | 'log'
type ModalState = { item?: LearningItem; status?: LearningItem['status'] } | null

const TARGET_KEY = 'learning.weeklyTargetMin'

/** Weekly study time vs a target the user can tap to change. */
function WeekTarget({ minutes }: { minutes: number }) {
  const target = useLiveQuery(() => getSetting<number>(TARGET_KEY, 120), [])
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  if (target === undefined) return null
  const save = async () => {
    const n = Math.round(Number(val))
    if (n > 0 && n <= 5000) await setSetting(TARGET_KEY, n)
    setEditing(false)
  }
  return (
    <div className="card learn-week">
      <div className="row-between">
        <span className="stat-label">Study this week</span>
        {editing ? (
          <form className="row" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <input className="input learn-target-in" inputMode="numeric" autoFocus value={val} onChange={(e) => setVal(e.target.value)} aria-label="Weekly target in minutes" placeholder="min" />
            <button className="btn btn-sm" type="submit">Set</button>
          </form>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => { setVal(String(target)); setEditing(true) }} aria-label={`Target ${fmtMinutes(target)}: change weekly target`}>
            Target {fmtMinutes(target)}
          </button>
        )}
      </div>
      <div className="learn-week-ring" data-testid="study-ring">
        <Ring value={target > 0 ? minutes / target : 0} size={56} stroke={4} tone="mind" label={`${fmtMinutes(minutes)} of ${fmtMinutes(target)} this week`}>
          <span className="mono small">{Math.round(Math.min(1, minutes / target) * 100)}</span>
        </Ring>
        <div className="learn-week-line grow">
          <span className="stat-value">{fmtMinutes(minutes)}</span>
          <span className="small muted mono">{minutes >= target ? 'target met' : `${fmtMinutes(target - minutes)} to go`}</span>
        </div>
      </div>
    </div>
  )
}

export default function Learning() {
  const [view, setView] = useState<View>('ladder')
  const [modal, setModal] = useState<ModalState>(null)
  const [focusFor, setFocusFor] = useState<LearningItem | null>(null)
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

  useFocusTarget({
    ready: items !== undefined,
    exists: (id) => all.some((i) => String(i.id) === id),
    reveal: (id) => { const i = all.find((x) => String(x.id) === id); if (i) setView(i.status) },
  })

  const addFor = (status: LearningItem['status']) => () => setModal({ status })
  const loaded = items !== undefined

  return (
    <>
      <PageHeader
        title="Learning"
        sub="Courses, certifications, books and skills. What you are getting better at."
        actions={
          <>
          <FocusChip onOpen={() => { const r = getFocusRun(); const it = r.phase !== 'idle' ? all.find((x) => x.id === r.itemId) : null; if (it) setFocusFor(it) }} />
          <button className="btn btn-primary" onClick={addFor(view === 'planned' ? 'planned' : view === 'done' ? 'done' : 'active')}>
            Add item
          </button>
          </>
        }
      />
      {loaded ? <WeekTarget minutes={weekTotal} /> : <PageSkeleton rows={4} />}
      <Tabs
        value={view}
        onChange={setView}
        options={[
          { value: 'ladder', label: 'Ladder' },
          { value: 'active', label: `Active${active.length ? ` ${active.length}` : ''}` },
          { value: 'planned', label: `Planned${planned.length ? ` ${planned.length}` : ''}` },
          { value: 'done', label: `Completed${done.length ? ` ${done.length}` : ''}` },
          { value: 'log', label: 'Log' },
        ]}
      />

      {view === 'ladder' && loaded && (
        <Ladder planned={planned} active={active} done={done} weekByItem={weekByItem} onFocus={setFocusFor} onEdit={(i) => setModal({ item: i })} onAdd={(s) => setModal({ status: s })} />
      )}

      {view === 'active' &&
        loaded &&
        (active.length === 0 ? (
          <Card>
            <Empty
              title={all.length === 0 ? 'Nothing here yet' : 'Nothing in progress'}
              action={
                <>
                  <button className="btn btn-primary" onClick={addFor('active')}>Add what you’re learning</button>
                  {planned.length > 0 && <button className="btn" onClick={() => setView('planned')}>See planned ({planned.length})</button>}
                </>
              }
            >
              {all.length === 0
                ? 'Add one concrete thing you’re learning right now: a course you’re enrolled in, a certification you’re studying for, or the book on your nightstand.'
                : 'Start something from Planned, or add what you’re working on now.'}
            </Empty>
          </Card>
        ) : (
          <div className="grid grid-2 learn-grid">
            {active.map((i) => (
              <ActiveCard key={i.id} item={i} weekMinutes={weekByItem.get(i.id!) ?? 0} goalTitle={goalTitle(i.goalId)} onEdit={() => setModal({ item: i })} onFocus={() => setFocusFor(i)} />
            ))}
          </div>
        ))}

      {view === 'planned' && loaded && (
        <Card>
          {planned.length === 0 ? (
            <Empty title="No planned items" action={<button className="btn" onClick={addFor('planned')}>Add a planned item</button>}>
              Keep a short list of what's next: the course after this one, the certification you want by year end.
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
            <Empty title="Nothing completed yet" action={<button className="btn" onClick={addFor('done')}>Add a completed item</button>}>
              Finished items land here and on your Milestones. Already have a certification or course behind you? Add it as completed and give it its due.
            </Empty>
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

      {focusFor && focusFor.id != null && <FocusSheet itemId={focusFor.id} title={focusFor.title} onClose={() => setFocusFor(null)} />}
      {modal && <ItemModal item={modal.item} defaultStatus={modal.status} onClose={() => setModal(null)} />}
    </>
  )
}
