// Bank (Money) stage: five windows, each lit by a real money habit. Pure steps plus the one loader the stage hook calls.
import { db, type BalanceSnapshot, type Budget, type Contribution, type ISODate, type Transaction } from '../../db'
import { addDays, today } from '../../lib/dates'
import { parseBills, BILLS_KEY, type Bill } from '../finance/bills'
import { formGuide } from '../finance/wealth'
import { ytdContributions } from '../investments/model'
import type { StageStep } from './stage'

/** Bank inputs, all counted from real records. */
export interface BankSnapshot {
  /** Categories with a monthly limit. */
  budgets: number
  /** Completed weeks in the last eight that got a form mark (W, D or L). */
  formWeeks: number
  /** Distinct calendar months with a balance update. */
  netWorthMonths: number
  /** Retirement contributions logged this calendar year, in dollars. */
  contributedThisYear: number
  /** Lesson tracks finished (Academy). */
  tracksDone: number
}

export const BANK_NET_WORTH_MONTHS = 3

export function bankSteps(s: BankSnapshot): StageStep[] {
  const months = BANK_NET_WORTH_MONTHS - s.netWorthMonths
  return [
    { id: 'budgets', label: 'Budgets set', done: s.budgets > 0, todo: 'set a budget in the Vault' },
    { id: 'form', label: 'Form guide started', done: s.formWeeks > 0, todo: 'finish a budgeted week' },
    { id: 'networth', label: `${BANK_NET_WORTH_MONTHS} months tracked`, done: months <= 0, todo: `net worth in ${months} more ${months === 1 ? 'month' : 'months'}` },
    { id: 'retire', label: 'Contribution this year', done: s.contributedThisYear > 0, todo: 'log a retirement contribution' },
    { id: 'track', label: 'Lesson track done', done: s.tracksDone > 0, todo: 'finish a lesson track' },
  ]
}

export interface BankRaw {
  budgets: Budget[]
  txs: Pick<Transaction, 'date' | 'amount' | 'category' | 'description'>[]
  bills: Bill[]
  balances: Pick<BalanceSnapshot, 'date'>[]
  contributions: Pick<Contribution, 'date' | 'amount' | 'account' | 'kind'>[]
  tracksDone: number
}

/** Pure: the Bank snapshot from raw rows on day `t`. */
export function bankSnapshotFrom(raw: BankRaw, t: ISODate): BankSnapshot {
  const form = raw.budgets.length ? formGuide(raw.txs as Transaction[], raw.budgets, raw.bills, t, 8) : []
  return {
    budgets: raw.budgets.filter((b) => b.monthlyLimit > 0).length,
    formWeeks: form.filter((w) => w.mark !== 'none').length,
    netWorthMonths: new Set(raw.balances.map((b) => b.date.slice(0, 7))).size,
    contributedThisYear: ytdContributions(raw.contributions as Contribution[], Number(t.slice(0, 4))),
    tracksDone: raw.tracksDone,
  }
}

/** Reads what the Bank stage needs (last nine weeks of transactions only). */
export async function loadBankSnapshot(): Promise<BankSnapshot> {
  const t = today()
  const [budgets, txs, billRow, balances, contributions, tracks] = await Promise.all([
    db.budgets.toArray(),
    db.transactions.where('date').between(addDays(t, -70), t, true, true).toArray(),
    db.settings.get(BILLS_KEY),
    db.balances.toArray(),
    db.contributions.toArray(),
    db.events.where('area').equals('learning').filter((e) => e.kind === 'learn.track').toArray(),
  ])
  return bankSnapshotFrom({ budgets, txs, bills: parseBills(billRow?.value), balances, contributions, tracksDone: new Set(tracks.map((e) => e.refKey ?? e.title)).size }, t)
}
