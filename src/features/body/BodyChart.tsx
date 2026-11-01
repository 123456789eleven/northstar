// Weight trend: faint daily points, one amber 7-day-average line, dashed goal line.
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../lib/dates'
import type { AvgPoint } from './model'

const GRID = '#262a33'
const AXIS = '#a6a49d'
export const AMBER = '#e3b261'

interface TipP { payload?: AvgPoint }

function Tip({ active, payload }: { active?: boolean; payload?: TipP[] }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="fin-tip">
      <div className="fin-tip-label">{formatDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      <div className="fin-tip-row"><strong className="mono">{p.weight.toFixed(1)} lb</strong><span className="muted">weigh-in</span></div>
      <div className="fin-tip-row"><strong className="mono">{p.avg.toFixed(1)} lb</strong><span className="muted">7-day average</span></div>
    </div>
  )
}

export default function BodyChart({ data, goal }: { data: AvgPoint[]; goal: number }) {
  const ws = data.flatMap((d) => [d.weight, d.avg])
  const lo = Math.floor(Math.min(...ws, goal) - 2)
  const hi = Math.ceil(Math.max(...ws, goal) + 2)
  return (
    <div style={{ width: '100%', height: 240 }} role="img" aria-label={`Weight trend, latest 7-day average ${data.at(-1)?.avg.toFixed(1)} pounds, goal ${goal} pounds`}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={(d: string) => formatDate(d)} minTickGap={36} />
          <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={40} unit="" allowDecimals={false} />
          <Tooltip content={<Tip />} isAnimationActive={false} cursor={{ stroke: GRID }} />
          <ReferenceLine y={goal} stroke={AXIS} strokeDasharray="5 4" label={{ value: `Goal ${goal}`, position: 'insideTopLeft', fill: AXIS, fontSize: 12 }} />
          <Line dataKey="weight" name="Weigh-in" stroke="none" dot={{ r: 2.5, fill: AMBER, fillOpacity: 0.35, stroke: 'none' }} activeDot={false} isAnimationActive={false} legendType="none" />
          <Line dataKey="avg" name="7-day average" stroke={AMBER} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
