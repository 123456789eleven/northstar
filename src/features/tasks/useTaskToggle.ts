// Shared completion flow for task rows and focus slots: check draws and the title strikes, the row eases out, then the
// task completes (timeline event, recurrence) with an Undo toast, a light haptic and the visual-only combo count.
import { useState } from 'react'
import { db, type Task } from '../../db'
import { useToast } from '../../components/toastContext'
import { DUR, prefersReducedMotion } from '../../components/motion'
import { today } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { completeTask, reopenTask } from './taskActions'
import { forgetCompletion, recordCompletion } from './combo'
import { doneMessage } from './winCopy'

export function useTaskToggle(task: Task) {
  const toast = useToast()
  const [completing, setCompleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const done = task.status === 'done' || completing

  async function toggle() {
    if (task.status === 'done') {
      await reopenTask(task)
      return
    }
    if (completing) return
    setCompleting(true)
    if (!prefersReducedMotion()) {
      await new Promise((r) => window.setTimeout(r, DUR.slow))
      setLeaving(true)
      await new Promise((r) => window.setTimeout(r, DUR.base))
    }
    await completeTask(task)
    haptic('tick')
    recordCompletion()
    setCompleting(false)
    setLeaving(false)
    const doneToday = await db.tasks.filter((t) => t.status === 'done' && (t.doneAt ?? '').slice(0, 10) === today()).count()
    toast({
      message: doneMessage(task.title, doneToday),
      undo: async () => {
        forgetCompletion()
        const fresh = await db.tasks.get(task.id!)
        if (fresh) await reopenTask(fresh)
      },
    })
  }
  return { done, completing, leaving, toggle }
}
