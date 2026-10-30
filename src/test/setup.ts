import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../db'

// Every test starts with empty tables.
afterEach(async () => {
  await db.open()
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
})
