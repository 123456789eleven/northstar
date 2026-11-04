// Ladder view: Planned (next up), Active (progress rings, Start focus), Done (shelf).
import type { LearningItem } from '../../db'
import { Ring } from '../game/ui/Ring'
import { formatDate } from '../../lib/dates'
import { fmtMinutes, KIND_LABEL, startItem } from './learningData'

interface Props {
  planned: LearningItem[]; active: LearningItem[]; done: LearningItem[]
  weekByItem: Map<number, number>
  onFocus: (i: LearningItem) => void
  onEdit: (i: LearningItem) => void
  onAdd: (status: LearningItem['status']) => void
}

export function Ladder({ planned, active, done, weekByItem, onFocus, onEdit, onAdd }: Props) {
  return (
    <div className="ladder" data-testid="ladder">
      <section className="ladder-col" aria-label="Planned">
        <h2 className="ladder-head"><span>Planned</span><span>{planned.length}</span></h2>
        {planned.length === 0 && <p className="ladder-empty">Nothing queued. <button className="btn btn-ghost btn-sm" onClick={() => onAdd('planned')}>Add one</button></p>}
        {planned.map((i) => (
          <div key={i.id} className="ladder-item" data-focus-id={i.id}>
            <span className="ladder-main"><span className="ladder-title">{i.title}</span><span className="ladder-sub">{KIND_LABEL[i.kind]}</span></span>
            <button className="btn btn-sm" onClick={() => void startItem(i)}>Start</button>
          </div>
        ))}
      </section>
      <section className="ladder-col" aria-label="Active">
        <h2 className="ladder-head"><span>Active</span><span>{active.length}</span></h2>
        {active.length === 0 && <p className="ladder-empty">Nothing in progress. <button className="btn btn-ghost btn-sm" onClick={() => onAdd('active')}>Add what you are learning</button></p>}
        {active.map((i) => (
          <div key={i.id} className="ladder-item" data-focus-id={i.id}>
            <Ring value={i.progress / 100} size={40} stroke={3} tone="mind" label={`${i.title}: ${i.progress}% complete`}>
              <span className="mono small">{i.progress}</span>
            </Ring>
            <button className="ladder-main learn-link-btn" onClick={() => onEdit(i)} aria-label={`Edit ${i.title}`}>
              <span className="ladder-title">{i.title}</span>
              <span className="ladder-sub">{weekByItem.get(i.id!) ? `${fmtMinutes(weekByItem.get(i.id!)!)} this week` : 'Nothing this week'}</span>
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => onFocus(i)} aria-label={`Start focus on ${i.title}`}>Start focus</button>
          </div>
        ))}
      </section>
      <section className="ladder-col" aria-label="Done">
        <h2 className="ladder-head"><span>Done</span><span>{done.length}</span></h2>
        {done.length === 0 && <p className="ladder-empty">Finished items collect here.</p>}
        {done.map((i) => (
          <button key={i.id} className="ladder-item ladder-shelf learn-link-btn" onClick={() => onEdit(i)} data-focus-id={i.id}>
            <span className="ladder-main"><span className="ladder-title">{i.title}</span><span className="ladder-sub">{KIND_LABEL[i.kind]}{i.completedAt ? ` · ${formatDate(i.completedAt, { month: 'short', year: 'numeric' })}` : ''}</span></span>
          </button>
        ))}
      </section>
    </div>
  )
}
