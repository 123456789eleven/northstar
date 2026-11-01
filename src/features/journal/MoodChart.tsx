// Mood over 90 days. Single series, dataviz slot 1 (blue); amber stays the UI accent.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../lib/dates'
import type { MoodPoint } from './stats'
import { ACTIVE_DOT, CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { ChartTip } from '../../components/ChartTip'

const SERIES = CHART.data[0]

export function MoodChart({ data }: { data: MoodPoint[] }) {
  const fmt = (d: string) => formatDate(d, { month: 'short', day: 'numeric' })
  return (
    <div style={{ width: '100%', height: 180 }} role="img" aria-label={`Mood over the last 90 days, ${data.filter((d) => d.mood != null).length} days rated`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="date" tickFormatter={fmt} minTickGap={36} />
          <YAxis {...Y_AXIS} domain={[1, 5]} ticks={[1, 3, 5]} width={24} />
          <Tooltip {...tooltipProps(<ChartTip labelFmt={fmt} fmt={(v) => `${v} / 5`} />)} />
          <Line type="monotoneX" dataKey="mood" name="Mood" stroke={SERIES} strokeWidth={2} connectNulls dot={false} activeDot={ACTIVE_DOT(SERIES)} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
