// How each synced table relates to the others. Local auto-increment ids differ per device, so every reference
// between tables is sent as the target's stable syncId and mapped back to a local id on arrival.
import { INTERNAL_TABLES } from './outbox'

/** field -> table it points at. events.refId is special-cased (its target table is in refTable). */
export const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  tasks: { goalId: 'goals' },
  goals: { parentId: 'goals' },
  learning: { goalId: 'goals' },
  studySessions: { itemId: 'learning' },
  interactions: { personId: 'people' },
  habits: { goalId: 'goals' },
  habitLogs: { habitId: 'habits' },
}

/** Apply order for a pulled batch: referenced tables first. Unlisted tables go after these, events last. */
const ORDER = ['settings', 'goals', 'people', 'learning', 'habits']
export function applyRank(table: string): number {
  if (table === 'events') return 1000
  const i = ORDER.indexOf(table)
  return i === -1 ? 500 : i
}

export function isSyncedTable(name: string): boolean {
  return !INTERNAL_TABLES.has(name)
}

/** Foreign key fields for a record, including the dynamic events.refId. */
export function foreignKeysOf(table: string, record: Record<string, unknown>, synced: (t: string) => boolean): Record<string, string> {
  const fks = { ...(FOREIGN_KEYS[table] ?? {}) }
  if (table === 'events' && typeof record.refTable === 'string' && synced(record.refTable) && record.refTable !== 'settings') fks.refId = record.refTable
  return fks
}

/**
 * Tables with a unique natural key get a deterministic (keyed-hash) syncId so the same budget category or
 * weekly review created on two devices converges to one record instead of colliding on the unique index.
 * Returns null when the table has no natural key. `refSyncId` resolves a foreign key to its syncId.
 */
export async function naturalKey(table: string, record: Record<string, unknown>, refSyncId: (table: string, key: unknown) => Promise<string | null>): Promise<string | null> {
  switch (table) {
    case 'settings':
      return typeof record.key === 'string' ? record.key : null
    case 'budgets':
      return typeof record.category === 'string' ? record.category : null
    case 'reviews':
      return typeof record.weekOf === 'string' ? record.weekOf : null
    case 'weights':
      return typeof record.date === 'string' ? record.date : null
    case 'habitLogs': {
      const habit = await refSyncId('habits', record.habitId)
      return habit && typeof record.date === 'string' ? `${habit}|${record.date}` : null
    }
    default:
      return null
  }
}

/** For unique-indexed tables: find an existing local row with the same natural key (index name + value). */
export function uniqueLookup(table: string, record: Record<string, unknown>): { index: string; value: unknown } | null {
  switch (table) {
    case 'budgets':
      return record.category != null ? { index: 'category', value: record.category } : null
    case 'reviews':
      return record.weekOf != null ? { index: 'weekOf', value: record.weekOf } : null
    case 'weights':
      return record.date != null ? { index: 'date', value: record.date } : null
    case 'habitLogs':
      return record.habitId != null && record.date != null ? { index: '[habitId+date]', value: [record.habitId, record.date] } : null
    default:
      return null
  }
}
