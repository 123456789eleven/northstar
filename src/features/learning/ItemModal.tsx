import { useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Field, Modal } from '../../components/ui'
import { db, type LearningItem } from '../../db'
import { KINDS, saveItem, STATUSES } from './learningData'

export default function ItemModal({
  item,
  defaultStatus = 'active',
  onClose,
}: {
  item?: LearningItem
  defaultStatus?: LearningItem['status']
  onClose: () => void
}) {
  const goals = useLiveQuery(() => db.goals.where('status').equals('active').toArray(), [])
  const [title, setTitle] = useState(item?.title ?? '')
  const [kind, setKind] = useState<LearningItem['kind']>(item?.kind ?? 'course')
  const [provider, setProvider] = useState(item?.provider ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [status, setStatus] = useState<LearningItem['status']>(item?.status ?? defaultStatus)
  const [progress, setProgress] = useState(item?.progress ?? 0)
  const [goalId, setGoalId] = useState<string>(item?.goalId != null ? String(item.goalId) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    await saveItem({ title, kind, provider, url, status, progress, goalId: goalId ? Number(goalId) : undefined }, item)
    onClose()
  }

  const remove = async () => {
    if (item?.id == null) return
    await db.transaction('rw', db.learning, db.studySessions, async () => {
      await db.studySessions.where('itemId').equals(item.id!).delete()
      await db.learning.delete(item.id!)
    })
    onClose()
  }

  // Keep a linked goal visible even if it is no longer active.
  const linkedMissing = item?.goalId != null && goals && !goals.some((g) => g.id === item.goalId)

  return (
    <Modal title={item ? 'Edit item' : 'Add learning item'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What are you learning?" autoFocus required />
        </Field>
        <div className="grid grid-2">
          <Field label="Type">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as LearningItem['kind'])}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as LearningItem['status'])}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Provider (optional)">
            <input className="input" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="School, platform, author…" />
          </Field>
          <Field label="Link (optional)">
            <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </Field>
        </div>
        {status !== 'done' && (
          <Field label={`Progress · ${progress}%`}>
            <input type="range" className="learn-range" style={{ "--v": `${progress}%` } as CSSProperties} min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
          </Field>
        )}
        <Field label="Linked goal (optional)">
          <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">None</option>
            {linkedMissing && <option value={String(item!.goalId)}>Current goal (not active)</option>}
            {goals?.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
          {item &&
            (confirmDelete ? (
              <button type="button" className="btn btn-danger" onClick={remove}>
                Delete item and its sessions
              </button>
            ) : (
              <button type="button" className="btn btn-ghost btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ))}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            {item ? 'Save' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
