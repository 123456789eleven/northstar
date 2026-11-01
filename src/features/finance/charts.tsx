// Finance charts. Palette: dataviz categorical slots 1–2 stepped for dark (validated against --surface #15171c):
// income = blue, spending = orange. Single-series charts use slot 1 (blue). Amber stays the UI accent, not a series color.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, money } from '../../lib/dates'
import { ACTIVE_DOT, DOT, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { ChartTip } from '../../components/ChartTip'
import { compactMoney } from './model'
import { SERIES } from './series'

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={i.line ? 'legend-line' : 'legend-sw'} style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

export function TrendChart({ data }: { data: { label: string; income: number; spending: number }[] }) {
  return (
    <>
      <div style={{ width: '100%', height: 220 }} role="img" aria-label={`Income and spending for the last ${data.length} months`}>
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis {...X_AXIS} dataKey="label" />
            <YAxis {...Y_AXIS} tickFormatter={(v: number) => compactMoney(v)} width={56} />
            <Tooltip {...tooltipProps(<ChartTip fmt={money} />, 'bar')} />
            <Bar dataKey="income" name="Income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="spending" name="Spending" fill={SERIES.spending} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function NetWorthChart({ data }: { data: { date: string; net: number }[] }) {
  const fmt = (d: string) => formatDate(d, { month: 'short', day: 'numeric', year: '2-digit' })
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="date" tickFormatter={fmt} minTickGap={24} />
          <YAxis {...Y_AXIS} tickFormatter={(v: number) => compactMoney(v)} width={60} domain={['auto', 'auto']} />
          <Tooltip {...tooltipProps(<ChartTip fmt={money} labelFmt={fmt} />)} />
          <Line
            type="monotone"
            dataKey="net"
            name="Net worth"
            stroke={SERIES.net}
            strokeWidth={2}
            dot={data.length <= 24 ? DOT(SERIES.net, 4) : false}
            activeDot={ACTIVE_DOT(SERIES.net)}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Horizontal bars as plain HTML: each row is label + value, so the list doubles as the table view. */
export function CategoryBars({ rows, onPick }: { rows: { category: string; amount: number }[]; onPick?: (c: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  return (
    <div className="fin-hbars">
      {rows.map((r) => (
        <button key={r.category} type="button" className="fin-hbar" onClick={() => onPick?.(r.category)} title={`${r.category}: ${money(r.amount)}`}>
          <span className="fin-hbar-label">{r.category}</span>
          <span className="fin-hbar-track">
            <span className="fin-hbar-fill" style={{ width: `${Math.max(1.5, (r.amount / max) * 100)}%`, background: SERIES.bars }} />
          </span>
          <span className="fin-hbar-value mono">{money(r.amount)}</span>
        </button>
      ))}
    </div>
  )
}
