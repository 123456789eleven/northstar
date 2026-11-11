import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, PageSkeleton } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import { db } from '../../db'
import { money, today } from '../../lib/dates'
import { budgetSpend } from './bills'
import { useBills } from './billsData'
import { merchantLabel, UNCATEGORIZED } from './categories'
import { CategoryBars, TrendChart } from './charts'
import { BillsCard, BudgetsCard, MonthStrip, CashFlowCard, GoalsCard, InvestmentsCard, NetWorthCard, RecapCard, SubscriptionsCard, type Go } from './OverviewCards'
import FormGuide from './FormGuide'
import SafeHero from './SafeHero'
import { WinsFeed } from './WealthPanels'
import { safeToSpend } from './safeToSpend'
import { TREND_LEGEND } from './series'
import { monthLabel, monthRange, moneyExact, shiftMonth, summarize, topMerchants, useMonthTx } from './model'

export default function Overview({ month, goTo }: { month: string; goTo: Go }) {
  const txs = useMonthTx(month)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const first = shiftMonth(month, -5)
  const trendTx = useLiveQuery(() => db.transactions.where('date').between(monthRange(first)[0], monthRange(month)[1], true, true).toArray(), [first, month])
  const bills = useBills()
  const allTx = useLiveQuery(() => db.transactions.toArray(), [])

  if (!txs || !budgets || !trendTx || !allTx || !bills) return <PageSkeleton rows={5} />

  if (allTx.length === 0) {
    return (
      <div className="stack mn-page">
        <SafeHero month={month} safe={null} onBudgets={() => goTo('budgets')} />
        <Card>
          <Empty
            title="The scoreboard is empty"
            action={<button className="btn btn-primary" onClick={() => goTo('import')}>Import a file</button>}
          >
            Grab recent transactions from your bank (OFX or QFX is best, CSV works too) and drop the file in. It never leaves this device. Your first week of form shows up right after.
          </Empty>
        </Card>
        <NetWorthCard go={goTo} />
        <InvestmentsCard go={goTo} />
        <GoalsCard />
      </div>
    )
  }

  const s = summarize(txs)
  const t = today()
  const cats = [...s.byCategory.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }))
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(first, i)
    const sm = summarize(trendTx.filter((x) => x.date.startsWith(m)))
    return { label: monthLabel(m, true), income: Math.round(sm.income), spending: Math.round(Math.max(0, sm.spending)) }
  })
  const merchants = topMerchants(txs)
  const bs = budgetSpend(txs, bills)
  const uncategorized = txs.filter((x) => x.category === UNCATEGORIZED).length

  // The month in progress is compared with the same days of last month, so day 1 is never judged against all of last month.
  const prevMonth = shiftMonth(month, -1)
  const inProgress = month === t.slice(0, 7)
  const cutoffDay = Number(t.slice(8, 10))
  const prevTx = trendTx.filter((x) => x.date.startsWith(prevMonth) && (!inProgress || Number(x.date.slice(8, 10)) <= cutoffDay))
  const prev = prevTx.length ? summarize(prevTx) : null

  const safe = safeToSpend(budgets, txs, bills, month, t)

  return (
    <div className="stack mn-page">
      <FormGuide txs={allTx} budgets={budgets} bills={bills} onBudgets={() => goTo('budgets')} />
      <SafeHero month={month} safe={safe} onBudgets={() => goTo('budgets')} />
      <WinsFeed />
      <MonthStrip month={month} txs={txs} bills={bills} />

      {uncategorized > 0 && (
        <div className="card row-between wrap">
          <span className="small">
            <strong className="mn-num">{uncategorized}</strong> <span className="muted">{uncategorized === 1 ? 'transaction needs' : 'transactions need'} a category this month.</span>
          </span>
          <button className="btn btn-sm" onClick={() => goTo('transactions', UNCATEGORIZED)}>Categorize</button>
        </div>
      )}

      <NetWorthCard go={goTo} />
      <CashFlowCard month={month} s={s} prev={prev} />
      <BudgetsCard month={month} budgets={budgets} spent={bs.spent} go={goTo} />
      <BillsCard month={month} bills={bills} go={goTo} />
      <SubscriptionsCard allTx={allTx} />
      <InvestmentsCard go={goTo} />
      <GoalsCard />
      <RecapCard month={month} txs={txs} s={s} prev={prev} />

      <h2 className="mn-section">Where it went</h2>
      <div className="fin-ov-grid">
        <div className="fin-ov-col">
          <ChartFrame
            title={`Spending by category, ${monthLabel(month, true)}`}
            empty="Nothing spent yet this month."
            hasData={cats.length > 0}
            table={<MoneyTable head={['Category', 'Spent']} rows={cats.map((c) => [c.category, money(c.amount)])} />}
          >
            <CategoryBars rows={cats} onPick={(c) => goTo('transactions', c)} />
          </ChartFrame>
          <Card title="Top merchants">
            {merchants.length ? (
              <div className="list">
                {merchants.map(([k, v]) => (
                  <div key={k} className="list-item small">
                    <span className="grow">{merchantLabel(k)}</span>
                    <span className="faint tiny">{v.count} {v.count === 1 ? 'purchase' : 'purchases'}</span>
                    <span className="mn-num" style={{ minWidth: 80, textAlign: 'right' }}>{moneyExact(v.total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No purchases yet this month. Quiet is fine.</Empty>
            )}
          </Card>
        </div>
        <ChartFrame
          title="Income and spending, 6 months"
          legend={TREND_LEGEND}
          hasData={trend.some((x) => x.income > 0 || x.spending > 0)}
          table={<MoneyTable head={['Month', 'Income', 'Spending']} rows={trend.map((x) => [x.label, money(x.income), money(x.spending)])} />}
        >
          <TrendChart data={trend} />
        </ChartFrame>
      </div>

      <div className="mn-tools no-print">
        <span className="mn-label">Tools</span>
        <button className="btn btn-sm btn-ghost" onClick={() => goTo('import')}>Import a file</button>
        <button className="btn btn-sm btn-ghost" onClick={() => goTo('transactions', UNCATEGORIZED)}>Categorize</button>
        <button className="btn btn-sm btn-ghost" onClick={() => goTo('budgets')}>Budgets and bills</button>
      </div>
    </div>
  )
}

function MoneyTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="table">
      <thead><tr>{head.map((h, i) => <th key={h} style={i ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'mono' : ''} style={i ? { textAlign: 'right' } : undefined}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}
