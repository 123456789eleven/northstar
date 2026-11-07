// Safe to spend (pure): budget limits minus spend so far minus unpaid bills due before month end.
// Uses only existing data: budgets, month transactions, and the bills model. No DB access.
import type { Budget, ISODate, Transaction } from '../../db'
import { daysBetween } from '../../lib/dates'
import { isSpend } from './categories'
import { matchesBill, nextDue, type Bill } from './bills'
import { budgetPace, dayOfMonthFor, daysInMonthOf } from './moneyGame'

export interface SafeToSpend {
  /** Sum of monthly limits that are above zero. */
  budget: number
  /** Spend so far inside budgeted categories (never negative). */
  spent: number
  /** Unpaid bills that fall due before the month ends. */
  billsDue: number
  billsDueList: { id: string; name: string; amount: number; due: ISODate }[]
  /** budget - spent - billsDue. Negative means over. */
  left: number
  daysLeft: number
  /** Share of the month elapsed, 0..1. */
  marker: number
  /** 0..1 of the budget still free after bills, for the ring. */
  freeShare: number
}

const monthEnd = (month: string): ISODate => `${month}-${String(daysInMonthOf(month)).padStart(2, '0')}`

/** A bill counts as due when its next date is on or before month end and no matching payment is already in the month. */
export function unpaidBillsDue(bills: Bill[], txs: Transaction[], month: string, todayISO: ISODate) {
  if (month < todayISO.slice(0, 7)) return []
  const end = monthEnd(month)
  return bills
    .filter((b) => nextDue(b) <= end)
    .filter((b) => !txs.some((t) => isSpend(t) && t.date.startsWith(month) && t.date > b.lastPaid && matchesBill(b, t)))
    .map((b) => ({ id: b.id, name: b.name, amount: b.amount, due: nextDue(b) }))
    .sort((a, b) => a.due.localeCompare(b.due))
}

/** Null when no budget limits exist (the hero then shows a next step). */
export function safeToSpend(budgets: Budget[], txs: Transaction[], bills: Bill[], month: string, todayISO: ISODate): SafeToSpend | null {
  const limits = budgets.filter((b) => b.monthlyLimit > 0)
  const budget = limits.reduce((s, b) => s + b.monthlyLimit, 0)
  if (budget <= 0) return null
  const cats = new Set(limits.map((b) => b.category))
  const spent = Math.max(0, txs.filter((t) => t.date.startsWith(month) && isSpend(t) && cats.has(t.category)).reduce((s, t) => s - t.amount, 0))
  const billsDueList = unpaidBillsDue(bills, txs, month, todayISO)
  const billsDue = billsDueList.reduce((s, b) => s + b.amount, 0)
  const left = budget - spent - billsDue
  const dim = daysInMonthOf(month)
  const day = dayOfMonthFor(month, todayISO)
  return {
    budget, spent, billsDue, billsDueList, left,
    daysLeft: Math.max(0, dim - day),
    marker: dim ? day / dim : 0,
    freeShare: Math.max(0, Math.min(1, left / budget)),
  }
}

export interface PaceLine {
  status: 'on-track' | 'watch' | 'over'
  label: string
  note: string
}

const whole = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-US')

/** "Budget pace" line with a short coach note, derived from real spend. Null without budgets or for future months. */
export function paceLine(budget: number, spent: number, month: string, todayISO: ISODate): PaceLine | null {
  if (budget <= 0) return null
  const day = dayOfMonthFor(month, todayISO)
  if (day === 0) return null
  const dim = daysInMonthOf(month)
  const p = budgetPace(spent, budget, day, dim)
  const used = Math.round(p.ratio * 100)
  const gone = Math.round(p.marker * 100)
  const past = month < todayISO.slice(0, 7)
  if (past) {
    return p.status === 'over'
      ? { status: 'over', label: 'Over budget', note: `Closed $${whole(spent - budget)} over.` }
      : { status: 'on-track', label: 'Within budget', note: `Closed with $${whole(budget - spent)} unspent.` }
  }
  const expected = budget * p.marker
  const diff = spent - expected
  if (p.status === 'over') return { status: 'over', label: 'Over budget', note: `$${whole(spent - budget)} over with ${dim - day} days left. Hold non-essentials.` }
  if (p.status === 'watch') {
    const perDay = dim - day > 0 ? Math.max(0, (budget - spent) / (dim - day)) : 0
    return { status: 'watch', label: p.label, note: `${used}% used, ${gone}% of the month gone. $${whole(diff)} ahead of pace; about $${whole(perDay)} a day keeps you inside.` }
  }
  return { status: 'on-track', label: 'On pace', note: `${used}% used, ${gone}% of the month gone. $${whole(-diff)} under pace.` }
}

/** Days from today to a due date, as a short phrase. */
export function dueText(due: ISODate, todayISO: ISODate): string {
  const d = daysBetween(todayISO, due)
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} late`
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return `in ${d} days`
}
