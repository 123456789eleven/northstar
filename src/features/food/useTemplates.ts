import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { TEMPLATES_KEY } from './foodData'
import { parseTemplates, type MealTemplate } from './foodLogic'

export function useTemplates(): MealTemplate[] {
  return useLiveQuery(async () => parseTemplates((await db.settings.get(TEMPLATES_KEY))?.value), [], [])
}
