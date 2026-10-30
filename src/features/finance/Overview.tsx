import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, Stat } from '../../components/ui'
import { db } from '../../db'
import { money } from '../../lib/dates'
import { merchantLabel, UNCATEGORIZED } from './categories'
import { CategoryBars, TrendChart } from './charts'
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
      <div className="grid grid-4">
        <Stat label="Income" value={money(s.income)} />
        <Stat label="Spending" value={money(s.spending)} />
        <Stat label="Net" value={<span className={s.net >= 0 ? '' : 'warn'}>{money(s.net)}</span>} />
        <Stat label="Savings rate" value={s.savingsRate === null ? '—' : pct(s.savingsRate)} note={s.savingsRate === null ? 'No income recorded this month' : 'Net ÷ income'} />
      </div>

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
        <Card title={`Spending by category · ${monthLabel(month, true)}`}>
          {cats.length ? <CategoryBars rows={cats} onPick={(c) => goTo('transactions', c)} /> : <Empty>No spending recorded in {monthLabel(month)}.</Empty>}
        </Card>
        <Card title="Income vs spending · 6 months">
          <TrendChart data={trend} />
        </Card>
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
