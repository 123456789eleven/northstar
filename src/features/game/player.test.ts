import { describe, expect, it } from 'vitest'
import { db, setSetting } from '../../db'
import { isLocalOnlySetting } from '../../sync/outbox'
import { addDays } from '../../lib/dates'
import { deriveGains } from './engine/derive'
import { ownerSnapshot, snap, TODAY } from './engine/fixtures'
import { buildPlayer } from './engine/player'
import { generateQuests } from './engine/quests'
import { loadSnapshot } from './engine/snapshot'
import { GAME_DEFAULTS, parseGameSettings } from './gameSettings'

describe('game settings', () => {
  it('game.* keys are device-local and parse with defaults', () => {
    for (const k of ['calm', 'haptics', 'sound', 'motion', 'weekTarget']) expect(isLocalOnlySetting(`game.${k}`)).toBe(true)
    expect(isLocalOnlySetting('food.targets')).toBe(false)
    expect(parseGameSettings({})).toEqual(GAME_DEFAULTS)
    expect(parseGameSettings({ 'game.calm': true, 'game.weekTarget': 99, 'game.motion': 'reduced', 'game.sound': 'yes' })).toMatchObject({
      calm: true, weekTarget: 7, motion: 'reduced', sound: false,
    })
  })
})

describe('buildPlayer', () => {
  it('works on empty data without NaN', () => {
    const p = buildPlayer(snap(), TODAY)
    expect(p).toMatchObject({ level: 1, xp: 0, todayXp: 0, cleared: false })
    expect(p.skills).toHaveLength(5)
    expect(JSON.stringify(p)).not.toMatch(/NaN/)
  })
  it('totals skills, overall level, today and recent', () => {
    const p = buildPlayer(ownerSnapshot({ weights: [{ id: 1, date: TODAY, weight: 180 }] }), TODAY)
    expect(p.xp).toBe(15)
    expect(p.skills.find((s) => s.id === 'body')).toMatchObject({ xp: 15, todayXp: 15 })
    expect(p.todayXp).toBe(15)
    expect(p.recent[0].reason).toBe('Logged a weigh-in (+15)')
    expect(p.questsDone).toBe(1)
  })
  it('a missed week resets the streak but never lowers XP', () => {
    const w = (d: string, id: number) => ({ id, date: d, text: 'x', createdAt: '' })
    const s = snap({ journal: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'].map(w) })
    const early = buildPlayer(s, '2026-10-18')
    const late = buildPlayer(s, '2026-11-02')
    expect(early.streak.weeksInRow).toBe(1)
    expect(late.streak.weeksInRow).toBe(0)
    expect(late.xp).toBeGreaterThanOrEqual(early.xp)
  })
  it('performance: two years of daily data derives in under 100 ms', () => {
    const s = ownerSnapshot()
    let id = 1
    for (let i = 0; i < 730; i++) {
      const d = addDays(TODAY, -i)
      s.weights.push({ id: id++, date: d, weight: 180 })
      s.meals.push({ id, date: d, slot: 'breakfast', name: 'a', calories: 800, protein: 50 }, { id: id++, date: d, slot: 'lunch', name: 'b', calories: 900, protein: 50 }, { id: id++, date: d, slot: 'dinner', name: 'c', calories: 800, protein: 45 })
      s.journal.push({ id: id++, date: d, text: 'entry', createdAt: '' })
      s.habitLogs.push({ id: id++, habitId: 1, date: d })
      s.studySessions.push({ id: id++, itemId: 1, date: d, minutes: 30 })
      s.transactions.push({ id: id++, date: d, amount: -12, description: 'x', category: 'Groceries' })
      s.tasks.push({ id: id++, title: 't', priority: 1, status: 'done', recurrence: 'none', doneAt: `${d}T12:00:00`, createdAt: '' })
      s.events.push({ id: id++, at: `${d}T12:00:00`, area: 'career', kind: 'career.win', title: 'w', milestone: false })
    }
    // Best of 5 runs: a single run is dominated by JIT warm-up and by whatever else is using the machine (parallel test workers,
    // browsers). The best run measures the code, not the load.
    let best = Infinity
    let gains = deriveGains(s, TODAY)
    let q = generateQuests(s, TODAY, gains)
    for (let i = 0; i < 5; i++) {
      const t0 = performance.now()
      gains = deriveGains(s, TODAY)
      q = generateQuests(s, TODAY, gains)
      best = Math.min(best, performance.now() - t0)
    }
    expect(gains.length).toBeGreaterThan(5000)
    expect(q.length).toBeLessThanOrEqual(5)
    expect(best).toBeLessThan(100)
    let bestPlayer = Infinity
    for (let i = 0; i < 5; i++) {
      const t1 = performance.now()
      buildPlayer(s, TODAY)
      bestPlayer = Math.min(bestPlayer, performance.now() - t1)
    }
    expect(bestPlayer).toBeLessThan(150)
  })
})

describe('loadSnapshot', () => {
  it('reads the database without writing to it', async () => {
    await db.weights.add({ date: TODAY, weight: 180 })
    await db.meals.add({ date: TODAY, slot: 'lunch', name: 'x', calories: 500, protein: 40 })
    await db.journal.add({ date: TODAY, text: 'hi', createdAt: '' })
    await db.events.add({ at: `${TODAY}T10:00:00`, area: 'career', kind: 'career.win', title: 'w', milestone: false })
    await db.events.add({ at: `${TODAY}T10:00:00`, area: 'career', kind: 'task.create', title: 'ignored', milestone: false })
    await setSetting('food.targets', { protein: 40 })
    await setSetting('game.weekTarget', 4)
    const dump = async () => JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())))
    const before = await dump()
    const s = await loadSnapshot()
    const p = buildPlayer(s, TODAY)
    expect(await dump()).toBe(before)
    expect(s.events).toHaveLength(1)
    expect(s.weekTarget).toBe(4)
    expect(p.xp).toBeGreaterThan(0)
    expect(p.streak.target).toBe(4)
  })
})
