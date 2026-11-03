// STUB. Returns a fixed, fictional player so the shell and hub UI can be built before the engine lands.
// The engine builder replaces the body with the real derived state and keeps this signature.
import type { PlayerState } from './types'

const DEMO: PlayerState = {
  loading: false,
  calm: false,
  level: 7,
  xp: 2650,
  xpIntoLevel: 330,
  xpForNext: 800,
  todayXp: 85,
  skills: [
    { id: 'body', label: 'Body', level: 5, xp: 1500, xpIntoLevel: 200, xpForNext: 600, todayXp: 45 },
    { id: 'money', label: 'Money', level: 3, xp: 600, xpIntoLevel: 0, xpForNext: 400, todayXp: 0 },
    { id: 'mind', label: 'Mind', level: 4, xp: 1000, xpIntoLevel: 100, xpForNext: 500, todayXp: 20 },
    { id: 'career', label: 'Career', level: 3, xp: 600, xpIntoLevel: 150, xpForNext: 400, todayXp: 20 },
    { id: 'people', label: 'People', level: 2, xp: 300, xpIntoLevel: 100, xpForNext: 300, todayXp: 0 },
  ],
  quests: [
    { id: 'demo:weigh-in', kind: 'weigh-in', skill: 'body', title: 'Weigh in', xp: 15, done: true, auto: true },
    { id: 'demo:protein', kind: 'protein', skill: 'body', title: 'Hit your protein', hint: '96 of 130 g', xp: 25, done: false, auto: true, progress: { value: 96, target: 130, unit: 'g' }, href: '/food' },
    { id: 'demo:journal', kind: 'journal', skill: 'mind', title: 'Write today\'s entry', xp: 20, done: false, auto: true, href: '/journal' },
    { id: 'demo:win', kind: 'win', skill: 'career', title: 'Log a win', xp: 25, done: false, auto: true, href: '/career' },
  ],
  questsDone: 1,
  cleared: false,
  streak: { target: 5, daysThisWeek: 3, weekDots: [true, true, true, false, false, false, false], restTokens: 2, weeksInRow: 4 },
  recent: [
    { id: 'demo:1', at: '2026-11-02T07:20:00', skill: 'body', xp: 15, reason: 'Logged a weigh-in (+15)' },
    { id: 'demo:2', at: '2026-11-02T07:45:00', skill: 'mind', xp: 20, reason: 'Wrote a journal entry (+20)' },
  ],
}

export function usePlayer(): PlayerState {
  return DEMO
}
