import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import KpiStrip from '../../components/KpiStrip'
import { db } from '../../db'
import { formatDate, money, today } from '../../lib/dates'
import { useMemo } from 'react'
import { budgetSpend, cadenceText } from './bills'
import { useBills } from './billsData'
import { detectRecurring, monthlyTotal } from './recurring'
import { merchantLabel, UNCATEGORIZED } from './categories'
import { CategoryBars, TrendChart } from './charts'
import { TREND_LEGEND } from './series'
import { monthLabel, monthRange, moneyExact, pct, shiftMonth, summarize, topMerchants, useMonthTx } from './model'

export default function Overview({ month, goTo }: { month: string; goTo: (tab: 'transactions' | 'import' | 'budgets', category?: string) => void }) {
  const txs = useMonthTx(month)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const first = shiftMonth(month, -5)
  const trendTx = useLiveQuery(() => db.transactions.where('date').between(monthRange(first)[0], monthRange(month)[1], true, true).toArray(), [first, month])
  const bills = useBills()
  const anyTx = useLiveQuery(() => db.transactions.count(), [])

  const allTx = useLiveQuery(() => db.transactions.toArray(), [])
  const recurring = useMemo(() => (allTx ? detectRecurring(allTx, today()) : []), [allTx])

  if (!txs || !budgets || !trendTx || anyTx === undefined || !bills) return null

  if (anyTx === 0) {
    return (
      <Card>
        <Empty>
          <p style={{ margin: '0 0 6px', color: 'var(--ink-2)' }}>No transactions yet.</p>
          <p style={{ margin: '0 0 14px' }}>Log into your bank's website, download your recent transactions (OFX/QFX preferred, CSV works too), then import the file here. Everything stays on this device.</p>
          <button className="btn btn-primary" onClick={() => goTo('import')}>
            Import a file
          </button>
        </Empty>
      </Card>
    )
  }

  const s = summarize(txs)
  const cats = [...s.byCategory.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }))
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(first, i)
    const sm = summarize(trendTx.filter((t) => t.date.startsWith(m)))
    return { label: monthLabel(m, true), income: Math.round(sm.income), spending: Math.round(Math.max(0, sm.spending)) }
  })
  const merchants = topMerchants(txs)
  const bs = budgetSpend(txs, bills)
  const warnings = budgets
    .map((b) => ({ ...b, spent: bs.spent.get(b.category) ?? 0, bill: bs.billInfo.get(b.category) }))
    .filter((b) => b.monthlyLimit > 0 && b.spent / b.monthlyLimit > 0.9)
    .sort((a, b) => b.spent / b.monthlyLimit - a.spent / a.monthlyLimit)
  const budgeted = budgets.filter((b) => b.monthlyLimit > 0)
  const budgetLeft = budgeted.reduce((sum, b) => sum + b.monthlyLimit - Math.max(0, bs.spent.get(b.category) ?? 0), 0)
  const budgetNote = budgeted.length ? (budgetLeft >= 0 ? `${money(budgetLeft)} left in budgets` : `${money(-budgetLeft)} over budgets`) : undefined
  const uncategorized = txs.filter((t) => t.category === UNCATEGORIZED).length

  return (
    <div className="stack" style={{ gap: 16 }}>
      <KpiStrip
        items={[
          { label: 'Income', value: money(s.income) },
          { label: 'Spending', value: money(s.spending), note: budgetNote },
          { label: 'Net', value: <span className={s.net >= 0 ? '' : 'warn'}>{money(s.net)}</span> },
          { label: 'Savings rate', value: s.savingsRate === null ? '—' : pct(s.savingsRate), note: s.savingsRate === null ? 'No income this month' : 'Net ÷ income' },
        ]}
      />

      {uncategorized > 0 && (
        <div className="card row-between wrap">
          <span className="small">
            <strong>{uncategorized}</strong> <span className="muted">transaction{uncategorized === 1 ? '' : 's'} this month need a category.</span>
          </span>
          <button className="btn btn-sm" onClick={() => goTo('transactions', UNCATEGORIZED)}>
            Categorize
          </button>
        </div>
      )}

      {warnings.length > 0 && (
        <Card title="Budgets near or over limit" action={<button className="btn btn-ghost btn-sm" onClick={() => goTo('budgets')}>All budgets</button>}>
          <div className="list">
            {warnings.map((w) => (
              <div key={w.category} className="list-item small">
                <span className="grow">
                  {w.category}
                  {w.bill && <span className="tiny faint"> · Bill: {money(w.bill.monthly)}/mo set aside (paid {w.bill.bills.map((b) => cadenceText(b, money)).join(' + ')})</span>}
                </span>
                <span className="mono muted">
                  {moneyExact(w.spent)} of {moneyExact(w.monthlyLimit)}
                </span>
                <span className={`mono ${w.spent > w.monthlyLimit ? 'warn' : ''}`} style={{ minWidth: 92, textAlign: 'right' }}>
                  {w.spent > w.monthlyLimit ? `${moneyExact(w.spent - w.monthlyLimit)} over` : `${moneyExact(w.monthlyLimit - w.spent)} left`}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-2">
        <ChartFrame
          title={`Spending by category · ${monthLabel(month, true)}`}
          hasData={cats.length > 0}
          table={<MoneyTable head={['Category', 'Spent']} rows={cats.map((c) => [c.category, money(c.amount)])} />}
        >
          <CategoryBars rows={cats} onPick={(c) => goTo('transactions', c)} />
        </ChartFrame>
        <ChartFrame
          title="Income vs spending · 6 months"
          legend={TREND_LEGEND}
          hasData={trend.some((t) => t.income > 0 || t.spending > 0)}
          table={<MoneyTable head={['Month', 'Income', 'Spending']} rows={trend.map((t) => [t.label, money(t.income), money(t.spending)])} />}
        >
          <TrendChart data={trend} />
        </ChartFrame>
      </div>

      {recurring.length > 0 && (
        <Card title="Recurring and subscriptions" action={<span className="mono small muted">{moneyExact(monthlyTotal(recurring))} / month</span>}>
          <div className="list">
            {recurring.map((r) => (
              <div key={`${r.merchant}-${r.amount}`} className="list-item small fin-rec">
                <span className="grow">
                  {merchantLabel(r.merchant)}
                  <span className="tiny faint"> · {r.cadence} · last {formatDate(r.last)} · next ~{formatDate(r.next)}</span>
                </span>
                <span className="mono" style={{ minWidth: 80, textAlign: 'right' }}>{moneyExact(r.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Top merchants">
        {merchants.length ? (
          <div className="list">
            {merchants.map(([k, v]) => (
              <div key={k} className="list-item small">
                <span className="grow">{merchantLabel(k)}</span>
                <span className="faint tiny">
                  {v.count} {v.count === 1 ? 'purchase' : 'purchases'}
                </span>
                <span className="mono" style={{ minWidth: 80, textAlign: 'right' }}>
                  {moneyExact(v.total)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No purchases this month.</Empty>
        )}
      </Card>
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
