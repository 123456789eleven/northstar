// Pure learn logic: progress math, quiz scoring, glossary search. No DB or React in here.
import type { LearnProgress, Lesson, Question, Term, TrackId } from './content/types'

export const PROGRESS_KEY = 'learn.progress'
export const PASS_PCT = 70
export const emptyProgress = (): LearnProgress => ({ lessons: {} })

export function normalizeProgress(raw: unknown): LearnProgress {
  if (!raw || typeof raw !== 'object') return emptyProgress()
  const r = raw as Partial<LearnProgress>
  const lessons = r.lessons && typeof r.lessons === 'object' ? r.lessons : {}
  return { lessons, last: typeof r.last === 'string' ? r.last : undefined, tracksLogged: Array.isArray(r.tracksLogged) ? r.tracksLogged : [] }
}

export const isDone = (p: LearnProgress, id: string) => !!p.lessons[id]?.done

export function trackStats(p: LearnProgress, lessons: Lesson[], track: TrackId) {
  const ls = lessons.filter((l) => l.track === track)
  const done = ls.filter((l) => isDone(p, l.id)).length
  return { done, total: ls.length, pct: ls.length ? Math.round((done / ls.length) * 100) : 0, complete: ls.length > 0 && done === ls.length }
}

export function overall(p: LearnProgress, lessons: Lesson[]) {
  const done = lessons.filter((l) => isDone(p, l.id)).length
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 }
}

/** The lesson to continue with: the last opened one if unfinished, else the next unfinished after it, else the first unfinished. Null when all done. */
export function nextLesson(p: LearnProgress, lessons: Lesson[]): Lesson | null {
  const todo = lessons.filter((l) => !isDone(p, l.id))
  if (!todo.length) return null
  const at = p.last ? lessons.findIndex((l) => l.id === p.last) : -1
  if (at >= 0) {
    const after = lessons.slice(at).find((l) => !isDone(p, l.id))
    if (after) return after
  }
  return todo[0]
}

export function touch(p: LearnProgress, id: string): LearnProgress {
  return p.last === id ? p : { ...p, last: id }
}

export function recordQuiz(p: LearnProgress, id: string, pct: number): LearnProgress {
  const cur = p.lessons[id] ?? {}
  return { ...p, lessons: { ...p.lessons, [id]: { ...cur, attempts: (cur.attempts ?? 0) + 1, best: Math.max(cur.best ?? 0, pct) } } }
}

/** Marks a lesson done (idempotent) and reports tracks that just became complete and have not been logged yet. */
export function completeLesson(p: LearnProgress, lessons: Lesson[], id: string, now: string): { progress: LearnProgress; newlyComplete: TrackId[] } {
  const lesson = lessons.find((l) => l.id === id)
  if (!lesson) return { progress: p, newlyComplete: [] }
  const cur = p.lessons[id] ?? {}
  const next: LearnProgress = { ...p, lessons: { ...p.lessons, [id]: { ...cur, done: cur.done ?? now } }, last: id }
  const logged = next.tracksLogged ?? []
  const newlyComplete = trackStats(next, lessons, lesson.track).complete && !logged.includes(lesson.track) ? [lesson.track] : []
  return { progress: { ...next, tracksLogged: [...logged, ...newlyComplete] }, newlyComplete }
}

export function uncompleteLesson(p: LearnProgress, id: string): LearnProgress {
  const cur = p.lessons[id]
  if (!cur) return p
  const rest = { ...cur }
  delete rest.done
  return { ...p, lessons: { ...p.lessons, [id]: rest } }
}

export function scoreQuiz(questions: Question[], answers: (number | null | undefined)[]) {
  const total = questions.length
  const correct = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0)
  const pct = total ? Math.round((correct / total) * 100) : 0
  return { correct, total, pct, passed: total > 0 && pct >= PASS_PCT }
}

export function searchTerms(terms: Term[], query: string): Term[] {
  const q = query.trim().toLowerCase()
  const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term))
  if (!q) return sorted
  const rank = (t: Term) => {
    const name = t.term.toLowerCase()
    if (name === q) return 0
    if (name.startsWith(q)) return 1
    if (name.includes(q)) return 2
    return t.def.toLowerCase().includes(q) ? 3 : 9
  }
  return sorted.map((t) => [rank(t), t] as const).filter(([r]) => r < 9).sort((a, b) => a[0] - b[0]).map(([, t]) => t)
}

export function searchLessons(lessons: Lesson[], query: string): Lesson[] {
  const q = query.trim().toLowerCase()
  if (!q) return lessons
  return lessons.filter((l) => l.title.toLowerCase().includes(q) || l.summary.toLowerCase().includes(q))
}
