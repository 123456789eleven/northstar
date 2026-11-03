import { afterEach, describe, expect, it, vi } from 'vitest'
import { haptic, HAPTIC_PATTERN, setHapticsEnabled } from './haptics'
import { setSoundEnabled, tick } from './sound'

describe('haptics', () => {
  afterEach(() => { setHapticsEnabled(false); vi.unstubAllGlobals() })
  it('does nothing while the setting is off (default)', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    expect(haptic('tick')).toBe(false)
    expect(vibrate).not.toHaveBeenCalled()
  })
  it('vibrates a light tick or a double tick when on', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    setHapticsEnabled(true)
    expect(haptic('tick')).toBe(true)
    expect(haptic('double')).toBe(true)
    expect(vibrate).toHaveBeenNthCalledWith(1, HAPTIC_PATTERN.tick)
    expect(vibrate).toHaveBeenNthCalledWith(2, HAPTIC_PATTERN.double)
  })
  it('is safe where vibrate is missing', () => {
    vi.stubGlobal('navigator', {})
    setHapticsEnabled(true)
    expect(haptic()).toBe(false)
  })
})

describe('sound', () => {
  it('is silent by default and without WebAudio', () => {
    expect(tick()).toBe(false)
    setSoundEnabled(true)
    expect(tick()).toBe(false) // node test env: no window/AudioContext
    setSoundEnabled(false)
  })
})
