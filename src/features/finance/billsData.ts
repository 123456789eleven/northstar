import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'
import { BILLS_KEY, parseBills, serializeBills, type Bill } from './bills'

export function useBills(): Bill[] | undefined {
  return useLiveQuery(async () => parseBills((await db.settings.get(BILLS_KEY))?.value), [])
}

export async function readBills(): Promise<Bill[]> {
  return parseBills((await db.settings.get(BILLS_KEY))?.value)
}

export async function saveBills(items: Bill[]) {
  await setSetting(BILLS_KEY, serializeBills(items))
}
