import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, setSetting, type Meal } from '../../db'
import { addMeal, checkProteinStreak, copyYesterday, dayStreak, logFavorite, optNum, sumMeals, TARGETS_KEY } from './foodData'

// "Today" is pinned so streak windows are deterministic. Only Date is faked; IndexedDB timers stay real.
const TODAY = '2026-06-15'
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0))
})
afterEach(() => vi.useRealTimers())

const d = (n: number) => {
  const dt = new Date(2026, 5, 15 + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}
const meal = (date: string, protein?: number, over: Partial<Meal> = {}): Omit<Meal, 'id'> => ({ date, slot: 'lunch', name: 'm', protein, ...over })
const streakEvents = () => db.events.filter((e) => e.kind === 'protein-streak').toArray()

describe('optNum / sumMeals', () => {
  it('optNum parses non-negative numbers and rounds', () => {
    expect(optNum('350')).toBe(350)
    expect(optNum(' 12.6 ')).toBe(13)
    expect(optNum('0')).toBe(0)
    expect(optNum('')).toBeUndefined()
    expect(optNum('  ')).toBeUndefined()
    expect(optNum('abc')).toBeUndefined()
    expect(optNum('-5')).toBeUndefined()
    expect(optNum('Infinity')).toBeUndefined()
  })
  it('sumMeals treats missing values as 0', () => {
    expect(sumMeals([])).toEqual({ calories: 0, protein: 0 })
    expect(sumMeals([{ ...meal(TODAY, 30), calories: 400 }, meal(TODAY), { ...meal(TODAY, 20), calories: 100 }])).toEqual({ calories: 500, protein: 50 })
  })
})

describe('dayStreak', () => {
  const set = (...ds: string[]) => new Set(ds)
  it('counts consecutive days ending today', () => {
    expect(dayStreak(set(d(0), d(-1), d(-2)), TODAY)).toBe(3)
  })
  it('today empty still counts from yesterday', () => {
    expect(dayStreak(set(d(-1), d(-2)), TODAY)).toBe(2)
  })
  it('a gap breaks the streak', () => {
    expect(dayStreak(set(d(0), d(-2), d(-3)), TODAY)).toBe(1)
  })
  it('nothing today or yesterday -> 0', () => {
    expect(dayStreak(set(d(-2), d(-3)), TODAY)).toBe(0)
    expect(dayStreak(set(), TODAY)).toBe(0)
  })
  it('crosses month and year boundaries', () => {
    expect(dayStreak(set('2026-01-01', '2025-12-31', '2025-12-30'), '2026-01-01')).toBe(3)
  })
})

describe('meal writes', () => {
  it('addMeal trims, ignores blank names, and upserts favorites case-insensitively', async () => {
    await addMeal(meal(TODAY, 30, { name: '   ' }))
    expect(await db.meals.count()).toBe(0)
    await addMeal(meal(TODAY, 30, { name: ' Oats ', calories: 300 }), { saveFavorite: true })
    await addMeal(meal(TODAY, undefined, { name: 'oats', calories: undefined }), { saveFavorite: true })
    expect(await db.meals.count()).toBe(2)
    const favs = await db.favoriteMeals.toArray()
    expect(favs).toHaveLength(1)
    expect(favs[0]).toMatchObject({ name: 'Oats', uses: 2, calories: 300, protein: 30 }) // second add keeps prior numbers
  })
  it('logFavorite adds a meal and bumps uses', async () => {
    const id = await db.favoriteMeals.add({ name: 'Shake', calories: 200, protein: 40, uses: 3 })
    await logFavorite((await db.favoriteMeals.get(id))!, TODAY, 'snack')
    expect((await db.favoriteMeals.get(id))!.uses).toBe(4)
    expect(await db.meals.toArray()).toMatchObject([{ name: 'Shake', slot: 'snack', protein: 40, date: TODAY }])
  })
  it('copyYesterday copies all or one slot, without ids', async () => {
    await db.meals.bulkAdd([
      meal(d(-1), 10, { slot: 'breakfast', name: 'a' }),
      meal(d(-1), 20, { slot: 'dinner', name: 'b' }),
      meal(d(-2), 99, { name: 'older' }),
    ])
    expect(await copyYesterday(TODAY, 'dinner')).toBe(1)
    expect(await copyYesterday(TODAY)).toBe(2)
    const today = await db.meals.where('date').equals(TODAY).toArray()
    expect(today.map((m) => m.name).sort()).toEqual(['a', 'b', 'b'])
    expect(await copyYesterday(d(-10))).toBe(0)
  })
})

describe('checkProteinStreak', () => {
  async function days(n: number, protein: number, startOffset = -(n - 1)) {
    for (let i = 0; i < n; i++) await db.meals.add(meal(d(startOffset + i), protein))
  }

  it('does nothing without a target', async () => {
    await days(7, 100)
    await checkProteinStreak(TODAY)
    expect(await streakEvents()).toHaveLength(0)
  })

  it('6 days is not enough, the 7th logs a milestone', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    await days(6, 120, -6) // d(-6)..d(-1)
    await checkProteinStreak(d(-1))
    expect(await streakEvents()).toHaveLength(0)
    await db.meals.add(meal(TODAY, 100))
    await checkProteinStreak(TODAY)
    const evs = await streakEvents()
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ milestone: true, area: 'health', refId: 20260609 })
    expect(evs[0].title).toContain('100 g')
  })

  it('never logs the same run twice, even when later days extend it', async () => {
    await setSetting(TARGETS_KEY, { protein: 50 })
    await days(7, 60, -6)
    await checkProteinStreak(TODAY)
    await checkProteinStreak(TODAY)
    await checkProteinStreak(d(-3))
    expect(await streakEvents()).toHaveLength(1)
  })

  it('protein across several meals in a day is summed', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    for (let i = -6; i <= 0; i++) {
      await db.meals.add(meal(d(i), 60, { slot: 'lunch' }))
      await db.meals.add(meal(d(i), 45, { slot: 'dinner' }))
    }
    await checkProteinStreak(TODAY)
    expect(await streakEvents()).toHaveLength(1)
  })

  it('one missed day breaks the run; a fresh 7-run is a new milestone', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    await days(7, 100, -20) // d(-20)..d(-14)
    await checkProteinStreak(d(-14))
    expect(await streakEvents()).toHaveLength(1)
    await db.meals.add(meal(d(-13), 10)) // under target
    await days(7, 100, -6)
    await checkProteinStreak(TODAY)
    const evs = await streakEvents()
    expect(evs).toHaveLength(2)
    expect(new Set(evs.map((e) => e.refId)).size).toBe(2)
  })

  it('counts days after the edited date when backfilling (but not future days)', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    await days(7, 100, -9) // d(-9)..d(-3)
    await checkProteinStreak(d(-9)) // backfill the first day: run extends forward to length 7
    expect(await streakEvents()).toHaveLength(1)
  })

  it('does not fire when the edited day itself misses the target', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    await days(6, 100, -6)
    await db.meals.add(meal(TODAY, 5))
    await checkProteinStreak(TODAY)
    expect(await streakEvents()).toHaveLength(0)
  })

  it('addMeal triggers the check automatically', async () => {
    await setSetting(TARGETS_KEY, { protein: 100 })
    await days(6, 100, -6)
    await addMeal(meal(TODAY, 100))
    expect(await streakEvents()).toHaveLength(1)
  })
})
