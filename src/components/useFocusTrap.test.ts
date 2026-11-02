import { describe, expect, it } from 'vitest'
import { restoreTarget } from './useFocusTrap'

describe('restoreTarget', () => {
  const body = { focus: () => {}, isConnected: true }
  it('returns the opener when it is still in the document', () => {
    const btn = { focus: () => {}, isConnected: true }
    expect(restoreTarget(btn, body)).toBe(btn)
  })
  it('skips <body>, a missing opener and an opener that was removed', () => {
    expect(restoreTarget(body, body)).toBeNull()
    expect(restoreTarget(null, body)).toBeNull()
    expect(restoreTarget({ focus: () => {}, isConnected: false }, body)).toBeNull()
    expect(restoreTarget({}, body)).toBeNull()
  })
})
