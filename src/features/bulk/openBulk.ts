// Tiny helper so callers (capture bar, command palette) don't pull in the Add many UI. BulkHost listens for this event.
import type { BulkKind } from './parse'
import './launch.css'

export const OPEN_BULK = 'northstar:open-bulk'

export function openBulk(kind?: BulkKind) {
  window.dispatchEvent(new CustomEvent(OPEN_BULK, { detail: { kind } }))
}
