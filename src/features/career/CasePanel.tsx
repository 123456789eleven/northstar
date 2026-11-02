import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { Card, Field, Tabs } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { today } from '../../lib/dates'
import { goalProgress } from '../goals/progress'
import { buildCase } from './caseBuilder'
import { savePrefs, useOneOnOnes, usePrefs } from './careerData'
import type { Win } from './leadership'
import type { Project } from './projects'

type Months = '3' | '6' | '12'

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

export function CasePanel({ wins, projects }: { wins: Win[]; projects: Project[] }) {
  const toast = useToast()
  const prefs = usePrefs()
  const notes = useOneOnOnes()
  const [months, setMonths] = useState<Months>('6')
  const [role, setRole] = useState<string | null>(null)
  const goals = useLiveQuery(() => db.goals.filter((g) => g.area === 'career').toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const learning = useLiveQuery(() => db.learning.filter((l) => l.status === 'done' && !!l.completedAt).toArray(), [])
  const roleValue = role ?? prefs?.role ?? ''

  const text = useMemo(
    () =>
      buildCase({
        role: roleValue,
        months: Number(months) as 3 | 6 | 12,
        today: today(),
        wins,
        projects,
        goals: (goals ?? []).map((g) => ({ title: g.title, pct: goalProgress(g, tasks ?? []).pct })),
        learning: (learning ?? []).map((l) => ({ title: l.title, completedAt: l.completedAt! })),
        feedback: (notes ?? []).flatMap((n) => n.feedback.map((f) => ({ date: n.date, text: f }))),
      }),
    [roleValue, months, wins, projects, goals, tasks, learning, notes],
  )

  return (
    <Card title="Promotion case" sub="Built from your own records. Nothing leaves this device.">
      <div className="stack">
        <Tabs<Months> value={months} onChange={setMonths} options={[{ value: '3', label: 'Last 3 months' }, { value: '6', label: 'Last 6 months' }, { value: '12', label: 'Last 12 months' }]} />
        <Field label="Target role">
          <input
            className="input"
            value={roleValue}
            placeholder="e.g. Team Lead"
            onChange={(e) => setRole(e.target.value)}
            onBlur={() => prefs && role != null && savePrefs({ ...prefs, role })}
          />
        </Field>
        <pre className="car-case" tabIndex={0} aria-label="Case preview" data-testid="case-text">{text}</pre>
        <div className="row wrap">
          <button className="btn btn-primary" type="button" onClick={async () => { await copyText(text); toast({ message: 'Case copied' }) }}>Copy as text</button>
          <button className="btn" type="button" onClick={() => window.print()}>Print</button>
        </div>
      </div>
    </Card>
  )
}
