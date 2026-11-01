// The one tooltip body for every recharts chart (styles: .chart-tip in index.css). Theme props: chartTheme.ts.
import type { ReactNode } from 'react'

interface TipRow { name?: string | number; value?: unknown; color?: string; stroke?: string; fill?: string; payload?: unknown }

/**
 * The one tooltip body. `fmt` formats each value, `labelFmt` the x label. `rows` overrides the default payload rows
 * (for charts whose tooltip shows derived fields).
 */
export function ChartTip({ active, payload, label, fmt, labelFmt, rows }: {
  active?: boolean; payload?: TipRow[]; label?: string | number
  fmt?: (v: number, name: string) => ReactNode; labelFmt?: (l: string) => ReactNode
  rows?: (payload: TipRow[]) => { key: string; value: ReactNode; name?: ReactNode; color?: string }[]
}) {
  if (!active || !payload?.length) return null
  const list = rows
    ? rows(payload)
    : payload
        .filter((p) => p.value != null && p.value !== '')
        .map((p) => ({ key: String(p.name), value: fmt ? fmt(Number(p.value), String(p.name)) : String(p.value), name: p.name, color: p.color ?? p.stroke ?? p.fill }))
  return (
    <div className="chart-tip">
      {label != null && label !== '' && <div className="chart-tip-label">{labelFmt ? labelFmt(String(label)) : label}</div>}
      {list.map((r) => (
        <div key={r.key} className="chart-tip-row">
          {r.color && <span className="chart-tip-key" style={{ background: r.color }} aria-hidden />}
          <strong>{r.value}</strong>
          {r.name != null && <span className="muted">{r.name}</span>}
        </div>
      ))}
    </div>
  )
}
