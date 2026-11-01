// ChartFrame: card with title, optional sub line, controls row, legend (2+ series), plot, optional table view, in-frame empty state.
// props: title, sub?, controls?, legend?: {label,color,line?}[], hasData (default true), empty? (message), table? (ReactNode for the
// "Table view" toggle), children = plot. Plot internals use the shared theme in chartTheme.tsx (grid, axes, tooltip, dots).
import { useState, type ReactNode } from 'react'

export default function ChartFrame({ title, sub, controls, legend, hasData = true, empty, table, children }: {
  title: string; sub?: ReactNode; controls?: ReactNode; legend?: { label: string; color: string; line?: boolean }[]
  hasData?: boolean; empty?: ReactNode; table?: ReactNode; children: ReactNode
}) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card chart-frame">
      <div className="card-title">
        <span>{title}</span>
        {table && hasData && <button className="btn btn-ghost btn-sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? 'Chart view' : 'Table view'}</button>}
      </div>
      {sub && <div className="chart-sub">{sub}</div>}
      {controls && <div className="row wrap" style={{ marginBottom: 8 }}>{controls}</div>}
      {legend && legend.length > 1 && hasData && !asTable && (
        <ul className="legend">
          {legend.map((l) => <li key={l.label}><span className={l.line ? 'legend-line' : 'legend-sw'} style={{ background: l.color }} aria-hidden />{l.label}</li>)}
        </ul>
      )}
      <div className="chart-plot">{!hasData ? <div className="empty">{empty ?? 'No data for this range.'}</div> : asTable && table ? <div key="table">{table}</div> : <div key="chart">{children}</div>}</div>
    </section>
  )
}
