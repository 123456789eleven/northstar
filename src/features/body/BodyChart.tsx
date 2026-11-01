// Weight trend: faint daily points, one amber 7-day-average line, dashed goal line.
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../lib/dates'
import type { AvgPoint } from './model'
import { CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { ChartTip } from '../../components/ChartTip'

export const AMBER = CHART.accent
const AXIS = CHART.axis

const tipRows = (payload: { payload?: unknown }[]) => {
  const p = payload[0]?.payload as AvgPoint | undefined
  return p ? [
    { key: 'w', value: `${p.weight.toFixed(1)} lb`, name: 'weigh-in' },
    { key: 'a', value: `${p.avg.toFixed(1)} lb`, name: '7-day average', color: AMBER },
  ] : []
}

export default function BodyChart({ data, goal }: { data: AvgPoint[]; goal: number }) {
  const ws = data.flatMap((d) => [d.weight, d.avg])
  const lo = Math.floor(Math.min(...ws, goal) - 2)
  const hi = Math.ceil(Math.max(...ws, goal) + 2)
  return (
    <div style={{ width: '100%', height: 240 }} role="img" aria-label={`Weight trend, latest 7-day average ${data.at(-1)?.avg.toFixed(1)} pounds, goal ${goal} pounds`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={MARGIN}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="date" tickFormatter={(d: string) => formatDate(d)} minTickGap={36} />
          <YAxis {...Y_AXIS} domain={[lo, hi]} width={40} allowDecimals={false} />
          <Tooltip {...tooltipProps(<ChartTip rows={tipRows} labelFmt={(d) => formatDate(d, { month: 'short', day: 'numeric', year: 'numeric' })} />)} />
          <ReferenceLine y={goal} stroke={AXIS} strokeDasharray="5 4" label={{ value: `Goal ${goal}`, position: 'insideTopLeft', fill: AXIS, fontSize: 12 }} />
          <Line dataKey="weight" name="Weigh-in" stroke="none" dot={{ r: 2.5, fill: AMBER, fillOpacity: 0.35, stroke: 'none' }} activeDot={false} isAnimationActive={false} legendType="none" />
          <Line dataKey="avg" name="7-day average" stroke={AMBER} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: AMBER, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
