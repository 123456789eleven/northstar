// Typed lesson content. To add a lesson: append a Lesson to the matching track file in this folder (ids are stable, never reuse one).
export type TrackId = 'foundations' | 'investing' | 'numbers' | 'trading' | 'assets'

export interface Section { h?: string; p?: string[]; list?: string[] }
export interface Question { q: string; options: string[]; answer: number; why: string }
export interface Lesson {
  id: string
  track: TrackId
  title: string
  summary: string
  /** Reading time in minutes (3 to 5). */
  minutes: number
  body: Section[]
  example: { title: string; lines: string[] }
  /** Glossary term ids used in this lesson. */
  terms: string[]
  wrong: string[]
  quiz: Question[]
  /** Where to try it in the app. */
  tool?: { label: string; to: string }
}
export interface Track { id: TrackId; title: string; blurb: string }
export interface Term { id: string; term: string; def: string }
export interface LessonProgress { done?: string; best?: number; attempts?: number }
export interface LearnProgress { lessons: Record<string, LessonProgress>; last?: string; tracksLogged?: TrackId[] }
