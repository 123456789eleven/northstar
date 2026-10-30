// One-line transaction entry: "Kroger 42.50" (spent) or "Paycheck +1200" (received).

export interface QuickAdd {
  description: string
  /** Always positive. */
  amount: number
  dir: 'out' | 'in'
}

/** Split a trailing amount off a description. Returns null when no usable amount or description is found. */
export function parseQuickAdd(text: string): QuickAdd | null {
  const m = text.trim().match(/^(.*?)\s+([+-]?)\$?\s?(\d[\d,]*(?:\.\d{1,2})?|\.\d{1,2})$/)
  if (!m) return null
  const description = m[1].trim()
  const amount = Number(m[3].replace(/,/g, ''))
  if (!description || !Number.isFinite(amount) || amount === 0) return null
  return { description, amount, dir: m[2] === '+' ? 'in' : 'out' }
}

export type BudgetState = 'ok' | 'near' | 'over'

/** Spent / left / over for one budget. `left` is negative when over. */
export function budgetStatus(spent: number, limit: number): { left: number; ratio: number; state: BudgetState } {
  const ratio = limit > 0 ? spent / limit : 0
  return { left: Math.round((limit - spent) * 100) / 100, ratio, state: ratio > 1 ? 'over' : ratio > 0.9 ? 'near' : 'ok' }
}
