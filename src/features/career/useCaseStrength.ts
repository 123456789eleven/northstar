import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { today } from '../../lib/dates'
import { goalProgress } from '../goals/progress'
import { useOneOnOnes } from './careerData'
import { computeCaseStrength } from './caseStrength'
import type { Win } from './leadership'
import type { Project } from './projects'

export function useCaseStrength(wins: Win[], projects: Project[]) {
  const notes = useOneOnOnes()
  const goals = useLiveQuery(() => db.goals.filter((g) => g.area === 'career').toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  return useMemo(
    () => computeCaseStrength({
      today: today(), wins, projects,
      notes: (notes ?? []).map((n) => ({ date: n.date, feedback: n.feedback })),
      goals: (goals ?? []).map((g) => ({ pct: goalProgress(g, tasks ?? []).pct })),
    }),
    [wins, projects, notes, goals, tasks],
  )
}

