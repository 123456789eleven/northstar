import { useState } from 'react'
import { AREAS, db, type Area, type Goal } from '../../db'
import { AREA_LABEL, Field, Modal } from '../../components/ui'
import { HORIZON_LABEL } from './progress'
import { completeGoal, createGoal, reopenGoal, setPaused } from './goalActions'

const RANK: Record<Goal['horizon'], number> = { life: 0, year: 1, quarter: 2 }

/** Create (no id) or edit a goal. `initial` may carry defaults such as parentId/horizon/area. */
export function GoalEditor({ initial, goals, onClose }: { initial: Partial<Goal>; goals: Goal[]; onClose: () => void }) {
  const editing = initial.id != null
  const [title, setTitle] = useState(initial.title ?? '')
  const [area, setArea] = useState<Area>(initial.area ?? 'personal')
  const [horizon, setHorizon] = useState<Goal['horizon']>(initial.horizon ?? 'life')
  const [parentId, setParentId] = useState<number | ''>(initial.parentId ?? '')
  const [why, setWhy] = useState(initial.why ?? '')
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? '')
  const [status, setStatus] = useState<Goal['status']>(initial.status ?? 'active')

  const parents = goals.filter((g) => g.id !== initial.id && RANK[g.horizon] < RANK[horizon] && g.status !== 'done')

  async function save() {
    if (!title.trim()) return
    const pid = parentId === '' || !parents.some((p) => p.id === parentId) ? undefined : parentId
    const fields = {
      title: title.trim(),
      area,
      horizon,
      parentId: pid,
      why: why.trim() || undefined,
      targetDate: targetDate || undefined,
    }
    if (editing) {
      await db.goals.update(initial.id!, fields)
      const fresh = await db.goals.get(initial.id!)
      if (fresh && status !== initial.status) {
        if (status === 'done') await completeGoal(fresh)
        else {
          if (initial.status === 'done') await reopenGoal(fresh)
          await setPaused(fresh, status === 'paused')
        }
      }
    } else await createGoal({ ...fields, status })
    onClose()
  }

  async function remove() {
    const id = initial.id
    if (id == null) return
    if (!confirm(`Delete "${initial.title}"? Sub-goals move up a level; linked tasks are kept.`)) return
    await db.transaction('rw', db.goals, db.tasks, db.learning, async () => {
      await db.goals.where('parentId').equals(id).modify((g) => {
        if (initial.parentId != null) g.parentId = initial.parentId
        else delete g.parentId
      })
      await db.tasks.where('goalId').equals(id).modify((t) => { delete t.goalId })
      await db.learning.where('goalId').equals(id).modify((l) => { delete l.goalId })
      await db.goals.delete(id)
    })
    onClose()
  }

  return (
    <Modal title={editing ? 'Edit goal' : `New ${HORIZON_LABEL[horizon].toLowerCase()} goal`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Goal">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            placeholder={horizon === 'life' ? 'e.g. Lead a team I am proud of' : horizon === 'year' ? 'e.g. Move into a team lead role' : 'e.g. Finish the leadership course'}
          />
        </Field>
        <div className="grid grid-2">
          <Field label="Horizon">
            <select className="select" value={horizon} onChange={(e) => setHorizon(e.target.value as Goal['horizon'])}>
              <option value="life">Life</option>
              <option value="year">Year</option>
              <option value="quarter">Quarter</option>
            </select>
          </Field>
          <Field label="Area">
            <select className="select" value={area} onChange={(e) => setArea(e.target.value as Area)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {AREA_LABEL[a]}
                </option>
              ))}
            </select>
          </Field>
          {horizon !== 'life' && (
            <Field label="Part of">
              <select className="select" value={parentId} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">None</option>
                {parents.map((g) => (
                  <option key={g.id} value={g.id}>
                    {HORIZON_LABEL[g.horizon]}: {g.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Target date">
            <input className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          {editing && (
            <Field label="Status">
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value as Goal['status'])}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
              </select>
            </Field>
          )}
        </div>
        <Field label="Why it matters">
          <textarea className="textarea" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="One or two sentences you'll want to reread on a hard week." />
        </Field>
        <div className="row-between" style={{ marginTop: 8 }}>
          {editing ? (
            <button type="button" className="btn btn-ghost btn-danger" onClick={() => void remove()}>
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
