// The one small win moment for a finished task: names the real task and the running count. Specific, no praise words.
// The closing phrase rotates (deterministically, seeded by the running count) so it never repeats back to back.
import { pickLine } from '../../lib/pickLine'

const TAILS = [
  (n: number) => `That's ${n} today.`,
  (n: number) => `${n} down today.`,
  (n: number) => `Today's count: ${n}.`,
] as const

export const doneMessage = (title: string, doneToday: number): string => {
  if (doneToday <= 1) return `Done: ${title}. First one on the board today.`
  const i = TAILS.map((_, k) => k).indexOf(Number(pickLine('task-done', doneToday, ['0', '1', '2'])))
  return `Done: ${title}. ${TAILS[i](doneToday)}`
}
