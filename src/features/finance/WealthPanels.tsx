// Wealth panels: records strip, savings engine ("put it to work") and the wins feed.
import { useLiveQuery } from 'dexie-react-hooks'
import { Progress } from '../../components/ui'
import { db } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { DEFAULT_IRA_LIMIT, ytdContributions } from '../investments/model'
import { GROWTH_DISCLAIMER, projectRange } from '../markets/growth'
import { useBills } from './billsData'
import { netWorthSeries } from './model'
import { accountsPath, bestSavingMonth, biggestJump, fullForm, highestPoint, monthlyContribution, monthlySurplus, underBudgetRuns } from './wealth'
import './wealth.css'
import { CAUGHT_UP, deriveWins } from './wins'

const monthName = (m: string) => formatDate(`${m}-01`, { month: 'long', year: 'numeric' })

/** Tracked investment account names: holdings' accounts plus the ones the owner marked. */
export function useTrackedAccounts(): Set<string> | undefined {
  return useLiveQuery(async () => {
    const [h, s] = await Promise.all([db.holdings.toArray(), db.settings.get('invest.accounts')])
    return new Set([...h.map((x) => x.account), ...((s?.value as string[] | undefined) ?? [])])
  }, [])
}

/* ---------- Records: a compact row, not cards ---------- */
export function RecordsStrip() {
  const data = useLiveQuery(async () => ({ tx: await db.transactions.toArray(), snaps: await db.balances.toArray(), budgets: await db.budgets.toArray() }), [])
  const tracked = useTrackedAccounts()
  const bills = useBills()
  if (!data || !tracked || !bills) return null
  const t = today()
  const series = netWorthSeries(data.snaps)
  const items = [
    { k: 'Best saving month', v: bestSavingMonth(data.tx, t), f: (r: { month: string; net: number }) => ({ big: money(r.net), at: monthName(r.month) }) },
    { k: 'Longest under-budget run', v: (() => { const r = underBudgetRuns(fullForm(data.tx, data.budgets, bills, t)); return r.longest > 0 && r.longestEnd ? { weeks: r.longest, end: r.longestEnd } : null })(), f: (r: { weeks: number; end: string }) => ({ big: `${r.weeks} ${r.weeks === 1 ? 'week' : 'weeks'}`, at: `ended ${formatDate(r.end, { month: 'short', day: 'numeric', year: 'numeric' })}` }) },
    { k: 'Biggest net worth jump', v: biggestJump(series), f: (r: { amount: number; date: string }) => ({ big: `+${money(r.amount)}`, at: formatDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' }) }) },
    { k: 'Highest portfolio value', v: highestPoint(accountsPath(data.snaps, tracked)), f: (r: { value: number; date: string }) => ({ big: money(r.value), at: formatDate(r.date, { month: 'short', day: 'numeric', year: 'numeric' }) }) },
  ]
  return (
    <section className="wl-records" aria-label="Your records" data-testid="records">
      {items.map((it) => {
        // Each record keeps its own shape; the formatter narrows it.
        const shown = it.v ? (it.f as (r: unknown) => { big: string; at: string })(it.v) : null
        return (
          <div key={it.k}>
            <span className="mn-label">{it.k}</span>
            {shown ? <><span className="wl-rec-num mn-num">{shown.big}</span><span className="tiny muted">{shown.at}</span></> : <span className="tiny faint">Not on the board yet</span>}
          </div>
        )
      })}
    </section>
  )
}

/* ---------- Savings engine ---------- */
export function SavingsEngine() {
  const data = useLiveQuery(async () => ({ tx: await db.transactions.toArray(), contribs: await db.contributions.toArray(), snaps: await db.balances.toArray(), settings: await db.settings.toArray() }), [])
  const tracked = useTrackedAccounts()
  const bills = useBills()
  if (!data || !tracked || !bills) return null
  const t = today()
  const s = monthlySurplus(data.tx, bills, t)
  const putIn = monthlyContribution(data.contribs, t)
  const set = (k: string, d: number) => Number(data.settings.find((x) => x.key === k)?.value ?? d)
  const limit = set('invest.iraLimit', DEFAULT_IRA_LIMIT) + set('invest.iraCatchup', 0)
  const year = Number(t.slice(0, 4))
  const ytd = ytdContributions(data.contribs, year)
  const path = accountsPath(data.snaps, tracked)
  const principal = path.at(-1)?.net ?? 0
  const rows = [
    { k: 'What you put in now', m: putIn },
    ...(s && s.surplus > putIn ? [{ k: 'If the full surplus went in', m: s.surplus }] : []),
  ].filter((r) => r.m > 0)
  const grow = rows.map((r) => ({ ...r, r: projectRange({ principal, monthlyContribution: r.m, years: 10 }) }))
  return (
    <section className="wl-engine" aria-label="Put it to work" data-testid="savings-engine">
      <h2 className="wl-h">Put it to work</h2>
      <div className="wl-engine-grid">
        <div>
          <span className="mn-label">Monthly surplus</span>
          {s ? (
            <>
              <div className="wl-big mn-num" data-testid="surplus">{s.surplus < 0 ? '-' : ''}{money(Math.abs(s.surplus))}</div>
              <div className="small muted mn-num">{money(s.income)} in, {money(s.spending)} spent, {money(s.bills)} bills. Average of the last {s.months} full {s.months === 1 ? 'month' : 'months'}.</div>
            </>
          ) : <div className="small muted">Import a full month of transactions and your surplus shows up here.</div>}
        </div>
        <div>
          <span className="mn-label">Going to investments</span>
          <div className="wl-big mn-num" data-testid="invest-monthly">{money(putIn)}<span className="small muted"> a month</span></div>
          <div className="small muted">Contributions over the last 90 days, averaged. {s && s.surplus > 0 && putIn > 0 ? `That is ${Math.round(Math.min(putIn / s.surplus, 9.99) * 100)}% of your surplus.` : ''}</div>
        </div>
        <div>
          <span className="mn-label">{year} Roth limit</span>
          <div className="wl-big mn-num">{money(ytd)} <span className="small muted">of {money(limit)}</span></div>
          <Progress value={limit > 0 ? Math.min(100, (ytd / limit) * 100) : 0} label={`${year} contributions toward the limit`} />
          <div className="small muted">{ytd >= limit ? 'Limit reached for this year.' : `${money(limit - ytd)} of room left.`} Your own limit depends on income and age.</div>
        </div>
      </div>
      {grow.length > 0 ? (
        <div className="wl-proj" data-testid="projection">
          <span className="mn-label">Where it could lead in 10 years, an illustration</span>
          <table className="table wl-proj-table">
            <thead><tr><th>Monthly amount</th><th>At 3%</th><th>At 6%</th><th>At 9%</th></tr></thead>
            <tbody>
              {grow.map((g) => (
                <tr key={g.k}><td>{g.k}, {money(g.m)}</td><td className="mono">{money(g.r.low.final)}</td><td className="mono">{money(g.r.base.final)}</td><td className="mono">{money(g.r.high.final)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Starts from {money(principal)} in your tracked accounts. {GROWTH_DISCLAIMER}</p>
        </div>
      ) : (
        <p className="small muted">Record a contribution below and a 10-year illustration of where it could lead shows up here.</p>
      )}
    </section>
  )
}

/* ---------- Wins feed ---------- */
export function WinsFeed() {
  const data = useLiveQuery(async () => ({ tx: await db.transactions.toArray(), snaps: await db.balances.toArray(), budgets: await db.budgets.toArray(), contribs: await db.contributions.toArray() }), [])
  const bills = useBills()
  if (!data || !bills) return null
  const wins = deriveWins({ today: today(), series: netWorthSeries(data.snaps), txs: data.tx, budgets: data.budgets, bills, contribs: data.contribs })
  return (
    <section className="card floor-card wl-wins" aria-label="Highlights" data-testid="wins">
      <div className="floor-card-head"><h2>Highlights</h2></div>
      {wins.length === 0 && <p className="small muted">Nothing on the board yet. A week under budget gets you on it.</p>}
      <ul>
        {wins.slice(0, 5).map((w) => (
          <li key={w.id}><span className="wl-win-text">{w.text}</span><span className="tiny faint">{formatDate(w.date)}</span></li>
        ))}
      </ul>
      <p className="small muted wl-caught">{CAUGHT_UP}</p>
    </section>
  )
}
