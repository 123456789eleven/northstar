// Device preferences for journaling, stored as settings keys prefixed `journal.`.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'
import { DEFAULT_GOAL } from './insights'

export interface JournalPrefs { goal: number; typewriter: boolean; timer: boolean }

export function useJournalPrefs(): [JournalPrefs, (patch: Partial<JournalPrefs>) => void] {
  const rows = useLiveQuery(() => db.settings.where('key').startsWith('journal.').toArray(), [])
  const get = (k: string) => rows?.find((r) => r.key === `journal.${k}`)?.value
  const goal = Number(get('goal'))
  const prefs: JournalPrefs = {
    goal: Number.isFinite(goal) && goal > 0 ? Math.min(5000, Math.round(goal)) : DEFAULT_GOAL,
    typewriter: get('typewriter') === true,
    timer: get('timer') === true,
  }
  const set = (patch: Partial<JournalPrefs>) => {
    for (const [k, v] of Object.entries(patch)) void setSetting(`journal.${k}`, v)
  }
  return [prefs, set]
}
