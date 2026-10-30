import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty } from '../../components/ui'
import ChartFrame from '../../components/ChartFrame'
import KpiStrip from '../../components/KpiStrip'
import { db } from '../../db'
import { money } from '../../lib/dates'
import { merchantLabel, UNCATEGORIZED } from './categories'
import { CategoryBars, TrendChart } from './charts'
import { TREND_LEGEND } from './series'
import { monthLabel, monthRange, pct, shiftMonth, summarize, topMerchants, useMonthTx } from './model'

export default function Overview({ month, goTo }: { month: string; goTo: (tab: 'transactions' | 'import' | 'budgets', category?: string) => void }) {
  const txs = useMonthTx(month)
  const budgets = useLiveQuery(() => db.budgets.toArray(), [])
  const first = shiftMonth(month, -5)
  const trendTx = useLiveQuery(() => db.transactions.where('date').between(monthRange(first)[0], monthRange(month)[1], true, true).toArray(), [first, month])
  const anyTx = useLiveQuery(() => db.transactions.count(), [])

  if (!txs || !budgets || !trendTx || anyTx === undefined) return null

  if (anyTx === 0) {
    return (
      <Card>
        <Empty>
          <p style={{ margin: '0 0 6px', color: 'var(--ink-2)' }}>No transactions yet.</p>
          <p style={{ margin: '0 0 14px' }}>Log into your bank's website, download your recent transactions as a CSV file, then import it here. Everything stays on this device.</p>
          <button className="btn btn-primary" onClick={() => goTo('import')}>
            Import a CSV
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
  const warnings = budgets
    .map((b) => ({ ...b, spent: s.byCategory.get(b.category) ?? 0 }))
    .filter((b) => b.monthlyLimit > 0 && b.spent / b.monthlyLimit > 0.9)
    .sort((a, b) => b.spent / b.monthlyLimit - a.spent / a.monthlyLimit)
  const uncategorized = txs.filter((t) => t.category === UNCATEGORIZED).length

  return (
    <div className="stack" style={{ gap: 16 }}>
      <KpiStrip
        items={[
          { label: 'Income', value: money(s.income) },
          { label: 'Spending', value: money(s.spending) },
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
        <Card title="Budget warnings">
          <div className="list">
            {warnings.map((w) => (
              <div key={w.category} className="list-item small">
                <span className="grow">{w.category}</span>
                <span className="mono muted">
                  {money(w.spent)} / {money(w.monthlyLimit)}
                </span>
                <span className={`mono ${w.spent > w.monthlyLimit ? 'warn' : ''}`} style={{ minWidth: 44, textAlign: 'right' }}>
                  {pct(w.spent / w.monthlyLimit)}
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
                  {money(v.total)}
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
