import { describe, expect, it } from 'vitest'
import type { Lesson, Question, Term } from './content/types'
import { completeLesson, emptyProgress, nextLesson, normalizeProgress, overall, recordQuiz, scoreQuiz, searchLessons, searchTerms, trackStats, uncompleteLesson } from './logic'

const mk = (id: string, track: Lesson['track']): Lesson => ({ id, track, title: `Title ${id}`, summary: 'about ' + id, minutes: 3, body: [], example: { title: '', lines: [] }, terms: [], wrong: [], quiz: [] })
const lessons = [mk('a', 'foundations'), mk('b', 'foundations'), mk('c', 'investing')]
const NOW = '2026-11-09T10:00:00.000Z'

describe('progress', () => {
  it('normalizes junk to empty', () => {
    expect(normalizeProgress(null)).toEqual({ lessons: {} })
    expect(normalizeProgress('x').lessons).toEqual({})
  })
  it('computes overall and per-track stats', () => {
    const { progress } = completeLesson(emptyProgress(), lessons, 'a', NOW)
    expect(overall(progress, lessons)).toEqual({ done: 1, total: 3, pct: 33 })
    expect(trackStats(progress, lessons, 'foundations')).toMatchObject({ done: 1, total: 2, pct: 50, complete: false })
  })
  it('completion is idempotent and keeps the first timestamp', () => {
    const one = completeLesson(emptyProgress(), lessons, 'a', NOW).progress
    const two = completeLesson(one, lessons, 'a', '2027-01-01T00:00:00.000Z').progress
    expect(two.lessons.a.done).toBe(NOW)
  })
  it('reports a track as newly complete exactly once', () => {
    const s1 = completeLesson(emptyProgress(), lessons, 'a', NOW)
    expect(s1.newlyComplete).toEqual([])
    const s2 = completeLesson(s1.progress, lessons, 'b', NOW)
    expect(s2.newlyComplete).toEqual(['foundations'])
    const s3 = completeLesson(uncompleteLesson(s2.progress, 'b'), lessons, 'b', NOW)
    expect(s3.newlyComplete).toEqual([])
  })
  it('ignores unknown lesson ids', () => {
    expect(completeLesson(emptyProgress(), lessons, 'zzz', NOW).progress).toEqual(emptyProgress())
  })
  it('picks the next lesson', () => {
    expect(nextLesson(emptyProgress(), lessons)?.id).toBe('a')
    const p = completeLesson(emptyProgress(), lessons, 'a', NOW).progress
    expect(nextLesson(p, lessons)?.id).toBe('b')
    expect(nextLesson({ ...p, last: 'c' }, lessons)?.id).toBe('c')
    const all = completeLesson(completeLesson(p, lessons, 'b', NOW).progress, lessons, 'c', NOW).progress
    expect(nextLesson(all, lessons)).toBeNull()
  })
  it('tracks best score and attempts', () => {
    let p = recordQuiz(emptyProgress(), 'a', 50)
    p = recordQuiz(p, 'a', 100)
    p = recordQuiz(p, 'a', 75)
    expect(p.lessons.a).toMatchObject({ best: 100, attempts: 3 })
  })
})

describe('scoreQuiz', () => {
  const qs: Question[] = [0, 1, 2, 3].map((i) => ({ q: 'q' + i, options: ['x', 'y', 'z'], answer: i % 3, why: '' }))
  it('scores and applies the pass mark', () => {
    expect(scoreQuiz(qs, [0, 1, 2, 0])).toMatchObject({ correct: 4, pct: 100, passed: true })
    expect(scoreQuiz(qs, [0, 1, 0, 1])).toMatchObject({ correct: 2, pct: 50, passed: false })
    expect(scoreQuiz(qs, [0, 1, 2, 1])).toMatchObject({ correct: 3, pct: 75, passed: true })
  })
  it('treats unanswered as wrong and empty quiz as not passed', () => {
    expect(scoreQuiz(qs, [null]).correct).toBe(0)
    expect(scoreQuiz([], []).passed).toBe(false)
  })
})

describe('search', () => {
  const terms: Term[] = [
    { id: 'yield', term: 'Yield', def: 'Income as a share of price.' },
    { id: 'dividend', term: 'Dividend', def: 'A payout to shareholders; the dividend yield is this over price.' },
    { id: 'bond', term: 'Bond', def: 'A loan you make that pays a yield.' },
  ]
  it('returns all terms sorted when the query is empty', () => {
    expect(searchTerms(terms, '').map((t) => t.id)).toEqual(['bond', 'dividend', 'yield'])
  })
  it('ranks name matches before definition matches', () => {
    expect(searchTerms(terms, 'yield').map((t) => t.id)).toEqual(['yield', 'bond', 'dividend'])
    expect(searchTerms(terms, 'DIV')[0].id).toBe('dividend')
    expect(searchTerms(terms, 'nothing here')).toEqual([])
  })
  it('searches lessons by title and summary', () => {
    expect(searchLessons(lessons, 'title b').map((l) => l.id)).toEqual(['b'])
    expect(searchLessons(lessons, 'about c')).toHaveLength(1)
  })
})
