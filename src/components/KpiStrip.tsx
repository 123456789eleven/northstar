// KpiStrip: 2-5 glass KPI tiles. Items: {label, value, delta?, deltaTone?, trend?, note?, to?, hero?}. Phone: 2x2 (3 cells stay in one row).
// Values count up on first paint (CountUp) with tabular numerals; the cell never changes size while counting.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CountUp, TrendLine } from './ui'
import type { Trend } from './trend'

export interface KpiItem { label: string; value: ReactNode; delta?: string; deltaTone?: 'good' | 'warn' | 'neutral'; trend?: Trend; note?: ReactNode; to?: string; /** Aurora hero numeral (gradient text). At most one per screen. */ hero?: boolean }

export default function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-strip" data-n={items.length} style={{ ['--kpi-n' as string]: items.length }}>
      {items.map((it) => {
        const body = (
          <>
            <div className="kpi-label">{it.label}</div>
            <div className={`kpi-value ${it.hero ? 'grad-text' : ''}`}><CountUp value={it.value} /></div>
            {it.trend && <TrendLine trend={it.trend} />}
            {it.delta &&<div className={`kpi-delta kpi-${it.deltaTone ?? 'neutral'}`}>{it.delta}</div>}
            {it.note && <div className="kpi-note">{it.note}</div>}
          </>
        )
        return it.to ? <Link key={it.label} to={it.to} className="kpi-cell kpi-link">{body}</Link> : <div key={it.label} className="kpi-cell">{body}</div>
      })}
    </div>
  )
}
