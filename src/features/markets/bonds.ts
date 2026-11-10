// Plain coupon bond math (fixed coupon, par repaid at maturity, price is clean and coupon dates are whole periods away).
// Educational arithmetic only. Returns null for inputs that make no sense.

export interface BondInput {
  /** Market price per `face`. */
  price: number
  face?: number
  /** Annual coupon rate in percent. */
  couponRatePct: number
  yearsToMaturity: number
  /** Coupons per year (default 2). */
  frequency?: number
}

const valid = (b: BondInput) => {
  const f = b.frequency ?? 2
  const face = b.face ?? 100
  return [b.price, face, b.couponRatePct, b.yearsToMaturity, f].every(Number.isFinite) && b.price > 0 && face > 0 && b.couponRatePct >= 0 && f >= 1 && Math.round(b.yearsToMaturity * f) >= 1
}

const priceAt = (y: number, c: number, face: number, n: number) => {
  if (Math.abs(y) < 1e-12) return c * n + face
  const v = 1 / (1 + y)
  return (c * (1 - Math.pow(v, n))) / y + face * Math.pow(v, n)
}

/** Annual current yield (fraction): annual coupon / price. */
export function currentYield(b: BondInput): number | null {
  if (!valid(b)) return null
  return (((b.couponRatePct / 100) * (b.face ?? 100)) / b.price)
}

/** Yield to maturity as an annual fraction (periodic yield x frequency), found by bisection. */
export function yieldToMaturity(b: BondInput): number | null {
  if (!valid(b)) return null
  const f = b.frequency ?? 2, face = b.face ?? 100
  const n = Math.round(b.yearsToMaturity * f)
  const c = ((b.couponRatePct / 100) * face) / f
  let lo = -0.99, hi = 1
  if (priceAt(lo, c, face, n) < b.price) return null
  while (priceAt(hi, c, face, n) > b.price && hi < 1e3) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (priceAt(mid, c, face, n) > b.price) lo = mid
    else hi = mid
  }
  return ((lo + hi) / 2) * f
}

/** Macaulay and modified duration in years, at the bond's own YTM. */
export function duration(b: BondInput): { macaulay: number; modified: number } | null {
  const ytm = yieldToMaturity(b)
  if (ytm === null) return null
  const f = b.frequency ?? 2, face = b.face ?? 100
  const n = Math.round(b.yearsToMaturity * f)
  const c = ((b.couponRatePct / 100) * face) / f
  const y = ytm / f
  let pv = 0, weighted = 0
  for (let t = 1; t <= n; t++) {
    const cf = t === n ? c + face : c
    const p = cf / Math.pow(1 + y, t)
    pv += p
    weighted += (t / f) * p
  }
  const macaulay = weighted / pv
  return { macaulay, modified: macaulay / (1 + y) }
}
