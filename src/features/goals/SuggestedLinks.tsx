import { useState } from 'react'
import type { Goal } from '../../db'
import { Card } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { suggestLinks } from '../progress/metrics'
import { setGoalMetric } from './goalActions'

const KEY = 'ns.goalLinks.dismissed'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

/** One-time helper: offers to link existing goals to an auto-metric by keyword. Never links without a tap. */
export function SuggestedLinks({ goals, bodyGoal }: { goals: Goal[]; bodyGoal: number }) {
  const toast = useToast()
  const [dismissed, setDismissed] = useState(read)
  const list = suggestLinks(goals, { bodyGoal })
  if (dismissed || list.length === 0) return null

  async function link(i: number) {
    const s = list[i]
    const undo = await setGoalMetric(s.goalId, s.metric)
    toast({ message: `Linked "${s.title}" to ${s.summary.toLowerCase()}.`, undo })
  }
  function dismiss() {
    try { localStorage.setItem(KEY, '1') } catch { /* private mode: it will show again */ }
    setDismissed(true)
  }

  return (
    <Card title="Suggested links" action={<button className="btn btn-sm btn-ghost" onClick={dismiss}>Dismiss</button>}>
      <div className="goal-links">
        {list.map((s, i) => (
          <div className="goal-link-row" key={s.goalId}>
            <div className="goal-link-text">{s.title}<span>Track automatically: {s.summary}</span></div>
            <button className="btn btn-sm" aria-label={`Link ${s.title}`} onClick={() => void link(i)}>Link</button>
          </div>
        ))}
      </div>
    </Card>
  )
}
