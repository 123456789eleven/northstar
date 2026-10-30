import { useState } from 'react'
import { db, type Goal, type Task } from '../../db'
import { Field, Modal } from '../../components/ui'

export function TaskEditor({ task, goals, onClose }: { task: Task; goals: Goal[]; onClose: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const [due, setDue] = useState(task.due ?? '')
  const [priority, setPriority] = useState<Task['priority']>(task.priority)
  const [recurrence, setRecurrence] = useState<Task['recurrence']>(task.recurrence)
  const [goalId, setGoalId] = useState<number | ''>(task.goalId ?? '')

  async function save() {
    if (!title.trim() || task.id == null) return
    await db.tasks.update(task.id, {
      title: title.trim(),
      notes: notes.trim() || undefined,
      due: due || undefined,
      priority,
      recurrence,
      goalId: goalId === '' ? undefined : goalId,
    })
    onClose()
  }

  async function remove() {
    if (task.id == null) return
    if (!confirm(`Delete "${task.title}"?`)) return
    await db.tasks.delete(task.id)
    onClose()
  }

  const selectable = goals.filter((g) => g.status !== 'done' || g.id === task.goalId)

  return (
    <Modal title="Edit task" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="grid grid-2">
          <Field label="Due">
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
          <Field label="Priority">
            <select className="select" value={priority} onChange={(e) => setPriority(Number(e.target.value) as Task['priority'])}>
              <option value={1}>High</option>
              <option value={2}>Normal</option>
              <option value={3}>Low</option>
            </select>
          </Field>
          <Field label="Repeats">
            <select className="select" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Task['recurrence'])}>
              <option value="none">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </Field>
          <Field label="Goal">
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">None</option>
              {selectable.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="row-between" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-ghost btn-danger" onClick={() => void remove()}>
            Delete
          </button>
          <div className="row">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
