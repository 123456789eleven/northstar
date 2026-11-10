import { money } from '../../lib/dates'

export const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${money(Math.abs(n))}`
export const tone = (n: number) => (n > 0 ? 'good' : n < 0 ? 'warn' : '')
export const compact = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`)
