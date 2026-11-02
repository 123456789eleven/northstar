// Density (comfortable | compact): a device-local display setting. Stored in settings key `ui.density` (never syncs:
// see sync/outbox.ts isLocalOnlySetting) and mirrored to localStorage so the first paint already has the right spacing.
// Applied as `data-density` on <html>; index.css swaps the spacing variables. Phones always stay comfortable (CSS).
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'

export type Density = 'comfortable' | 'compact'
export const DENSITY_KEY = 'ui.density'
const MIRROR = 'ns.density'

export function normalizeDensity(v: unknown): Density {
  return v === 'compact' ? 'compact' : 'comfortable'
}

export function applyDensity(d: Density) {
  if (typeof document === 'undefined') return
  if (d === 'compact') document.documentElement.dataset.density = 'compact'
  else delete document.documentElement.dataset.density
  try { localStorage.setItem(MIRROR, d) } catch { /* storage blocked: the DB value still applies after load */ }
}

/** Called once before the first render. */
export function applyStoredDensity() {
  try { applyDensity(normalizeDensity(localStorage.getItem(MIRROR))) } catch { /* ignore */ }
}

export async function setDensity(d: Density) {
  applyDensity(d)
  await setSetting(DENSITY_KEY, d)
}

/** Current density from the DB (undefined while loading). Keeps <html> in step with the stored value. */
export function useDensity(): Density | undefined {
  const stored = useLiveQuery(() => getSetting<string>(DENSITY_KEY, 'comfortable'), [])
  const d = stored === undefined ? undefined : normalizeDensity(stored)
  useEffect(() => { if (d) applyDensity(d) }, [d])
  return d
}
