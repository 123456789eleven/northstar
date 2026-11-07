// Money overview cards, in reading order: net worth path, cash flow, budgets, bills calendar, subscriptions,
// investments, money goals, monthly recap. Every card owns its empty state. Read-only over existing tables.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '../../components/ui'
import { db, getSetting, type Budget, type Goal, type Transaction } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import { DEFAULT_IRA_LIMIT, holdingValue, monthlyToMax, remainingRoom, ytdContributions } from '../investments/model'
import { goalMetric } from '../progress/metrics'
import { loadMetricData } from '../progress/metricsData'
import { accrued, nextDue, type Bill } from './bills'
import { merchantLabel } from './categories'
import { NetWorthPath } from './NetWorthHero'
import { dayOfMonthFor, daysInMonthOf } from './moneyGame'
import { moneyExact, monthLabel, netWorthSeries, pct, shiftMonth, topMerchants, type MonthSummary } from './model'
import { detectRecurring, monthlyTotal } from './recurring'
import { dueText } from './safeToSpend'

export type Go = (tab: 'transactions' | 'import' | 'budgets' | 'networth' | 'investments', category?: string) => void

const signed = (n: number) => `${n < 0 ? '-' : ''}${money(Math.abs(n))}`

/* ---------- Net worth path ---------- */
export function NetWorthCard({ go }: { go: Go }) {
  const snaps = useLiveQuery(() => db.balances.toArray(), [])
  if (!snaps) return <div className="card mn-skel" aria-busy="true" />
  const series = netWorthSeries(snaps)
  const now = series.at(-1)
  const prev = series.length > 1 ? series.at(-2)! : null
  return (
    <Card title="Net worth" action={<button className="btn btn-ghost btn-sm" onClick={() => go('networth')}>{now ? 'Update balances' : 'Add balances'}</button>}>
      {!now ? (
        <Empty>Add what you own and owe, one balance per account. Update once a month and the path draws itself.</Empty>
      ) : (
        <>
          <div className="mn-row">
            <span className="mn-big mn-num" data-testid="networth-now">{signed(now.net)}</span>
            {prev && (
              <span className={`mn-delta mn-num ${now.net - prev.net < 0 ? 'is-down' : ''}`}>
                {now.net - prev.net >= 0 ? '+' : '-'}{money(Math.abs(now.net - prev.net))} since {formatDate(prev.date, { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          {series.length > 1 ? <NetWorthPath data={series} /> : <p className="mn-note">One update so far. Add another next month to draw the path.</p>}
        </>
      )}
    </Card>
  )
}

/* ---------- Cash flow ---------- */
function Delta({ cur, before, good }: { cur: number; before: number | undefined; good: 'up' | 'down' }) {
  if (before === undefined) return <span className="mn-sub">No comparison</span>
  const d = cur - before
  const bad = good === 'up' ? d < 0 : d > 0
  return <span className={`mn-sub mn-num ${bad && d !== 0 ? 'is-bad' : ''}`}>{d === 0 ? 'No change' : `${d > 0 ? '+' : '-'}${money(Math.abs(d))} vs last month`}</span>
}

export function CashFlowCard({ month, s, prev }: { month: string; s: MonthSummary; prev: MonthSummary | null }) {
  const inProgress = month === today().slice(0, 7)
  return (
    <Card title="Cash flow" sub={`${monthLabel(month)}${inProgress ? ' so far' : ''} ${inProgress ? 'compared with the same days of' : 'compared with'} ${monthLabel(shiftMonth(month, -1), true)}`}>
      <div className="mn-trio">
        <div><span className="mn-label">Income</span><span className="mn-fig mn-num">{money(s.income)}</span><Delta cur={s.income} before={prev?.income} good="up" /></div>
        <div><span className="mn-label">Spending</span><span className="mn-fig mn-num">{money(s.spending)}</span><Delta cur={s.spending} before={prev?.spending} good="down" /></div>
        <div><span className="mn-label">Net</span><span className={`mn-fig mn-num ${s.net < 0 ? 'is-bad' : ''}`}>{signed(s.net)}</span><Delta cur={s.net} before={prev?.net} good="up" /></div>
      </div>
    </Card>
  )
}

/* ---------- Budgets as rings ---------- */
export function BudgetsCard({ month, budgets, spent, go }: { month: string; budgets: Budget[]; spent: Map<string, number>; go: Go }) {
  const t = today()
  const marker = daysInMonthOf(month) ? dayOfMonthFor(month, t) / daysInMonthOf(month) : 0
  const rows = budgets
    .filter((b) => b.monthlyLimit > 0)
    .map((b) => {
      const sp = Math.max(0, spent.get(b.category) ?? 0)
      const ratio = sp / b.monthlyLimit
      return { ...b, spent: sp, ratio, hot: ratio > 1 || (month >= t.slice(0, 7) && ratio > marker + 0.1 && ratio >= 0.5) }
    })
    .sort((a, b) => b.ratio - a.ratio)
  return (
    <Card title="Budgets" action={<button className="btn btn-ghost btn-sm" onClick={() => go('budgets')}>{rows.length ? 'All budgets' : 'Set budgets'}</button>}>
      {rows.length === 0 ? (
        <Empty>Give a few categories a monthly limit. Each gets a ring that fills as you spend.</Empty>
      ) : (
        <ul className="mn-rings">
          {rows.map((r) => (
            <li key={r.category}>
              <button className="mn-ring-btn" onClick={() => go('transactions', r.category)} aria-label={`${r.category}: ${moneyExact(r.spent)} of ${moneyExact(r.monthlyLimit)}. Open transactions`}>
                <Ring value={r.ratio} size={52} stroke={5} className={r.hot ? 'mn-ring-hot' : ''} label={`${Math.round(r.ratio * 100)} percent used`}>
                  <span className="mn-ring-pct mn-num">{Math.round(r.ratio * 100)}</span>
                </Ring>
                <span className="mn-ring-text">
                  <span className="mn-ring-name">{r.category}</span>
                  <span className="mn-sub mn-num">{moneyExact(r.spent)} of {moneyExact(r.monthlyLimit)}</span>
                  <span className={`mn-sub mn-num ${r.ratio > 1 ? 'is-bad' : ''}`}>{r.ratio > 1 ? `${moneyExact(r.spent - r.monthlyLimit)} over` : `${moneyExact(r.monthlyLimit - r.spent)} left`}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ---------- Upcoming bills calendar ---------- */
export function BillsCard({ month, bills, go }: { month: string; bills: Bill[]; go: Go }) {
  const t = today()
  const dim = daysInMonthOf(month)
  const lead = (new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() + 6) % 7
  const dueIn = bills.map((b) => ({ b, due: nextDue(b) })).sort((a, c) => a.due.localeCompare(c.due))
  const days = new Map<number, string[]>()
  for (const { b, due } of dueIn) if (due.startsWith(month)) days.set(Number(due.slice(8, 10)), [...(days.get(Number(due.slice(8, 10))) ?? []), b.name])
  const totalSetAside = bills.reduce((s, b) => s + accrued(b, t), 0)
  return (
    <Card title="Bills coming up" action={<button className="btn btn-ghost btn-sm" onClick={() => go('budgets')}>{bills.length ? 'Manage bills' : 'Add a bill'}</button>}>
      {bills.length === 0 ? (
        <Empty>Add insurance, tuition or any bill that is not monthly. Northstar spreads it across the months and shows when it lands.</Empty>
      ) : (
        <div className="mn-bills">
          <div>
            <ol className="mn-cal" aria-label={`Bills due in ${monthLabel(month)}`}>
              {Array.from({ length: lead }, (_, i) => <li key={`l${i}`} className="mn-cal-pad" aria-hidden />)}
              {Array.from({ length: dim }, (_, i) => {
                const d = i + 1
                const names = days.get(d)
                const isToday = `${month}-${String(d).padStart(2, '0')}` === t
                return (
                  <li key={d} className={`mn-cal-day mn-num ${names ? 'has-bill' : ''} ${isToday ? 'is-today' : ''}`}>
                    <span aria-hidden>{d}</span>
                    {names && <span className="sr-only">{`Day ${d}: ${names.join(', ')} due`}</span>}
                  </li>
                )
              })}
            </ol>
          </div>
          <ul className="mn-list">
            {dueIn.slice(0, 6).map(({ b, due }) => {
              const late = due < t
              return (
                <li key={b.id} className="mn-li">
                  <span className="mn-li-main">
                    <span>{b.name}</span>
                    <span className={`mn-sub mn-num ${late ? 'is-bad' : ''}`}>{formatDate(due, { month: 'short', day: 'numeric' })}, {dueText(due, t)}</span>
                  </span>
                  <span className="mn-li-end">
                    <span className="mn-num">{money(b.amount)}</span>
                    <span className="mn-sub mn-num">{money(accrued(b, t))} set aside</span>
                  </span>
                </li>
              )
            })}
            {dueIn.length > 6 && <li className="mn-sub">and {dueIn.length - 6} more in Budgets</li>}
            <li className="mn-sub mn-num">{money(totalSetAside)} set aside across {bills.length} {bills.length === 1 ? 'bill' : 'bills'}</li>
          </ul>
        </div>
      )}
    </Card>
  )
}

/* ---------- Subscriptions found in transactions ---------- */
export function SubscriptionsCard({ allTx }: { allTx: Transaction[] }) {
  const [all, setAll] = useState(false)
  const rec = detectRecurring(allTx, today())
  const shown = all ? rec : rec.slice(0, 5)
  return (
    <Card title="Subscriptions" action={rec.length > 0 ? <span className="mn-sub mn-num">{moneyExact(monthlyTotal(rec))} a month</span> : undefined}>
      {rec.length === 0 ? (
        <Empty>Repeating charges show up here once a merchant has billed you three times at a steady interval.</Empty>
      ) : (
        <>
          <ul className="mn-list">
            {shown.map((r) => (
              <li key={`${r.merchant}-${r.amount}`} className="mn-li">
                <span className="mn-li-main">
                  <span>{merchantLabel(r.merchant)}</span>
                  <span className="mn-sub mn-num">{r.cadence}, last {formatDate(r.last)}, next about {formatDate(r.next)}</span>
                </span>
                <span className="mn-num">{moneyExact(r.amount)}</span>
              </li>
            ))}
          </ul>
          {rec.length > 5 && <button className="btn btn-ghost btn-sm" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${rec.length}`}</button>}
        </>
      )}
    </Card>
  )
}

/* ---------- Investments ---------- */
export function InvestmentsCard({ go }: { go: Go }) {
  const d = useLiveQuery(async () => {
    const [holdings, contribs, limit] = await Promise.all([db.holdings.toArray(), db.contributions.toArray(), getSetting<number>('invest.iraLimit', DEFAULT_IRA_LIMIT)])
    return { holdings, contribs, limit: Number(limit) || DEFAULT_IRA_LIMIT }
  }, [])
  if (!d) return <div className="card mn-skel" aria-busy="true" />
  const t = today()
  const year = Number(t.slice(0, 4))
  const ytd = ytdContributions(d.contribs, year)
  const room = remainingRoom(d.limit, ytd)
  const total = d.holdings.reduce((s, h) => s + (holdingValue(h) ?? 0), 0)
  const empty = d.holdings.length === 0 && d.contribs.length === 0
  return (
    <Card title="Investments" action={<button className="btn btn-ghost btn-sm" onClick={() => go('investments')}>{empty ? 'Set up' : 'Open'}</button>}>
      {empty ? (
        <Empty>Add a holding such as VTI with its shares and price, and log Roth contributions to track the yearly limit.</Empty>
      ) : (
        <div className="mn-stack">
          {d.holdings.length > 0 && (
            <div>
              <div className="mn-row"><span className="mn-label">Holdings</span><span className="mn-fig mn-num">{money(total)}</span></div>
              <ul className="mn-list">
                {d.holdings.slice(0, 5).map((h) => {
                  const v = holdingValue(h)
                  return (
                    <li key={h.id} className="mn-li">
                      <span className="mn-li-main">
                        <span><strong>{h.ticker}</strong> <span className="mn-sub">{h.account}</span></span>
                        <span className="mn-sub mn-num">{h.shares != null && h.price != null ? `${h.shares.toLocaleString(undefined, { maximumFractionDigits: 3 })} shares x ${moneyExact(h.price)}` : 'Shares or price not set'}</span>
                      </span>
                      <span className="mn-num">{v != null ? money(v) : 'No value'}</span>
                    </li>
                  )
                })}
                {d.holdings.length > 5 && <li className="mn-sub">and {d.holdings.length - 5} more</li>}
              </ul>
            </div>
          )}
          <div className="mn-limit">
            <Ring value={d.limit > 0 ? ytd / d.limit : 0} size={52} stroke={5} label={`${year} contribution progress`}>
              <span className="mn-ring-pct mn-num">{Math.round(d.limit > 0 ? Math.min(1, ytd / d.limit) * 100 : 0)}</span>
            </Ring>
            <span className="mn-ring-text">
              <span className="mn-ring-name">{year} Roth limit</span>
              <span className="mn-sub mn-num">{money(ytd)} of {money(d.limit)}</span>
              <span className="mn-sub mn-num">{room === 0 ? 'Limit reached' : `${money(room)} room, ${money(monthlyToMax(d.limit, ytd, t))} a month to fill it`}</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}

/* ---------- Money goals ---------- */
function goalLine(g: Goal, metric: ReturnType<typeof goalMetric>) {
  if (metric?.hasData) return { pct: metric.pct, text: metric.label || `${Math.round(metric.pct)}%`, note: metric.note }
  const ms = g.milestones ?? []
  if (ms.length) {
    const done = ms.filter((m) => m.done).length
    return { pct: (done / ms.length) * 100, text: `${done} of ${ms.length} steps`, note: '' }
  }
  return { pct: 0, text: g.targetDate ? `Due ${formatDate(g.targetDate)}` : 'No steps yet', note: '' }
}

export function GoalsCard() {
  const d = useLiveQuery(async () => ({ goals: await db.goals.where('area').equals('finance').toArray(), data: await loadMetricData() }), [])
  if (!d) return <div className="card mn-skel" aria-busy="true" />
  const goals = d.goals.filter((g) => g.status === 'active')
  return (
    <Card title="Money goals" action={<Link className="btn btn-ghost btn-sm" to="/goals">Goals</Link>}>
      {goals.length === 0 ? (
        <Empty>No money goals yet. An emergency fund or a net worth target works well; link it to your balances in Goals.</Empty>
      ) : (
        <ul className="mn-list">
          {goals.slice(0, 5).map((g) => {
            const line = goalLine(g, goalMetric(g, d.data))
            return (
              <li key={g.id} className="mn-goal">
                <div className="mn-row"><span>{g.title}</span><span className="mn-sub mn-num">{line.text}</span></div>
                <div className="mn-bar" role="progressbar" aria-label={g.title} aria-valuenow={Math.round(line.pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${Math.min(1, line.pct / 100)})` }} /></div>
                {line.note && <span className="mn-sub">{line.note}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ---------- Monthly recap ---------- */
export function RecapCard({ month, txs, s, prev }: { month: string; txs: Transaction[]; s: MonthSummary; prev: MonthSummary | null }) {
  const cats = [...s.byCategory.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1])
  const top = cats[0]
  const merch = topMerchants(txs, 1)[0]
  const lines: string[] = []
  if (s.income > 0 || s.spending > 0) lines.push(`${money(s.income)} in, ${money(s.spending)} out, ${signed(s.net)} net.`)
  if (s.savingsRate !== null) lines.push(`Savings rate ${pct(s.savingsRate)}${prev && prev.savingsRate !== null ? `, ${pct(prev.savingsRate)} last month` : ''}.`)
  if (top) lines.push(`Biggest category: ${top[0]}, ${money(top[1])}${s.spending > 0 ? ` (${pct(top[1] / s.spending)} of spending)` : ''}.`)
  if (merch) lines.push(`Most visited: ${merchantLabel(merch[0])}, ${merch[1].count} ${merch[1].count === 1 ? 'purchase' : 'purchases'}.`)
  return (
    <Card title={`${monthLabel(month)} recap`}>
      {lines.length === 0 ? <Empty>Nothing to recap yet. Import this month's transactions and the summary writes itself.</Empty> : (
        <ul className="mn-recap">{lines.map((l) => <li key={l} className="mn-num">{l}</li>)}</ul>
      )}
    </Card>
  )
}
