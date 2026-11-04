// Shared completion flow for task rows and focus slots: check draws and the title strikes, the row eases out, then the
// task completes (timeline event, recurrence) with an Undo toast, a light haptic and the visual-only combo count.
import { useState } from 'react'
import { db, type Task } from '../../db'
import { useToast } from '../../components/toastContext'
import { DUR, prefersReducedMotion } from '../../components/motion'
import { haptic } from '../../lib/haptics'
import { completeTask, reopenTask } from './taskActions'
import { forgetCompletion, recordCompletion } from './combo'

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
    toast({
      message: `Completed "${task.title}"`,
      undo: async () => {
        forgetCompletion()
        const fresh = await db.tasks.get(task.id!)
        if (fresh) await reopenTask(fresh)
      },
    })
  }
  return { done, completing, leaving, toggle }
}
