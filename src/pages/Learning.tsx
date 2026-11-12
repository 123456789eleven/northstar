// Library, Study floor: the hero is this week's study ring (counts up when a focus run is logged) with one-tap Start focus.
// Under it: what you are on, what is next, what is finished. Add item, the session log and the weekly target sit behind More.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Ring } from '../features/game/ui/Ring'
import { FocusChip, FocusSheet } from '../features/learning/FocusSheet'
import { getFocusRun } from '../features/learning/focusStore'
import { PageSkeleton } from '../components/ui'
import { useNumberRoll } from '../components/motion'
import { PHONE_QUERY, useMedia } from '../components/useMedia'
import { db, getSetting, setSetting, type LearningItem } from '../db'
import { formatDate, startOfWeek, today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import ItemModal from '../features/learning/ItemModal'
import LogView from '../features/learning/LogView'
import { addSession, fmtMinutes, KIND_LABEL, startItem, undoLast } from '../features/learning/learningData'
import { useToast } from '../components/toastContext'
import '../features/learning/learning.css'
import '../features/buildings/library.css'

type ModalState = { item?: LearningItem; status?: LearningItem['status'] } | null

const TARGET_KEY = 'learning.weeklyTargetMin'

function TargetEditor({ target, onDone }: { target: number; onDone: () => void }) {
  const [val, setVal] = useState(String(target))
  const save = async () => {
    const n = Math.round(Number(val))
    if (n > 0 && n <= 5000) await setSetting(TARGET_KEY, n)
    onDone()
  }
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <input className="input learn-target-in" inputMode="numeric" autoFocus value={val} onChange={(e) => setVal(e.target.value)} aria-label="Weekly target in minutes" placeholder="min" />
      <button className="btn btn-sm" type="submit">Set</button>
    </form>
  )
}

