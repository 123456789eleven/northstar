// Finance charts. Palette: dataviz categorical slots 1–2 stepped for dark (validated against --surface #15171c):
// income = blue, spending = orange. Single-series charts use slot 1 (blue). Amber stays the UI accent, not a series color.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate, money } from '../../lib/dates'
import { compactMoney } from './model'

const SERIES = { income: '#3987e5', spending: '#d95926', net: '#3987e5', bars: '#3987e5' }
const GRID = '#262a33'
const AXIS = '#a6a49d'

interface TipRow {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number | ((obj: unknown) => unknown)
}

function ChartTip({ active, payload, label, labelFmt }: { active?: boolean; payload?: TipRow[]; label?: string | number; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="fin-tip">
      <div className="fin-tip-label">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.name)} className="fin-tip-row">
          <span className="fin-tip-key" style={{ background: p.color }} />
          <strong className="mono">{money(Number(p.value))}</strong>
          <span className="muted">{p.name}</span>
        </div>
      ))}
    </div>
  )
}

export const TREND_LEGEND = [{ label: 'Income', color: SERIES.income }, { label: 'Spending', color: SERIES.spending }]

export function Legend({ items }: { items: { label: string; color: string; line?: boolean }[] }) {
  return (
    <div className="fin-legend">
      {items.map((i) => (
        <span key={i.label} className="row" style={{ gap: 6 }}>
          <span className={i.line ? 'fin-legend-line' : 'fin-legend-box'} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function TrendChart({ data }: { data: { label: string; income: number; spending: number }[] }) {
  return (
    <>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: number) => compactMoney(v)} width={56} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTip />} isAnimationActive={false} />
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
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={fmt} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(v: number) => compactMoney(v)} width={60} domain={['auto', 'auto']} />
          <Tooltip cursor={{ stroke: AXIS, strokeWidth: 1 }} content={<ChartTip labelFmt={fmt} />} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="net"
            name="Net worth"
            stroke={SERIES.net}
            strokeWidth={2}
            dot={data.length <= 24 ? { r: 4, fill: SERIES.net, stroke: '#15171c', strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: SERIES.net, stroke: '#15171c', strokeWidth: 2 }}
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
