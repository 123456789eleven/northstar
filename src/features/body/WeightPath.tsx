// WEIGHT PATH: the 7-day average line, a ghost line to the target date at the healthy rate, and a flag at every +5 lb checkpoint.
// Flags light up (gold, the reward hue) only once crossed; the next flag says how many lb are left.
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartTip } from '../../components/ChartTip'
import { CHART, GRID_PROPS, MARGIN, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { formatDate, parseISODate } from '../../lib/dates'
import type { AvgPoint } from './model'
import type { CheckpointFlag, GhostLine } from './pathModel'

const REWARD = '#f2c46b' // --reward
const MUTED = CHART.axis
const t = (d: string) => parseISODate(d).getTime()
const iso = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Row { x: number; date: string; weight?: number; avg?: number; ghost?: number }

const flagText = (f: CheckpointFlag) => (f.reached ? `${f.target} lb` : f.next ? `${f.target} lb, ${f.lbToGo.toFixed(1)} to go` : `${f.target} lb`)

export default function WeightPath({ data, flags, ghost, goal }: { data: AvgPoint[]; flags: CheckpointFlag[]; ghost: GhostLine; goal: number }) {
  const rows: Row[] = data.map((d) => ({ x: t(d.date), date: d.date, weight: d.weight, avg: d.avg }))
  // Keep the ghost line within a readable horizon so a far-off goal does not squash the real data.
  const lastX = rows.length ? rows[rows.length - 1].x : t(ghost.points[0]?.date ?? '2026-01-01')
  const spanDays = rows.length > 1 ? (lastX - rows[0].x) / 86400000 : 0
  const horizon = lastX + Math.max(21, spanDays * 0.4) * 86400000
  const g0 = ghost.points[0]
  const g1 = ghost.points[1]
  const ghostPts = g0 && g1 && t(g1.date) > horizon
    ? [g0, { date: iso(horizon), ghost: g0.ghost + ((g1.ghost - g0.ghost) * (horizon - t(g0.date))) / (t(g1.date) - t(g0.date)) }]
    : ghost.points
  for (const g of ghostPts) {
    const x = t(g.date)
    const hit = rows.find((r) => r.x === x)
    if (hit) hit.ghost = g.ghost
    else rows.push({ x, date: g.date, ghost: g.ghost })
  }
  rows.sort((a, b) => a.x - b.x)
  const vals = rows.flatMap((r) => [r.weight, r.avg, r.ghost].filter((v): v is number => v != null))
  const nextFlag = flags.find((f) => f.next)
  const lo = Math.floor(Math.min(...vals, ...flags.filter((f) => f.reached).slice(-1).map((f) => f.target)) - 1)
  const hi = Math.ceil(Math.max(...vals, nextFlag?.target ?? goal) + 1)
  const last = data.at(-1)
  const crossed = flags.filter((f) => f.reached).length

  return (
    <div className="wpath" role="img" aria-label={`Weight path: latest 7-day average ${last?.avg.toFixed(1)} pounds, ${crossed} of ${flags.length} checkpoints crossed${nextFlag ? `, next ${nextFlag.target} pounds, ${nextFlag.lbToGo.toFixed(1)} to go` : ''}`}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ ...MARGIN, right: 12 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis {...X_AXIS} dataKey="x" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => formatDate(iso(v))} minTickGap={36} />
          <YAxis {...Y_AXIS} domain={[lo, hi]} width={40} allowDecimals={false} />
          <Tooltip
            {...tooltipProps(
              <ChartTip
                labelFmt={(v) => formatDate(iso(Number(v)), { month: 'short', day: 'numeric', year: 'numeric' })}
                rows={(payload) => {
                  const p = payload[0]?.payload as Row | undefined
                  if (!p) return []
                  const out: { key: string; value: string; name: string; color?: string }[] = []
                  if (p.weight != null) out.push({ key: 'w', value: `${p.weight.toFixed(1)} lb`, name: 'weigh-in' })
                  if (p.avg != null) out.push({ key: 'a', value: `${p.avg.toFixed(1)} lb`, name: '7-day average', color: CHART.accent })
                  if (p.ghost != null) out.push({ key: 'g', value: `${p.ghost.toFixed(1)} lb`, name: 'healthy pace', color: MUTED })
                  return out
                }}
              />,
            )}
          />
          {flags.map((f) => (
            <ReferenceLine
              key={f.target}
              y={f.target}
              ifOverflow="hidden"
              stroke={f.reached ? REWARD : MUTED}
              strokeOpacity={f.reached ? 0.9 : f.next ? 0.8 : 0.35}
              strokeDasharray={f.reached ? undefined : '4 4'}
              label={{ value: flagText(f), position: 'insideTopLeft', fill: f.reached ? REWARD : MUTED, fontSize: 12 }}
            />
          ))}
          <Line dataKey="weight" name="Weigh-in" stroke="none" dot={{ r: 2.5, fill: CHART.accent, fillOpacity: 0.35, stroke: 'none' }} activeDot={false} isAnimationActive={false} legendType="none" connectNulls />
          <Line dataKey="ghost" name="Healthy pace" stroke={MUTED} strokeWidth={2} strokeDasharray="2 5" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} connectNulls />
          <Line dataKey="avg" name="7-day average" stroke={CHART.accent} strokeWidth={2.75} dot={false} activeDot={{ r: 4, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
