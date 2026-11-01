// Single-series column chart used by Food (week) and Learning (weekly minutes).
// Dataviz rules: one hue (data slot 1, blue; amber is UI only), <=24px columns with 4px rounded caps,
// hairline solid horizontal grid, per-column hover tooltip, optional target line,
// and a table view so values are never chart-only.
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ChartFrame from '../../components/ChartFrame'
import { CHART, GRID_PROPS, X_AXIS, Y_AXIS, tooltipProps } from '../../components/chartTheme'
import { ChartTip } from '../../components/ChartTip'
import './food.css'

// SVG presentation attributes don't resolve CSS custom properties reliably, so mirror the tokens here.
const C = { series: CHART.data[0], ink2: CHART.axis }

export interface BarDatum {
  key: string
  label: string
  /** Longer label for tooltip / table. */
  full?: string
  value: number
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
        <div style={{ width: '100%', height }} role="img" aria-label={`${title}: ${data.length} periods${target ? `, target ${target.toLocaleString()} ${unit}` : ''}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
              <CartesianGrid {...GRID_PROPS} />
              <XAxis {...X_AXIS} dataKey="label" interval="preserveStartEnd" minTickGap={4} />
              <YAxis
                {...Y_AXIS}
                width={max >= 1000 ? 46 : 34}
                allowDecimals={false}
                domain={[0, max === 0 ? 10 : 'auto']}
                tickFormatter={(v: number) => v.toLocaleString()}
              />
              <Tooltip {...tooltipProps(<ChartTip rows={(p) => { const d = p[0]?.payload as BarDatum | undefined; return d ? [{ key: d.key, value: `${d.value.toLocaleString()} ${unit}`, name: d.full ?? d.label }] : [] }} />, 'bar')} />
              {target ? (
                <ReferenceLine
                  y={target}
                  stroke={C.ink2}
                  strokeWidth={1}
                  ifOverflow="extendDomain"
                  label={{ value: 'Target', position: 'insideTopRight', fill: C.ink2, fontSize: 12 }}
                />
              ) : null}
              <Bar dataKey="value" fill={C.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
    </ChartFrame>
  )
}
