import { describe, expect, it } from 'vitest'
import { isLocalOnlySetting } from '../sync/outbox'
import { getSetting } from '../db'
import { DENSITY_KEY, normalizeDensity, setDensity } from './density'

describe('density setting', () => {
  it('is device-local and never syncs', () => {
    expect(isLocalOnlySetting(DENSITY_KEY)).toBe(true)
    expect(isLocalOnlySetting('ui.other')).toBe(false)
  })
  it('defaults to comfortable for anything unknown', () => {
    expect(normalizeDensity(undefined)).toBe('comfortable')
    expect(normalizeDensity('dense')).toBe('comfortable')
    expect(normalizeDensity('compact')).toBe('compact')
  })
  it('is remembered', async () => {
    expect(await getSetting(DENSITY_KEY, 'comfortable')).toBe('comfortable')
    await setDensity('compact')
    expect(await getSetting(DENSITY_KEY, 'comfortable')).toBe('compact')
  })
})
