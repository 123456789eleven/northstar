import { describe, it, expect } from 'vitest'
import { isLocalOnlySetting } from '../../sync/outbox'
import { GCAL_DISMISS_KEY, isGoogleEvent, friendlyGcalError, isValidClientId, originsToAuthorize, validateClientId } from './help'

const OK = '1234567890-abcdefghijklmnop.apps.googleusercontent.com'

describe('validateClientId', () => {
  it('accepts a real-looking ID and trims', () => {
    expect(validateClientId(OK)).toBe('')
    expect(isValidClientId(`  ${OK} `)).toBe(true)
  })
  it('is quiet when empty but not valid', () => {
    expect(validateClientId('')).toBe('')
    expect(isValidClientId('  ')).toBe(false)
  })
  it('rejects wrong suffix, spaces and stubs', () => {
    expect(validateClientId('GOCSPX-secret')).toMatch(/ends in/)
    expect(validateClientId('a b.apps.googleusercontent.com')).toMatch(/no spaces/)
    expect(validateClientId('1.apps.googleusercontent.com')).toMatch(/too short/)
    expect(isValidClientId('GOCSPX-secret')).toBe(false)
  })
})

describe('originsToAuthorize', () => {
  it('dedupes', () => {
    expect(originsToAuthorize('http://localhost:5173')).toEqual(['http://localhost:5173', 'https://123456789eleven.github.io'])
    expect(originsToAuthorize('https://123456789eleven.github.io')).toHaveLength(1)
  })
})

describe('friendlyGcalError', () => {
  it.each([
    ['popup_failed_to_open', /blocked/],
    ['popup_closed', /closed/],
    ['access_denied', /Test users/],
    ['redirect_uri_mismatch', /Authorized JavaScript origins/],
    ['idpiframe_initialization_failed', /Authorized JavaScript origins/],
    ['Your Google session expired. Reconnect to continue.', /Reconnect/],
  ])('maps %s', (raw, re) => expect(friendlyGcalError(new Error(raw))).toMatch(re))
  it('passes unknown text through and handles empty', () => {
    expect(friendlyGcalError('Weird thing')).toBe('Weird thing')
    expect(friendlyGcalError(undefined)).toMatch(/went wrong/)
  })
})

describe('google tagging and local-only keys', () => {
  it('tags by uid', () => {
    expect(isGoogleEvent({ uid: 'g:cal:a:2026-01-01' })).toBe(true)
    expect(isGoogleEvent({})).toBe(false)
  })
  it('dismiss key and client id never sync', () => {
    expect(isLocalOnlySetting(GCAL_DISMISS_KEY)).toBe(true)
    expect(isLocalOnlySetting('gcal.clientId')).toBe(true)
  })
})