export default function Learning() {
  const toast = useToast()
  const phone = useMedia(PHONE_QUERY)
  const [modal, setModal] = useState<ModalState>(null)
  const [focusFor, setFocusFor] = useState<LearningItem | null>(null)
  const [editingTarget, setEditingTarget] = useState(false)
  const items = useLiveQuery(() => db.learning.toArray(), [])
  const sessions = useLiveQuery(() => db.studySessions.toArray(), [])
  const targetSetting = useLiveQuery(() => getSetting<number>(TARGET_KEY, 120), [])

  const weekStart = startOfWeek(today())
  const weekByItem = new Map<number, number>()
  let weekTotal = 0
  for (const s of sessions ?? []) {
    if (s.date >= weekStart) {
      weekByItem.set(s.itemId, (weekByItem.get(s.itemId) ?? 0) + s.minutes)
      weekTotal += s.minutes
    }
  }
  const shown = useNumberRoll(weekTotal, 600)

  const all = items ?? []
  const active = all.filter((i) => i.status === 'active').sort((a, b) => (weekByItem.get(b.id!) ?? 0) - (weekByItem.get(a.id!) ?? 0))
  const planned = all.filter((i) => i.status === 'planned').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const done = all.filter((i) => i.status === 'done').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))

  useFocusTarget({
    ready: items !== undefined,
    exists: (id) => all.some((i) => String(i.id) === id),
  })

  if (items === undefined || sessions === undefined || targetSetting === undefined) return <PageSkeleton rows={4} />
  const target = Number(targetSetting) > 0 ? Number(targetSetting) : 120
  const met = weekTotal >= target
  const top = active[0]

  const log = async (i: LearningItem, m: number) => {
    await addSession(i.id!, m)
    toast({ message: `Logged ${m}m on ${i.title}`, undo: () => undoLast(i.id!, m) })
  }

  const hero = (
    <section className="card floor-hero st-hero" aria-label="Study this week">
      <div className="st-ring" data-testid="study-ring">
        <Ring value={target > 0 ? weekTotal / target : 0} size={phone ? 96 : 128} stroke={phone ? 8 : 10} tone={met ? 'reward' : 'mind'} label={`${fmtMinutes(weekTotal)} of ${fmtMinutes(target)} this week`}>
          <span className="st-ring-num"><span className="st-big mono">{shown}</span><span className="st-unit">min</span></span>
        </Ring>
      </div>
      <div className="st-main">
        <span className="stat-label">Study this week</span>
        <p className="st-line">
          {met ? 'Target met.' : `${fmtMinutes(target - weekTotal)} to go.`}
          {' '}
          {editingTarget ? (
            <TargetEditor target={target} onDone={() => setEditingTarget(false)} />
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingTarget(true)} aria-label={`Target ${fmtMinutes(target)}: change weekly target`}>Target {fmtMinutes(target)}</button>
          )}
        </p>
        <div className="row st-actions">
          <FocusChip onOpen={() => { const r = getFocusRun(); const it = r.phase !== 'idle' ? all.find((x) => x.id === r.itemId) : null; if (it) setFocusFor(it) }} />
          {top ? (
            <button className="btn btn-primary" onClick={() => setFocusFor(top)}>Start focus</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setModal({ status: 'active' })}>Add what you are learning</button>
          )}
          {top && <span className="small muted st-top">{top.title}</span>}
        </div>
      </div>
    </section>
  )

  const onTheGo = (
    <FloorCard key="active" title="On the go" action={<span className="small muted mono">{active.length}</span>}>
      {active.length === 0 ? (
        <p className="small muted">Nothing in progress. Start something from Up next, or add what you are on.</p>
      ) : (
        <ul className="st-list" data-testid="ladder">
          {active.map((i) => (
            <li key={i.id} className="st-row" data-focus-id={i.id}>
              <Ring value={i.progress / 100} size={36} stroke={3} tone="mind" label={`${i.title}: ${i.progress}% complete`}>
                <span className="mono st-pct">{i.progress}</span>
              </Ring>
              <button className="st-title learn-link-btn" onClick={() => setModal({ item: i })} aria-label={`Edit ${i.title}`}>
                <span className="st-name">{i.title}</span>
                <span className="st-sub">{weekByItem.get(i.id!) ? `${fmtMinutes(weekByItem.get(i.id!)!)} this week` : KIND_LABEL[i.kind]}</span>
              </button>
              <button className="btn btn-sm" onClick={() => void log(i, 15)} aria-label={`Log 15 minutes on ${i.title}`}>+15m</button>
              <button className="btn btn-sm btn-primary" onClick={() => setFocusFor(i)} aria-label={`Start focus on ${i.title}`}>Focus</button>
            </li>
          ))}
        </ul>
      )}
    </FloorCard>
  )
  const upNext = (
    <FloorCard key="next" title="Up next" action={<span className="small muted mono">{planned.length}</span>}>
      {planned.length === 0 ? (
        <p className="small muted">Nothing queued. Add the course after this one.</p>
      ) : (
        <ul className="st-list">
          {planned.map((i) => (
            <li key={i.id} className="st-row" data-focus-id={i.id}>
              <button className="st-title learn-link-btn" onClick={() => setModal({ item: i })} aria-label={`Edit ${i.title}`}>
                <span className="st-name">{i.title}</span>
                <span className="st-sub">{KIND_LABEL[i.kind]}</span>
              </button>
              <button className="btn btn-sm" onClick={() => void startItem(i)}>Start</button>
            </li>
          ))}
        </ul>
      )}
    </FloorCard>
  )
  const finished = (
    <FloorCard key="done" title="Finished" action={<span className="small muted mono">{done.length}</span>}>
      {done.length === 0 ? (
        <p className="small muted">Finished items land here and on Milestones.</p>
      ) : (
        <ul className="st-list">
          {done.slice(0, 6).map((i) => (
            <li key={i.id} className="st-row" data-focus-id={i.id}>
              <button className="st-title learn-link-btn" onClick={() => setModal({ item: i })} aria-label={`Edit ${i.title}`}>
                <span className="st-name">{i.title}</span>
                <span className="st-sub">{KIND_LABEL[i.kind]}{i.completedAt ? ` · ${formatDate(i.completedAt, { month: 'short', year: 'numeric' })}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FloorCard>
  )

  return (
    <>
      <FloorView
        label="Study"
        className="lib-floor"
        hero={hero}
        support={[onTheGo, upNext, finished]}
        more={
          <FloorMore
            floor="Study"
            items={[
              { id: 'add', label: 'Add item', onSelect: () => setModal({ status: 'active' }) },
              { id: 'log', label: 'Study log', panel: <LogView items={all} /> },
            ]}
          />
        }
      />
      {focusFor && focusFor.id != null && <FocusSheet itemId={focusFor.id} title={focusFor.title} onClose={() => setFocusFor(null)} />}
      {modal && <ItemModal item={modal.item} defaultStatus={modal.status} onClose={() => setModal(null)} />}
    </>
  )
}
