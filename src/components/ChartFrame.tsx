// ChartFrame: card with title, optional controls row, legend (2+ series), plot, optional table view, in-frame empty state.
// props: title, controls?, legend?: {label,color}[], hasData (default true), table? (ReactNode for the "Table view" toggle), children = plot.
import { useState, type ReactNode } from 'react'

export default function ChartFrame({ title, controls, legend, hasData = true, table, children }: { title: string; controls?: ReactNode; legend?: { label: string; color: string }[]; hasData?: boolean; table?: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card chart-frame">
      <div className="card-title">
        <span>{title}</span>
        {table && hasData && <button className="btn btn-ghost btn-sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? 'Chart view' : 'Table view'}</button>}
      </div>
      {controls && <div className="row wrap" style={{ marginBottom: 8 }}>{controls}</div>}
      {legend && legend.length > 1 && (
        <ul className="legend">
          {legend.map((l) => <li key={l.label}><span className="legend-sw" style={{ background: l.color }} aria-hidden />{l.label}</li>)}
        </ul>
      )}
      <div className="chart-plot">{!hasData ? <div className="empty">No data for this range.</div> : asTable && table ? table : children}</div>
    </section>
  )
}
