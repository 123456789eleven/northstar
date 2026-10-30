import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../../db'
import { Card } from '../../components/ui'
import { BACKUP_LAST_KEY } from '../../lib/backup'
import { DEMO_KEY } from '../../lib/demo'
import { loadDemoWithConfirm } from './demoActions'
import { openSetup, SETUP_DONE_KEY } from './setupLogic'
import './onboarding.css'

export const DISMISSED_KEY = 'onboarding.dismissed'
/** Show the card only while the person has put in very little. */
const LITTLE = 15

export function FirstRunCard() {
  const [busy, setBusy] = useState(false)
  const s = useLiveQuery(async () => {
    const [tasks, goals, tx, meals, people, habits, dismissed, demo, backup, sync, setup] = await Promise.all([
      db.tasks.count(), db.goals.count(), db.transactions.count(), db.meals.count(), db.people.count(), db.habits.count(),
      getSetting(DISMISSED_KEY, false), db.settings.get(DEMO_KEY), getSetting<string | null>(BACKUP_LAST_KEY, null), getSetting('sync.enabled', false), getSetting(SETUP_DONE_KEY, false),
    ])
    return { tasks, goals, tx, meals, people, total: tasks + goals + tx + meals + people + habits, dismissed, demo: !!demo, backup: !!backup, sync: !!sync, setup: !!setup }
  }, [])

  if (!s || s.dismissed || s.demo || s.total >= LITTLE) return null

  const steps: { done: boolean; label: string; to?: string; cta: string; optional?: boolean; onClick?: () => void }[] = [
    { done: s.setup, label: 'Set up Northstar with your real goals, habits and budgets', cta: s.setup ? 'Run again' : 'Start', onClick: openSetup },
    { done: s.tasks > 0, label: 'Add a task', to: '/tasks', cta: 'Tasks' },
    { done: s.goals > 0, label: 'Set a goal for this quarter', to: '/goals', cta: 'Goals' },
    { done: s.tx > 0, label: 'Import a bank CSV or add a transaction', to: '/finance', cta: 'Finance' },
    { done: s.meals > 0, label: 'Log a meal', to: '/food', cta: 'Food' },
    { done: s.people > 0, label: 'Add someone you want to stay in touch with', to: '/people', cta: 'People' },
    { done: s.backup, label: 'Make a backup', to: '/settings', cta: 'Settings' },
    { done: s.sync, label: 'Turn on encrypted sync', to: '/settings', cta: 'Settings', optional: true },
  ]
  const finished = steps.filter((x) => x.done).length

  return (
    <Card title="Getting started" action={<span className="faint small">{finished} of {steps.length}</span>} className="first-run">
      <p className="muted small" style={{ margin: 0 }}>Everything stays on this device. Do these in any order, or look around with sample data first.</p>
      <ol className="first-run-steps">
        {steps.map((x) => (
          <li key={x.label} className={x.done ? 'is-done' : ''}>
            <span className="first-run-tick" aria-hidden="true">{x.done ? '✓' : ''}</span>
            <span className="first-run-label">
              {x.label}
              {x.optional && <span className="faint"> (optional)</span>}
              <span className="sr-only">{x.done ? ', done' : ''}</span>
            </span>
            {x.to ? <Link className="btn btn-sm" to={x.to}>{x.cta}</Link> : <button className="btn btn-sm" onClick={x.onClick}>{x.cta}</button>}
          </li>
        ))}
      </ol>
      <div className="row first-run-actions">
        <button className="btn btn-primary" disabled={busy} onClick={async () => { setBusy(true); try { await loadDemoWithConfirm() } finally { setBusy(false) } }}>Load demo data</button>
        <button className="btn btn-ghost" onClick={() => void setSetting(DISMISSED_KEY, true)}>Start blank</button>
      </div>
    </Card>
  )
}
