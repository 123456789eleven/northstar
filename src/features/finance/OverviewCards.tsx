// Bank cards shown on floor sheets: cash flow, bills calendar, subscriptions, money goals, monthly recap.
// Every card owns its empty state. Read-only over existing tables.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Empty } from '../../components/ui'
import { db, type Goal, type Transaction } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { goalMetric } from '../progress/metrics'
import { loadMetricData } from '../progress/metricsData'
import { accrued, nextDue, type Bill } from './bills'
import { merchantLabel } from './categories'
import { daysInMonthOf } from './moneyGame'
import { moneyExact, monthLabel, pct, shiftMonth, topMerchants, type MonthSummary } from './model'
import { detectRecurring, monthlyTotal, splitRecurring } from './recurring'
import { dueText } from './safeToSpend'

export type Go = (tab: 'transactions' | 'import' | 'budgets' | 'networth' | 'investments', category?: string) => void

const signed = (n: number) => `${n < 0 ? '-' : ''}${money(Math.abs(n))}`

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
    <Card title="Cash flow" sub={`All spending, vs ${monthLabel(shiftMonth(month, -1), true)}${inProgress ? ' at this point' : ''}`}>
      <div className="mn-trio">
        <div><span className="mn-label">Income</span><span className="mn-fig mn-num">{money(s.income)}</span><Delta cur={s.income} before={prev?.income} good="up" /></div>
        <div><span className="mn-label">Spending</span><span className="mn-fig mn-num">{money(s.spending)}</span><Delta cur={s.spending} before={prev?.spending} good="down" /></div>
        <div><span className="mn-label">Net</span><span className={`mn-fig mn-num ${s.net < 0 ? 'is-bad' : ''}`}>{signed(s.net)}</span><Delta cur={s.net} before={prev?.net} good="up" /></div>
      </div>
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
        <Empty>Add insurance, tuition or any bill that is not monthly. It gets spread across the months so nothing lands as a surprise.</Empty>
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
function RecRows({ rows }: { rows: ReturnType<typeof detectRecurring> }) {
  return (
    <ul className="mn-list">
      {rows.map((r) => (
        <li key={`${r.merchant}-${r.amount}`} className="mn-li">
          <span className="mn-li-main">
            <span>{merchantLabel(r.merchant)}</span>
            <span className="mn-sub mn-num">{r.cadence}, last {formatDate(r.last)}, next about {formatDate(r.next)}</span>
          </span>
          <span className="mn-num">{moneyExact(r.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

export function SubscriptionsCard({ allTx }: { allTx: Transaction[] }) {
  const [all, setAll] = useState(false)
  const { subscriptions, bills } = splitRecurring(detectRecurring(allTx, today()), allTx)
  const shown = all ? subscriptions : subscriptions.slice(0, 5)
  return (
    <Card title="Subscriptions" action={subscriptions.length > 0 ? <span className="mn-sub mn-num">{moneyExact(monthlyTotal(subscriptions))} a month</span> : undefined}>
      {subscriptions.length === 0 ? (
        <Empty>No repeating charges spotted yet. A merchant lands here once it has billed you on a steady schedule.</Empty>
      ) : (
        <>
          <RecRows rows={shown} />
          {subscriptions.length > 5 && <button className="btn btn-ghost btn-sm" onClick={() => setAll((v) => !v)}>{all ? 'Show fewer' : `Show all ${subscriptions.length}`}</button>}
        </>
      )}
      {bills.length > 0 && (
        <details className="mn-fixed">
          <summary>
            <span>Fixed bills found, {bills.length}</span>
            <span className="mn-sub mn-num">{moneyExact(monthlyTotal(bills))} a month</span>
          </summary>
          <RecRows rows={bills} />
        </details>
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
        <Empty>No money goals yet. An emergency fund or a net worth target makes a good first one; link it to your balances in Goals.</Empty>
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
