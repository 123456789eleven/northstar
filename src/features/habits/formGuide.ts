// Form guide: one mark per week for the last N weeks (oldest first, the current week last), sports-table style.
import type { ISODate } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'

export type FormMark = 'met' | 'part' | 'none'
export interface FormWeek { start: ISODate; done: number; target: number; mark: FormMark; current: boolean }

export function formGuide(dates: Set<ISODate>, today: ISODate, perWeek: number, weeks = 8): FormWeek[] {
  const target = Math.max(1, Math.min(7, perWeek))
  const thisWeek = startOfWeek(today)
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeek, -7 * (weeks - 1 - i))
    let done = 0
    for (let d = 0; d < 7; d++) if (dates.has(addDays(start, d))) done++
    return { start, done, target, mark: done >= target ? 'met' : done > 0 ? 'part' : 'none', current: i === weeks - 1 } as FormWeek
  })
}

export const formSummary = (g: FormWeek[]): string => {
  const past = g.filter((w) => !w.current)
  const met = past.filter((w) => w.mark === 'met').length
  return `${met} of the last ${past.length} weeks on target`
}
