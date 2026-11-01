// KpiStrip: one bordered bar of 2-5 cells. Items: {label, value, delta?, deltaTone?, note?, to?}. Phone: 2x2 (3 cells stay in one row).
// Values count up on first paint (CountUp) with tabular numerals; the cell never changes size while counting.
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CountUp } from './ui'

export interface KpiItem { label: string; value: ReactNode; delta?: string; deltaTone?: 'good' | 'warn' | 'neutral'; note?: ReactNode; to?: string }

export default function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-strip" data-n={items.length} style={{ ['--kpi-n' as string]: items.length }}>
      {items.map((it) => {
        const body = (
          <>
            <div className="kpi-label">{it.label}</div>
            <div className="kpi-value"><CountUp value={it.value} /></div>
            {it.delta && <div className={`kpi-delta kpi-${it.deltaTone ?? 'neutral'}`}>{it.delta}</div>}
            {it.note && <div className="kpi-note">{it.note}</div>}
          </>
        )
        return it.to ? <Link key={it.label} to={it.to} className="kpi-cell kpi-link">{body}</Link> : <div key={it.label} className="kpi-cell">{body}</div>
      })}
    </div>
  )
}
