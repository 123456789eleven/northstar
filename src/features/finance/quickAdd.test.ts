import { describe, expect, it } from 'vitest'
import { budgetStatus, parseQuickAdd } from './quickAdd'

describe('parseQuickAdd', () => {
  it('reads a trailing amount as spending', () => {
    expect(parseQuickAdd('Kroger 42.50')).toEqual({ description: 'Kroger', amount: 42.5, dir: 'out' })
    expect(parseQuickAdd('Coffee shop $4')).toEqual({ description: 'Coffee shop', amount: 4, dir: 'out' })
  })
  it('treats a plus sign as received and handles thousands separators', () => {
    expect(parseQuickAdd('Paycheck +1,200.00')).toEqual({ description: 'Paycheck', amount: 1200, dir: 'in' })
  })
  it('rejects text without a description or amount', () => {
    expect(parseQuickAdd('Kroger')).toBeNull()
    expect(parseQuickAdd('42.50')).toBeNull()
    expect(parseQuickAdd('Kroger 0')).toBeNull()
  })
  it('keeps numbers inside the description', () => {
    expect(parseQuickAdd('7 eleven 12.30')?.description).toBe('7 eleven')
  })
})

describe('budgetStatus', () => {
  it('reports left, over and state', () => {
    expect(budgetStatus(50, 200)).toMatchObject({ left: 150, state: 'ok' })
    expect(budgetStatus(190, 200).state).toBe('near')
    expect(budgetStatus(230, 200)).toMatchObject({ left: -30, state: 'over' })
  })
})
