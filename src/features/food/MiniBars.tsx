// Single-series column chart used by Food (week) and Learning (weekly minutes).
// Dataviz rules: one hue (data slot 1, blue; amber is UI only), <=24px columns with 4px rounded caps,
// hairline solid horizontal grid, per-column hover tooltip, optional target line,
// and a table view so values are never chart-only.
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartFrame from '../../components/ChartFrame'
import './food.css'

// SVG presentation attributes don't resolve CSS custom properties reliably, so mirror the tokens here.
const C = { series: '#3987e5', grid: '#262a33', ink2: '#a6a49d', ink3: '#a6a49d', cursor: '#1c1f26' }

export interface BarDatum {
  key: string
  label: string
  /** Longer label for tooltip / table. */
  full?: string
  value: number
}

interface TipProps {
  active?: boolean
  payload?: { payload: BarDatum }[]
  unit: string
}

function Tip({ active, payload, unit }: TipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="ns-tip">
      <div className="faint tiny">{d.full ?? d.label}</div>
      <div className="mono">
        {d.value.toLocaleString()} {unit}
      </div>
    </div>
  )
}

export default function MiniBars({
  title,
  data,
  unit,
  target,
  height = 180,
}: {
  title: string
  data: BarDatum[]
  unit: string
  target?: number
  height?: number
}) {
  const max = Math.max(0, ...data.map((d) => d.value), target ?? 0)
  return (
    <ChartFrame
      title={title}
      hasData={data.some((d) => d.value > 0)}
      table={
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>{unit}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key}>
                  <td>{d.full ?? d.label}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {d.value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={C.grid} strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: C.grid }} tick={{ fill: C.ink3, fontSize: 11 }} interval="preserveStartEnd" minTickGap={4} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: C.ink3, fontSize: 11 }}
                width={max >= 1000 ? 46 : 34}
                allowDecimals={false}
                domain={[0, max === 0 ? 10 : 'auto']}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip cursor={{ fill: C.cursor }} content={<Tip unit={unit} />} isAnimationActive={false} />
              {target ? (
                <ReferenceLine
                  y={target}
                  stroke={C.ink2}
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={{ value: 'Target', position: 'insideTopRight', fill: C.ink2, fontSize: 11 }}
                />
              ) : null}
              <Bar dataKey="value" fill={C.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
    </ChartFrame>
  )
}
