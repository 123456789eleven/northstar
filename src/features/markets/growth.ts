// Compound growth illustration. This is arithmetic on assumptions the user picks, NOT a forecast and not advice.
import { round2 } from './portfolio'

export const GROWTH_DISCLAIMER = 'An illustration using the returns you chose. Real returns vary and can be negative. This is not a forecast or advice.'

export interface GrowthInput {
  principal: number
  monthlyContribution: number
  years: number
  /** Nominal annual return in percent, for example 6 for 6%. */
  annualReturnPct: number
}
export interface GrowthPoint { month: number; balance: number; contributed: number }
export interface GrowthResult { points: GrowthPoint[]; final: number; contributed: number; growth: number }

/** Month-by-month balance. Contributions land at month end; the monthly rate is the compounding equivalent of the annual one. */
export function project(input: GrowthInput): GrowthResult {
  const principal = Math.max(0, Number.isFinite(input.principal) ? input.principal : 0)
  const monthly = Math.max(0, Number.isFinite(input.monthlyContribution) ? input.monthlyContribution : 0)
  const months = Math.max(0, Math.min(Math.round((Number.isFinite(input.years) ? input.years : 0) * 12), 1200))
  const annual = Math.max(-99, Number.isFinite(input.annualReturnPct) ? input.annualReturnPct : 0) / 100
  const r = Math.pow(1 + annual, 1 / 12) - 1
  let bal = principal
  const points: GrowthPoint[] = [{ month: 0, balance: round2(bal), contributed: round2(principal) }]
  for (let m = 1; m <= months; m++) {
    bal = bal * (1 + r) + monthly
    points.push({ month: m, balance: round2(bal), contributed: round2(principal + monthly * m) })
  }
  const last = points[points.length - 1]
  return { points, final: last.balance, contributed: last.contributed, growth: round2(last.balance - last.contributed) }
}

export interface GrowthRange { low: GrowthResult; base: GrowthResult; high: GrowthResult; disclaimer: string }
/** Three illustrations: a lower, middle and higher assumed return. Defaults 3 / 6 / 9 percent. */
export function projectRange(input: Omit<GrowthInput, 'annualReturnPct'>, returns: { low: number; base: number; high: number } = { low: 3, base: 6, high: 9 }): GrowthRange {
  return {
    low: project({ ...input, annualReturnPct: returns.low }),
    base: project({ ...input, annualReturnPct: returns.base }),
    high: project({ ...input, annualReturnPct: returns.high }),
    disclaimer: GROWTH_DISCLAIMER,
  }
}
