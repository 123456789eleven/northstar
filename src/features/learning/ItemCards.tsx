import { useState, type CSSProperties } from 'react'
import { db, type LearningItem } from '../../db'
import { formatDate } from '../../lib/dates'
import { addSession, completeItem, fmtMinutes, KIND_LABEL, startItem } from './learningData'

function Meta({ item, goalTitle }: { item: LearningItem; goalTitle?: string }) {
  return (
    <div className="row wrap learn-meta">
      <span className="chip">{KIND_LABEL[item.kind]}</span>
      {item.provider && <span className="small muted">{item.provider}</span>}
      {goalTitle && <span className="chip chip-accent" title="Linked goal">{goalTitle}</span>}
      {item.url && (
        <a className="small muted learn-link" href={item.url} target="_blank" rel="noreferrer noopener">
          Open link
        </a>
      )}
    </div>
  )
}

export function ActiveCard({ item, weekMinutes, goalTitle, onEdit }: { item: LearningItem; weekMinutes: number; goalTitle?: string; onEdit: () => void }) {
  const [draft, setDraft] = useState<number | null>(null)
  const value = draft ?? item.progress
  const commit = () => {
    if (draft != null && item.id != null && draft !== item.progress) void db.learning.update(item.id, { progress: draft })
    setDraft(null)
  }
  const id = item.id!
  return (
    <section className="card learn-card">
      <div className="row-between learn-card-head">
        <h3 className="learn-title">{item.title}</h3>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>
          Edit
        </button>
      </div>
      <Meta item={item} goalTitle={goalTitle} />

      <div className="learn-progress">
        <div className="row-between small">
          <span className="muted">Progress</span>
          <span className="mono">{value}%</span>
        </div>
        <input
          type="range"
          className="learn-range"
          style={{ '--v': `${value}%` } as CSSProperties}
          min={0}
          max={100}
          step={5}
          value={value}
          aria-label={`Progress for ${item.title}`}
          onChange={(e) => setDraft(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </div>

      <div className="row-between wrap learn-actions">
        <div className="row learn-quick" role="group" aria-label="Log study time today">
          {[15, 30, 60].map((m) => (
            <button key={m} className="btn btn-sm" onClick={() => addSession(id, m)}>
              +{m}m
            </button>
          ))}
        </div>
        <span className="small muted mono">{weekMinutes ? `${fmtMinutes(weekMinutes)} this week` : 'Nothing this week'}</span>
      </div>
      <button className="btn btn-sm learn-done" onClick={() => completeItem(item)}>
        {item.kind === 'certification' ? 'Mark earned' : 'Mark complete'}
      </button>
    </section>
  )
}

export function PlannedRow({ item, goalTitle, onEdit }: { item: LearningItem; goalTitle?: string; onEdit: () => void }) {
  return (
    <div className="list-item learn-row">
      <div className="grow">
        <div className="learn-row-title">{item.title}</div>
        <Meta item={item} goalTitle={goalTitle} />
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>
        Edit
      </button>
      <button className="btn btn-primary btn-sm" onClick={() => startItem(item)}>
        Start
      </button>
    </div>
  )
}

export function DoneRow({ item, totalMinutes, goalTitle, onEdit }: { item: LearningItem; totalMinutes: number; goalTitle?: string; onEdit: () => void }) {
  return (
    <div className="list-item learn-row">
      <div className="grow">
        <div className="learn-row-title">{item.title}</div>
        <Meta item={item} goalTitle={goalTitle} />
      </div>
      <div className="learn-row-side small muted mono">
        {item.completedAt && <div>{formatDate(item.completedAt, { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
        {totalMinutes > 0 && <div className="faint">{fmtMinutes(totalMinutes)} logged</div>}
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit}>
        Edit
      </button>
    </div>
  )
}
