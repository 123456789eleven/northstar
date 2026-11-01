// One recharts theme for the whole app. Spread these props instead of hand-writing colors per chart:
//   <CartesianGrid {...GRID_PROPS} />  <XAxis {...X_AXIS} dataKey=.. />  <YAxis {...Y_AXIS} />
//   <Tooltip {...tooltipProps(<ChartTip fmt={money} />, 'bar')} />  (ChartTip lives in ChartTip.tsx)  dots: DOT(color) / ACTIVE_DOT(color)
// SVG presentation attributes cannot read CSS variables reliably, so the token values are mirrored here (index.css :root).
// Series colors are data, not chrome: data palette slots (--data-1..6); amber appears only where a module already chose it.
import type { ReactElement } from 'react'

export const CHART = {
  grid: '#262a33', // --line
  axis: '#a6a49d', // --ink-2 (AA on --surface)
  surface: '#15171c', // --surface (dot rings, gaps between fills)
  cursorFill: 'rgba(255, 255, 255, 0.04)',
  accent: '#e3b261', // --accent
  data: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'], // --data-1..6
} as const

const TICK = { fill: CHART.axis, fontSize: 12 }

export const GRID_PROPS = { vertical: false, stroke: CHART.grid, strokeWidth: 1 } as const
export const X_AXIS = { tickLine: false, axisLine: { stroke: CHART.grid }, tick: TICK, tickMargin: 6 } as const
export const Y_AXIS = { tickLine: false, axisLine: false, tick: TICK, tickMargin: 4 } as const
export const MARGIN = { top: 8, right: 8, left: 0, bottom: 0 } as const
export const DOT = (color: string, r = 3) => ({ r, fill: color, stroke: CHART.surface, strokeWidth: 2 })
export const ACTIVE_DOT = (color: string) => ({ r: 5, fill: color, stroke: CHART.surface, strokeWidth: 2 })

/** Tooltip props: shared cursor (line for line charts, soft band for bars), no tooltip animation, custom content. */
export function tooltipProps(content: ReactElement, kind: 'line' | 'bar' = 'line') {
  return {
    content,
    isAnimationActive: false,
    cursor: kind === 'bar' ? { fill: CHART.cursorFill } : { stroke: CHART.axis, strokeWidth: 1, strokeDasharray: '3 3' },
    wrapperStyle: { outline: 'none' },
  }
}
