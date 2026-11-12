// Where the money went (Archive > More): spending by category for the month, top merchants, income and spending over 6 months.
import { useLiveQuery } from 'dexie-react-hooks'
import ChartFrame from '../../components/ChartFrame'
import { db } from '../../db'
import { money } from '../../lib/dates'
import { merchantLabel } from '../finance/categories'
import { CategoryBars, TrendChart } from '../finance/charts'
import { monthLabel, monthRange, moneyExact, shiftMonth, summarize, topMerchants } from '../finance/model'
import { TREND_LEGEND } from '../finance/series'

function MoneyTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="table">
      <thead><tr>{head.map((h, i) => <th key={h} style={i ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className={i ? 'mono' : ''} style={i ? { textAlign: 'right' } : undefined}>{c}</td>)}</tr>)}</tbody>
    </table>
  )
}

export function SpendingDetail({ month, onPick }: { month: string; onPick: (category: string) => void }) {
  const first = shiftMonth(month, -5)
  const trendTx = useLiveQuery(() => db.transactions.where('date').between(monthRange(first)[0], monthRange(month)[1], true, true).toArray(), [first, month])
  if (!trendTx) return null
  const txs = trendTx.filter((x) => x.date.startsWith(month))
  const s = summarize(txs)
  const cats = [...s.byCategory.entries()].filter(([, v]) => v > 0.005).sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount }))
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(first, i)
    const sm = summarize(trendTx.filter((x) => x.date.startsWith(m)))
    return { label: monthLabel(m, true), income: Math.round(sm.income), spending: Math.round(Math.max(0, sm.spending)) }
  })
  const merchants = topMerchants(txs)
  return (
    <div className="stack">
      <ChartFrame
        title={`By category, ${monthLabel(month, true)}`}
        empty="Nothing spent this month."
        hasData={cats.length > 0}
        table={<MoneyTable head={['Category', 'Spent']} rows={cats.map((c) => [c.category, money(c.amount)])} />}
      >
        <CategoryBars rows={cats} onPick={onPick} />
      </ChartFrame>
      <section aria-label="Top merchants">
        <h3 className="wl-h">Top merchants</h3>
        {merchants.length ? (
          <ul className="bk-list">
            {merchants.map(([k, v]) => (
              <li key={k} className="bk-li small">
                <span className="bk-li-main"><span>{merchantLabel(k)}</span><span className="bk-li-sub">{v.count} {v.count === 1 ? 'purchase' : 'purchases'}</span></span>
                <span className="bk-li-end">{moneyExact(v.total)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="small muted">No purchases this month.</p>}
      </section>
      <ChartFrame
        title="Income and spending, 6 months"
        legend={TREND_LEGEND}
        hasData={trend.some((x) => x.income > 0 || x.spending > 0)}
        table={<MoneyTable head={['Month', 'Income', 'Spending']} rows={trend.map((x) => [x.label, money(x.income), money(x.spending)])} />}
      >
        <TrendChart data={trend} />
      </ChartFrame>
    </div>
  )
}
