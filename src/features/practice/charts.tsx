// Practice charts. Pure rows come from ledger.ts / calc.ts; this file only draws them.
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { ChartTip } from '../../components/ChartTip'
import { formatDate, money } from '../../lib/dates'
import type { EquityPoint } from './ledger'

import { compact } from './fmt'

const FAINT = '#6b7280'

export function EquityChart({ data, startCash }: { data: EquityPoint[]; startCash: number }) {
  const fmt = (d: string) => formatDate(d, { month: 'short', day: 'numeric' })
  const last = data[data.length - 1]
  const label = `Paper account equity over ${data.length} recorded days, from ${money(data[0].equity)} to ${money(last.equity)}. Start cash was ${money(startCash)}.`
  return (
    <div className="pr-plot pr-plot-sm" role="img" aria-label={label}>
      <ResponsiveContainer>
        <LineChart data={data} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="date" tickFormatter={fmt} minTickGap={32} />
          <YAxis {...Y_AXIS} tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`} width={72} domain={['auto', 'auto']} />
          <Tooltip {...tooltipProps(<ChartTip fmt={money} labelFmt={fmt} />)} />
          <Line type="stepAfter" dataKey="equity" name="Equity" stroke={CHART.accent} strokeWidth={2} dot={data.length <= 12} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BandChart({ rows, label }: { rows: { year: number; low: number; base: number; high: number }[]; label: string }) {
  return (
    <div className="pr-plot" role="img" aria-label={label}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="year" tickFormatter={(y: number) => `${y}y`} />
          <YAxis {...Y_AXIS} tickFormatter={compact} width={56} />
          <Tooltip {...tooltipProps(<ChartTip fmt={money} labelFmt={(l) => `Year ${l}`} />)} />
          <Line dataKey="high" name="High" stroke={CHART.axis} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          <Line dataKey="base" name="Middle" stroke={CHART.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          <Line dataKey="low" name="Low" stroke={FAINT} strokeDasharray="4 3" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SplitChart({ rows, label }: { rows: { year: number; contributed: number; growth: number }[]; label: string }) {
  return (
    <div className="pr-plot" role="img" aria-label={label}>
      <ResponsiveContainer>
        <AreaChart data={rows} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="year" tickFormatter={(y: number) => `${y}y`} />
          <YAxis {...Y_AXIS} tickFormatter={compact} width={56} />
          <Tooltip {...tooltipProps(<ChartTip fmt={money} labelFmt={(l) => `Year ${l}`} />)} />
          <Area dataKey="contributed" name="Contributions" stackId="a" stroke={FAINT} fill={FAINT} fillOpacity={0.45} isAnimationActive={false} />
          <Area dataKey="growth" name="Growth" stackId="a" stroke={CHART.accent} fill={CHART.accent} fillOpacity={0.6} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
