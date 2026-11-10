// Live inputs for the Life map. Read-only: area week from the engine, plus balances, budgets, people and milestones.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Area } from '../../db'
import { monthKey, startOfWeek, today as todayFn } from '../../lib/dates'
import { netWorthSeries, monthRange, summarize } from '../finance/model'
import { useAreaWeek } from '../game/useAreaWeek'
import { usePlayerState } from '../game/ui/playerContext'
import type { SkillId } from '../game/types'
import { personStatus } from '../people/people'
import { buildLifeMap, type LifeMap } from './model'

const EVENT_AREA: Record<Area, SkillId> = { career: 'career', health: 'body', finance: 'money', learning: 'mind', personal: 'mind', relationships: 'people' }

/** Undefined while loading. */
export function useLifeMap(): LifeMap | undefined {
  const p = usePlayerState()
  const target = p.streak.target || 5
  const areas = useAreaWeek(target)
  const d = todayFn()
  const raw = useLiveQuery(async () => {
    const [from, to] = monthRange(monthKey(d))
    const [balances, budgets, txs, people, events] = await Promise.all([
      db.balances.toArray(), db.budgets.toArray(), db.transactions.where('date').between(from, to, true, true).toArray(),
      db.people.toArray(), db.events.where('at').aboveOrEqual(startOfWeek(d)).toArray(),
    ])
    const series = netWorthSeries(balances)
    const spent = summarize(txs).byCategory
    return {
      netWorth: series.length ? series[series.length - 1].net : null,
      budgetsOver: budgets.filter((b) => b.monthlyLimit > 0 && (spent.get(b.category) ?? 0) > b.monthlyLimit).length,
      peopleTotal: people.length,
      peopleOverdue: people.filter((x) => personStatus(x, d).overdue).length,
      milestones: [...new Set(events.filter((e) => e.milestone && e.area in EVENT_AREA).map((e) => EVENT_AREA[e.area as Area]))],
    }
  }, [d])
  return useMemo(() => {
    if (!areas || !raw || p.loading) return undefined
    return buildLifeMap({ ...raw, areas, target, today: d, planLeft: p.quests.filter((q) => !q.done).length, planTotal: p.quests.length })
  }, [areas, raw, p.loading, p.quests, target, d])
}
