import { describe, expect, it } from 'vitest'
import { glossary, LESSONS, TRACKS } from './index'

describe('lesson content', () => {
  it('has unique lesson ids and every lesson belongs to a track', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const l of LESSONS) expect(TRACKS.some((t) => t.id === l.track)).toBe(true)
    expect(LESSONS.length).toBeGreaterThanOrEqual(25)
  })
  it('has valid quizzes, terms and risk notes', () => {
    const terms = new Set(glossary.map((g) => g.id))
    for (const l of LESSONS) {
      expect(l.quiz.length, l.id).toBeGreaterThanOrEqual(3)
      expect(l.quiz.length, l.id).toBeLessThanOrEqual(5)
      for (const q of l.quiz) {
        expect(q.answer, l.id).toBeGreaterThanOrEqual(0)
        expect(q.answer, l.id).toBeLessThan(q.options.length)
        expect(q.why.length, l.id).toBeGreaterThan(0)
      }
      for (const t of l.terms) expect(terms.has(t), `${l.id}:${t}`).toBe(true)
      expect(l.wrong.length, l.id).toBeGreaterThan(0)
      expect(l.example.lines.length, l.id).toBeGreaterThan(1)
    }
  })
  it('has a glossary of unique ids and no exclamation marks anywhere', () => {
    expect(new Set(glossary.map((g) => g.id)).size).toBe(glossary.length)
    expect(glossary.length).toBeGreaterThanOrEqual(60)
    expect(JSON.stringify([LESSONS, glossary])).not.toContain('!')
  })
})
