import { describe, expect, it } from 'vitest'
import { PROMPTS, dailyPrompt } from './prompts'

describe('daily prompt', () => {
  it('has about 60 unique prompts across all seven themes', () => {
    expect(PROMPTS.length).toBeGreaterThanOrEqual(58)
    expect(new Set(PROMPTS.map((x) => x.text)).size).toBe(PROMPTS.length)
    expect(new Set(PROMPTS.map((x) => x.theme)).size).toBe(7)
  })

  it('is deterministic for a date', () => {
    expect(dailyPrompt('2026-11-01')).toBe(dailyPrompt('2026-11-01'))
  })

  it('varies across days', () => {
    const days = Array.from({ length: 30 }, (_, i) => dailyPrompt(`2026-11-${String(i + 1).padStart(2, '0')}`).text)
    expect(new Set(days).size).toBeGreaterThan(15)
  })

  it('cycles with skip and wraps around', () => {
    const a = dailyPrompt('2026-11-01', 0)
    expect(dailyPrompt('2026-11-01', 1)).not.toBe(a)
    expect(dailyPrompt('2026-11-01', PROMPTS.length)).toBe(a)
    expect(dailyPrompt('2026-11-01', -1)).toBe(dailyPrompt('2026-11-01', PROMPTS.length - 1))
  })
})
