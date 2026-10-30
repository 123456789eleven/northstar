// Starter packs: static, generic, editable content. Nothing here is personal or employer specific.
// Once installed these are ordinary rows; the pack only remembers which rows it created (device-local).
import type { Area, LearningItem, Task } from '../../db'

export interface PackGoal {
  key: string
  title: string
  area: Area
  horizon: 'life' | 'year' | 'quarter'
  parent?: string
  why?: string
  /** Days from today; omitted = no target date. */
  targetInDays?: number
  milestones?: string[]
}
export interface PackLearning {
  title: string
  kind: LearningItem['kind']
  /** Shown in the "provider" field, e.g. a suggested weekly time. */
  note: string
  goal?: string
}
export interface PackHabit {
  name: string
  area: Area
  perWeek: number
  goal?: string
}
export interface PackTask {
  title: string
  priority: Task['priority']
  recurrence: Task['recurrence']
  dueInDays: number
  goal?: string
}
export interface PackBudget {
  category: string
  monthlyLimit: number
}
export interface Pack {
  id: string
  name: string
  blurb: string
  note?: string
  goals?: PackGoal[]
  learning?: PackLearning[]
  habits?: PackHabit[]
  tasks?: PackTask[]
  budgets?: PackBudget[]
}

export const PACKS: Pack[] = [
  {
    id: 'career-lead',
    name: 'Career: from specialist to team lead',
    blurb: 'A path from doing the work well to being trusted to lead it: visible wins, people skills and a steady learning rhythm.',
    note: 'Generic and professional. Rename, reorder or delete anything that does not fit your workplace.',
    goals: [
      { key: 'life', title: 'Lead a team well', area: 'career', horizon: 'life', why: 'Help a team do dependable work and grow the people on it.' },
      {
        key: 'year', title: 'Move from specialist to team lead', area: 'career', horizon: 'year', parent: 'life', targetInDays: 365,
        why: 'Show the work before the title: results, reliability and people skills.',
        milestones: ['Build a case-study portfolio of resolved complex cases', 'Shadow and document a lead’s workflow', 'Run one process improvement with measurable results', 'Learn to give feedback and run a 1:1', 'Understand team metrics and service levels', 'Get a mentor'],
      },
      {
        key: 'q-proof', title: 'Build proof of impact', area: 'career', horizon: 'quarter', parent: 'year', targetInDays: 90,
        milestones: ['Write up 3 complex cases (problem, action, result)', 'Pick one process to improve and record today’s baseline', 'Share the result with my manager'],
      },
      {
        key: 'q-people', title: 'Practise leading people', area: 'career', horizon: 'quarter', parent: 'year', targetInDays: 90,
        milestones: ['Ask a lead if I can shadow them for a week', 'Ask someone to be my mentor', 'Practise giving feedback to a peer', 'Learn the team’s key metrics and what moves them'],
      },
    ],
    learning: [
      { title: 'People management fundamentals', kind: 'book', note: 'Suggested: 60 min/week', goal: 'q-people' },
      { title: 'Giving and receiving feedback', kind: 'skill', note: 'Suggested: 30 min/week', goal: 'q-people' },
      { title: 'Process improvement basics', kind: 'course', note: 'Suggested: 45 min/week', goal: 'q-proof' },
      { title: 'Regulatory knowledge upkeep', kind: 'skill', note: 'Suggested: 30 min/week' },
      { title: 'Reading business financials', kind: 'course', note: 'Suggested: 30 min/week', goal: 'year' },
    ],
    habits: [
      { name: 'Weekly reflection: write down wins for reviews', area: 'career', perWeek: 1, goal: 'q-proof' },
      { name: 'One learning block (30 minutes)', area: 'learning', perWeek: 3, goal: 'year' },
      { name: 'Document one process this week', area: 'career', perWeek: 1, goal: 'q-proof' },
    ],
    tasks: [
      { title: 'Update my accomplishments log', priority: 2, recurrence: 'monthly', dueInDays: 28, goal: 'q-proof' },
      { title: 'Career check-in with my manager', priority: 2, recurrence: 'none', dueInDays: 60, goal: 'year' },
    ],
  },
  {
    id: 'money-basics',
    name: 'Money basics',
    blurb: 'Starter budget categories and two monthly money habits. Limits are placeholders for you to set.',
    note: 'The limits are placeholders. Edit each one on the Finance page before relying on it.',
    budgets: [
      { category: 'Groceries (edit me)', monthlyLimit: 400 },
      { category: 'Dining (edit me)', monthlyLimit: 150 },
      { category: 'Transport (edit me)', monthlyLimit: 150 },
      { category: 'Subscriptions (edit me)', monthlyLimit: 50 },
      { category: 'Fun (edit me)', monthlyLimit: 100 },
    ],
    tasks: [
      { title: 'Monthly bill and subscription review', priority: 2, recurrence: 'monthly', dueInDays: 28 },
      { title: 'Update net worth', priority: 2, recurrence: 'monthly', dueInDays: 30 },
    ],
  },
  {
    id: 'health-basics',
    name: 'Health basics',
    blurb: 'Three daily habits and a weekly meal-prep task. Calorie and protein targets are not set for you.',
    habits: [
      { name: 'Walk 20 minutes', area: 'health', perWeek: 5 },
      { name: 'Keep a consistent sleep window', area: 'health', perWeek: 7 },
      { name: 'Drink enough water', area: 'health', perWeek: 7 },
    ],
    tasks: [{ title: 'Weekly meal prep', priority: 3, recurrence: 'weekly', dueInDays: 3 }],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    blurb: 'A few gentle cadences to stay in touch. No people are created; add them on the People page.',
    habits: [
      { name: 'Reach out to someone I care about', area: 'relationships', perWeek: 3 },
      { name: 'Be fully present with family for a while', area: 'relationships', perWeek: 3 },
    ],
    tasks: [
      { title: 'Call family', priority: 2, recurrence: 'weekly', dueInDays: 3 },
      { title: 'Plan something to do with a friend this month', priority: 3, recurrence: 'monthly', dueInDays: 14 },
    ],
  },
]

export interface PackCounts {
  goals: number
  learning: number
  habits: number
  tasks: number
  budgets: number
}
export function packCounts(p: Pack): PackCounts {
  return { goals: p.goals?.length ?? 0, learning: p.learning?.length ?? 0, habits: p.habits?.length ?? 0, tasks: p.tasks?.length ?? 0, budgets: p.budgets?.length ?? 0 }
}
