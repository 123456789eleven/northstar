// Pure helpers for the Stat / KpiStrip trend line. The caller supplies a numeric delta (already computed) and which
// direction is good for the owner (spending down is good, weight up is good); color is derived here, never by the caller.
export type GoodDirection = 'up' | 'down' | 'neutral'
export interface Trend { delta: number; unit?: '%' | string; goodDirection?: GoodDirection; label?: string }
export type TrendDir = 'up' | 'down' | 'flat'
export type TrendTone = 'good' | 'warn' | 'neutral'

export const TREND_CAP = 999

/** Percent change from prev to cur. Null when there is nothing to compare (missing, non-finite, or prev is 0). Uses |prev| so a negative base still reads right. */
export function percentChange(cur: number | null | undefined, prev: number | null | undefined): number | null {
  if (cur == null || prev == null || !Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null
  return ((cur - prev) / Math.abs(prev)) * 100
}

function digitsFor(abs: number, unit: string): number {
  if (unit === '%') return abs < 10 ? 1 : 0
  return Number.isInteger(abs) ? 0 : 1
}

function rounded(delta: number, unit: string): number {
  const abs = Math.min(Math.abs(delta), unit === '%' ? TREND_CAP : Infinity)
  return Number(abs.toFixed(digitsFor(abs, unit)))
}

/** up / down / flat after display rounding, so "+0.0%" is flat, not an up arrow. */
export function trendDirection(delta: number, unit = '%'): TrendDir {
  if (!Number.isFinite(delta) || rounded(delta, unit) === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

export function trendTone(dir: TrendDir, good: GoodDirection = 'neutral'): TrendTone {
  if (dir === 'flat' || good === 'neutral') return 'neutral'
  return dir === good ? 'good' : 'warn'
}

/** "+4.2%", "−12%", "0%", "+999%" (capped), "+0.6 lb". Unit other than % is appended as given (include a leading space if you want one). */
export function formatDelta(delta: number, unit = '%'): string {
  if (!Number.isFinite(delta)) return ''
  const dir = trendDirection(delta, unit)
  const abs = Math.min(Math.abs(delta), unit === '%' ? TREND_CAP : Infinity)
  const body = abs.toFixed(digitsFor(abs, unit))
  const capped = unit === '%' && Math.abs(delta) > TREND_CAP
  const sign = dir === 'up' ? '+' : dir === 'down' ? '−' : ''
  return `${sign}${dir === 'flat' ? '0' : body}${unit}${capped ? '+' : ''}`
}

/** Screen-reader text: "up 4.2 percent versus last month". */
export function trendAria(t: Trend): string {
  const unit = t.unit ?? '%'
  const dir = trendDirection(t.delta, unit)
  const word = unit === '%' ? 'percent' : unit.trim()
  const vs = t.label ? ` ${t.label.replace(/^vs\.?\s+/i, 'versus ')}` : ''
  if (dir === 'flat') return `no change${vs}`
  const abs = Math.min(Math.abs(t.delta), unit === '%' ? TREND_CAP : Infinity)
  const over = unit === '%' && Math.abs(t.delta) > TREND_CAP ? 'more than ' : ''
  return `${dir} ${over}${abs.toFixed(digitsFor(abs, unit))} ${word}${vs}`.trim()
}
