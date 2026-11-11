// Wins feed: a short, finite list of recent money highlights derived from existing data. Only good news is listed.
import type { Budget, Contribution, ISODate, Transaction } from '../../db'
import { daysBetween, formatDate, money } from '../../lib/dates'
import type { Bill } from './bills'
import { netWorthMilestones } from './moneyGame'
import { autoStep, bestSavingMonth, changeOver, formGuide, isNewHigh, underBudgetRuns, type NetPoint } from './wealth'

export interface Win { id: string; text: string; date: ISODate }
export interface WinsInput {
  today: ISODate
  series: NetPoint[]
  txs: Transaction[]
  budgets: Budget[]
  bills: Bill[]
  contribs: Contribution[]
}
export const CAUGHT_UP = "You're caught up."
export const MAX_WINS = 5

const ORD = ['Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth']
const monthName = (m: string) => formatDate(`${m}-01`, { month: 'long' })
const prevMonthKey = (todayISO: ISODate) => {
  const y = Number(todayISO.slice(0, 4))
  const m = Number(todayISO.slice(5, 7))
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function deriveWins(i: WinsInput): Win[] {
  const out: Win[] = []
  const last = i.series.at(-1)

  if (last && isNewHigh(i.series) && daysBetween(last.date, i.today) <= 45) {
    out.push({ id: 'nw-high', text: `New net worth high: ${money(last.net)}.`, date: last.date })
  }
  const d30 = changeOver(i.series, 30, i.today)
  if (last && d30 != null && d30 > 0) out.push({ id: 'nw-30', text: `Net worth up ${money(d30)} in 30 days.`, date: last.date })

  if (i.series.length) {
    const step = autoStep(Math.max(...i.series.map((p) => p.net)))
    const crossed = netWorthMilestones(i.series, step, 50).flags.filter((f) => f.reached && f.reachedOn && daysBetween(f.reachedOn, i.today) <= 60)
    const top = crossed.at(-1)
    if (top?.reachedOn) out.push({ id: `ms-${top.target}`, text: `Crossed ${money(top.target)} on ${formatDate(top.reachedOn)}.`, date: top.reachedOn })
  }

  const form = formGuide(i.txs, i.budgets, i.bills, i.today, 8)
  const runs = underBudgetRuns(form)
  if (runs.current >= 2) {
    out.push({ id: 'run', text: `${runs.current <= 8 ? ORD[runs.current] : `${runs.current}th`} straight week under budget.`, date: form.at(-1)!.end })
  }

  const bm = bestSavingMonth(i.txs, i.today)
  if (bm && bm.month === prevMonthKey(i.today)) {
    out.push({ id: 'best-month', text: `${monthName(bm.month)} is your best saving month yet: ${money(bm.net)} saved.`, date: `${bm.month}-28` })
  }

  const recent = i.contribs.filter((c) => c.kind === 'contribution' && daysBetween(c.date, i.today) >= 0 && daysBetween(c.date, i.today) <= 30)
  const added = recent.reduce((s, c) => s + c.amount, 0)
  if (added > 0) out.push({ id: 'invest-30', text: `${money(added)} added to investments in the last 30 days.`, date: recent.map((c) => c.date).sort().at(-1)! })

  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, MAX_WINS)
}
