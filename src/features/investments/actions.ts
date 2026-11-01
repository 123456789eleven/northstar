// Investments writes. Every meaningful action logs one event; undo removes the data and its event together.
import { db, logEvent, type BalanceSnapshot, type Contribution } from '../../db'
import { money, today } from '../../lib/dates'
import { netWorthSeries } from '../finance/model'
import { ytdContributions } from './model'

/** Adds a Net worth snapshot with the same "new all-time high" milestone as the Net worth tab. Returns the new net worth if it is a high. */
export async function addNetWorthSnapshot(s: Omit<BalanceSnapshot, 'id'>): Promise<number | null> {
  const before = netWorthSeries(await db.balances.toArray())
  const prevHigh = before.length ? Math.max(...before.map((p) => p.net)) : null
  const id = await db.balances.add(s)
  const now = netWorthSeries(await db.balances.toArray()).at(-1)?.net ?? 0
  if (prevHigh !== null && now > prevHigh) {
    await logEvent({ area: 'finance', kind: 'finance.networth-high', title: `New net worth high: ${money(now)}`, refTable: 'balances', refId: id, milestone: true })
    return now
  }
  return null
}

export async function updatePrice(id: number, price: number) {
  await db.holdings.update(id, { price, priceDate: today() })
}

export async function addContribution(c: Omit<Contribution, 'id'>, limit: number) {
  const id = await db.contributions.add(c)
  if (c.kind !== 'contribution') return
  await logEvent({ area: 'finance', kind: 'finance.contribution', title: `Retirement contribution: ${money(c.amount)}`, refTable: 'contributions', refId: id })
  await maybeMilestone(c.account, Number(c.date.slice(0, 4)), limit)
}

async function maybeMilestone(account: string, year: number, limit: number) {
  const ytd = ytdContributions(await db.contributions.toArray(), year, account)
  if (ytd < limit) return
  const key = `${account}|${year}`
  if (await db.events.where('area').equals('finance').filter((e) => e.kind === 'finance.contribution-max' && e.refKey === key).count()) return
  await logEvent({ area: 'finance', kind: 'finance.contribution-max', title: `Maxed retirement contributions for ${year}`, refKey: key, milestone: true })
}

export async function deleteContribution(c: Contribution) {
  await db.transaction('rw', db.contributions, db.events, async () => {
    await db.contributions.delete(c.id!)
    await db.events.where('area').equals('finance').filter((e) => e.refTable === 'contributions' && e.refId === c.id).delete()
  })
}

/** Records several imported transactions as contributions: one event for the batch. */
export async function recordContributions(rows: Omit<Contribution, 'id'>[], limit: number) {
  if (!rows.length) return
  const batch = `invest-${Date.now()}`
  await db.contributions.bulkAdd(rows)
  await logEvent({ area: 'finance', kind: 'finance.contribution', title: `Recorded ${rows.length} retirement contribution${rows.length === 1 ? '' : 's'} from transactions`, refKey: batch })
  for (const key of new Set(rows.map((r) => `${r.account}|${r.date.slice(0, 4)}`))) {
    const [account, year] = key.split('|')
    await maybeMilestone(account, Number(year), limit)
  }
}
