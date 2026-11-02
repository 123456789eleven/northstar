// Check-in with a completion moment: when a check-in reaches a streak milestone (7/30/100 days, 4/12/26 weeks),
// a quiet toast names it, offers Undo (removes the check-in and the milestone event) and the next rung.
import { useCallback } from 'react'
import type { Habit, ISODate } from '../../db'
import { useToast } from '../../components/toastContext'
import { checkIn, undoCheckIn } from './habitData'

export function useHabitCheckIn() {
  const toast = useToast()
  return useCallback(async (habit: Habit, date: ISODate) => {
    const r = await checkIn(habit, date)
    const m = r.milestone
    if (m) {
      const unit = (n: number) => `${n} ${m.unit}${n === 1 ? '' : 's'}`
      toast({
        message: `${unit(m.count)} in a row: ${habit.name}. Added to Achievements.${m.next ? ` Next mark: ${unit(m.next)}.` : ''}`,
        undo: () => undoCheckIn(habit, date, m),
      })
    }
    return r
  }, [toast])
}
