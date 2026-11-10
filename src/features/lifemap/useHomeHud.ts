// Live figures for the Home HUD and its breakout tabs. Read-only queries over existing tables; no network.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../../db'
import { monthKey, today as todayFn } from '../../lib/dates'
import { useNow } from '../../components/useNow'
import { effectiveCalorieTarget, TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { monthRange } from '../finance/model'
import { safeToSpend } from '../finance/safeToSpend'
import { BILLS_KEY, parseBills } from '../finance/bills'
import { holdingValue } from '../investments/model'
import { readBodySettings } from '../body/bodyData'
import { reachSoon } from '../people/tree'
import { agendaForDay, type AgendaItem } from '../today/agenda'
import { addDays } from '../../lib/dates'

export interface HomeHud {
  cal: number
  calTarget: number
  protein: number
  proteinTarget?: number
  /** Safe to spend this month; null without budgets. */
  safe: { left: number; budget: number; spent: number; billsDue: number } | null
  spentMonth: number
  portfolio: number | null
  weight: { current: number; goal: number; start: number; date: string } | null
  next: AgendaItem | null
  reach: { id: number; name: string; overdue: boolean; dueIn: number | null; relation: string }[]
  journalWeek: number
  studyWeek: number
  winsWeek: number
  careerGoals: { id: number; title: string }[]
  mindGoals: { id: number; title: string }[]
}

export function useHomeHud(): HomeHud | undefined {
  const d = todayFn()
  const now = useNow()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return useLiveQuery(async () => {
    const month = monthKey(d)
    const [from, to] = monthRange(month)
    const weekAgo = addDays(d, -6)
    const [meals, targets, budgets, txs, billsRow, holdings, weights, bodyRows, cal, people, journal, study, goals, events] = await Promise.all([
      db.meals.where('date').equals(d).toArray(), getSetting<FoodTargets>(TARGETS_KEY, {}), db.budgets.toArray(),
      db.transactions.where('date').between(from, to, true, true).toArray(), db.settings.get(BILLS_KEY), db.holdings.toArray(),
      db.weights.orderBy('date').toArray(), db.settings.where('key').startsWith('body.').toArray(),
      db.calendar.where('date').between(addDays(d, -1), d, true, true).toArray(), db.people.toArray(),
      db.journal.where('date').between(weekAgo, d, true, true).count(), db.studySessions.where('date').between(weekAgo, d, true, true).count(),
      db.goals.where('status').equals('active').toArray(), db.events.where('at').aboveOrEqual(weekAgo).toArray(),
    ])
    const s = safeToSpend(budgets, txs, parseBills(billsRow?.value), month, d)
    const values = holdings.map(holdingValue).filter((v): v is number => v !== null)
    const body = readBodySettings(bodyRows)
    const last = weights[weights.length - 1]
    const items = agendaForDay(cal, d, nowMin).filter((i) => i.state !== 'past')
    return {
      cal: meals.reduce((a, m) => a + (m.calories ?? 0), 0),
      calTarget: effectiveCalorieTarget(targets),
      protein: meals.reduce((a, m) => a + (m.protein ?? 0), 0),
      proteinTarget: targets.protein,
      safe: s ? { left: s.left, budget: s.budget, spent: s.spent, billsDue: s.billsDue } : null,
      spentMonth: txs.filter((t) => t.amount < 0).reduce((a, t) => a - t.amount, 0),
      portfolio: values.length ? values.reduce((a, v) => a + v, 0) : null,
      weight: last ? { current: last.weight, goal: body.goal, start: body.startWeight ?? weights[0].weight, date: last.date } : null,
      next: items.find((i) => i.state === 'now') ?? items.find((i) => i.state === 'next') ?? items[0] ?? null,
      reach: reachSoon(people, d, 5).map((x) => ({ id: x.p.id!, name: x.p.name, overdue: x.s.overdue, dueIn: x.s.dueIn, relation: x.p.relation })),
      journalWeek: journal,
      studyWeek: study,
      winsWeek: events.filter((e) => e.kind === 'win').length,
      careerGoals: goals.filter((g) => g.area === 'career').slice(0, 3).map((g) => ({ id: g.id!, title: g.title })),
      mindGoals: goals.filter((g) => g.area === 'learning' || g.area === 'personal').slice(0, 3).map((g) => ({ id: g.id!, title: g.title })),
    }
  }, [d, Math.floor(nowMin / 5)])
}
