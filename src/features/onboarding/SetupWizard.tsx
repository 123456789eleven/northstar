// Guided "Set up Northstar" wizard: seven skippable input steps plus a summary. Everything writes to Dexie on Add,
// so closing at any point keeps the work. Open it with openSetup() or window.dispatchEvent(new Event('northstar:open-setup')).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import BottomSheet from '../../components/BottomSheet'
import { Progress } from '../../components/ui'
import { useMedia, PHONE_QUERY } from '../../components/useMedia'
import { db } from '../../db'
import { FoodStep, GoalsStep, HabitsStep, LearningStep, MoneyStep, PeopleStep, TasksStep, type StepProps } from './SetupSteps'
import { markSetupDone } from './setupActions'
import { SETUP_EVENT } from './setupLogic'
import './setup.css'

type Added = Record<string, string[]>

const STEPS: { key: string; title: string; Comp: (p: StepProps) => ReactNode }[] = [
  { key: 'goals', title: 'Goals', Comp: GoalsStep },
  { key: 'habits', title: 'Habits', Comp: HabitsStep },
  { key: 'money', title: 'Money', Comp: MoneyStep },
  { key: 'food', title: 'Food', Comp: FoodStep },
  { key: 'people', title: 'People', Comp: PeopleStep },
  { key: 'learning', title: 'Learning', Comp: LearningStep },
  { key: 'tasks', title: 'First tasks', Comp: TasksStep },
]
const LAST = STEPS.length // index of the finish screen

const LINKS: { key: string; label: string; to: string }[] = [
  { key: 'goals', label: 'Goals', to: '/goals' },
  { key: 'habits', label: 'Habits', to: '/habits' },
  { key: 'money', label: 'Finance budgets', to: '/finance' },
  { key: 'food', label: 'Food', to: '/food' },
  { key: 'people', label: 'People', to: '/people' },
  { key: 'learning', label: 'Learning', to: '/learning' },
  { key: 'tasks', label: 'Tasks', to: '/tasks' },
]

function Finish({ added, onClose }: { added: Added; onClose: () => void }) {
  const counts = useLiveQuery(async () => {
    const [goals, habits, budgets, people, learning, tasks] = await Promise.all([db.goals.count(), db.habits.count(), db.budgets.count(), db.people.count(), db.learning.count(), db.tasks.where('status').equals('open').count()])
    return { goals, habits, money: budgets, people, learning, tasks } as Record<string, number>
  }, [])
  useEffect(() => { void markSetupDone() }, [])
  const total = Object.values(added).reduce((n, a) => n + a.length, 0)
  return (
    <div className="stack">
      <p className="muted small">{total ? `This session you added ${total} ${total === 1 ? 'thing' : 'things'}. Everything is saved on this device.` : 'Nothing new this time. Your data is unchanged.'}</p>
      <ul className="setup-summary">
        {LINKS.map((l) => (
          <li key={l.key}>
            <Link to={l.to} onClick={onClose} className="setup-sum-link">{l.label}</Link>
            <span className="faint small">{added[l.key]?.length ? `+${added[l.key].length} now` : ''}{added[l.key]?.length && l.key !== 'food' ? ' · ' : ''}{l.key === 'food' ? '' : `${counts?.[l.key] ?? 0} total`}</span>
          </li>
        ))}
      </ul>
      <div className="row"><button className="btn btn-primary" onClick={onClose}>Done</button><span className="tiny faint">Run setup again any time from Settings.</span></div>
    </div>
  )
}

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const phone = useMedia(PHONE_QUERY)
  const [i, setI] = useState(0)
  const [added, setAdded] = useState<Added>({})
  const [busy, setBusy] = useState(false)
  const flush = useRef<(() => Promise<void>) | null>(null)
  const step = STEPS[i]
  const gotSomething = step ? (added[step.key]?.length ?? 0) > 0 : false

  async function go(delta: number) {
    setBusy(true)
    try { if (delta > 0 && flush.current) await flush.current() } finally { setBusy(false) }
    flush.current = null
    setI((n) => Math.max(0, Math.min(LAST, n + delta)))
  }

  return (
    <BottomSheet title="Set up Northstar" onClose={onClose} side={!phone}>
      <div className="setup">
        <div className="setup-top">
        <div className="setup-head">
          <h3 className="setup-title">{step ? step.title : 'Summary'}</h3>
          <span className="mono tiny faint">{i < LAST ? `Step ${i + 1} of ${LAST}` : 'All done'}</span>
        </div>
        <Progress value={(i / LAST) * 100} label="Setup progress" />
        </div>
        <div className="setup-body" key={i}>
          {step ? <step.Comp onAdded={(l) => setAdded((a) => ({ ...a, [step.key]: [...(a[step.key] ?? []), l] }))} flush={flush} /> : <Finish added={added} onClose={onClose} />}
        </div>
        {step && (
          <div className="setup-nav">
            <button className="btn btn-ghost" disabled={i === 0 || busy} onClick={() => void go(-1)}>Back</button>
            <button className={`btn ${gotSomething ? 'btn-primary' : ''}`} disabled={busy} onClick={() => void go(1)}>{gotSomething ? 'Next' : 'Skip'}</button>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/** Mount once on any page that should be able to open setup. Opens on the 'northstar:open-setup' event. */
export function SetupHost() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const on = () => setOpen(true)
    window.addEventListener(SETUP_EVENT, on)
    return () => window.removeEventListener(SETUP_EVENT, on)
  }, [])
  return open ? <SetupWizard onClose={() => setOpen(false)} /> : null
}
