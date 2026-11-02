import { describe, expect, it } from 'vitest'
import { isTypingTarget, SHORTCUT_GROUPS } from './shortcutsData'

describe('shortcuts', () => {
  it('pauses single-key shortcuts while typing', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTypingTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
  it('lists only the shortcuts the app handles', () => {
    const keys = SHORTCUT_GROUPS.flatMap((g) => g.items.flatMap((i) => i.keys.map((k) => `${g.name}:${k.join('+')}`)))
    for (const k of ['Anywhere:/', 'Anywhere:?', 'Anywhere:Esc', 'Tasks:x', 'Command:a', 'Command:e', 'Command:j', 'Command:k']) expect(keys).toContain(k)
    expect(keys.some((k) => k.startsWith('Anywhere:') && k.endsWith('+K'))).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
