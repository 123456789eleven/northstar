// Mood over 90 days. Single series, dataviz slot 1 (blue); amber stays the UI accent.
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../lib/dates'
import type { MoodPoint } from './stats'

const SERIES = '#3987e5'
const GRID = '#262a33'
const AXIS = '#a6a49d'

export function MoodChart({ data }: { data: MoodPoint[] }) {
  const fmt = (d: string) => formatDate(d, { month: 'short', day: 'numeric' })
  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} tickFormatter={fmt} minTickGap={36} />
          <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={24} />
          <Tooltip
            isAnimationActive={false}
            cursor={{ stroke: AXIS, strokeWidth: 1 }}
            contentStyle={{ background: '#1c1f26', border: '1px solid #262a33', borderRadius: 6, fontSize: 12 }}
            labelFormatter={(l) => fmt(String(l))}
            formatter={(v) => [String(v), 'Mood']}
          />
          <Line type="monotone" dataKey="mood" stroke={SERIES} strokeWidth={2} connectNulls dot={false} activeDot={{ r: 4, fill: SERIES, stroke: '#15171c', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
