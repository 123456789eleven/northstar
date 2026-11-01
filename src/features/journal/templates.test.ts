import { describe, expect, it } from 'vitest'
import { TEMPLATES, composeTemplate, firstAnswerOffset, getTemplate, parseAnswers } from './templates'

describe('journal templates', () => {
  it('has the five guided templates with unique labels', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['morning', 'evening', 'gratitude', 'career', 'body'])
    for (const t of TEMPLATES) expect(new Set(t.sections.map((x) => x.label)).size).toBe(t.sections.length)
  })

  it('composes a blank scaffold of labeled headings', () => {
    const t = getTemplate('evening')!
    const text = composeTemplate(t)
    expect(text).toBe('Went well:\n\n\nLearned:\n\n\nWould change:\n\n\nTomorrow first move:\n')
    expect(text.slice(0, firstAnswerOffset(t))).toBe('Went well:\n')
  })

  it('fills answers in order and trims them', () => {
    const t = getTemplate('gratitude')!
    expect(composeTemplate(t, [' coffee with Sam ', 'a good set'])).toBe('Grateful 1:\ncoffee with Sam\n\nGrateful 2:\na good set\n\nGrateful 3:\n')
  })

  it('round-trips answers, including multi-line ones', () => {
    for (const t of TEMPLATES) {
      const answers = t.sections.map((_, i) => (i % 2 ? `line a\nline b ${i}` : `answer ${i}`))
      expect(parseAnswers(t, composeTemplate(t, answers))).toEqual(answers)
    }
  })
})
