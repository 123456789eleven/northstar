// Small shared view parts for the Markets tab.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { direction, fmtPct, rangePosition, tickDirection } from './view'

/** Flashes powder (up-tick) or poppy (down-tick) for 400 ms when the value changes. CSS removes the colour for reduced motion. */
export function Tick({ value, children }: { value: number | undefined; children: ReactNode }) {
  const prev = useRef(value)
  const [dir, setDir] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    const d = tickDirection(prev.current, value)
    prev.current = value
    if (!d) return
    setDir(d)
    const t = setTimeout(() => setDir(null), 400)
    return () => clearTimeout(t)
  }, [value])
  return <span className={`mkt-tick ${dir ? `tick-${dir}` : ''}`}>{children}</span>
}

export function Change({ pct }: { pct: number | undefined }) {
  return <span className={`mkt-${direction(pct)}`}>{fmtPct(pct)}</span>
}

/** A thin track with a marker at `value` within [low, high]. Decorative; the numbers are in the title and neighbours. */
export function RangeBar({ value, low, high, label }: { value?: number; low?: number; high?: number; label: string }) {
  const pos = rangePosition(value, low, high)
  if (pos === null) return <span className="mkt-range mkt-range-none" aria-label={`${label}: no data`} />
  return (
    <span className="mkt-range" role="img" aria-label={`${label}: ${Math.round(pos * 100)}% of the way from low to high`} title={`${low} to ${high}`}>
      <span className="mkt-range-fill" style={{ width: `${pos * 100}%` }} />
      <span className="mkt-range-mark" style={{ left: `${pos * 100}%` }} />
    </span>
  )
}

export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mkt-skel-list" aria-label="Loading" role="status">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="mkt-skel" />)}
    </div>
  )
}
