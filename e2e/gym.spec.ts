// Gym (B2, the reference building): three floors, a stage meter from real data, one-tap loops and a single More sheet per floor.
// Fictional data only.
import { expect, test, type Page } from '@playwright/test'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

async function seed(page: Page, data: Record<string, unknown[]>) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await page.evaluate(async (d) => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('northstar'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    for (const [store, rows] of Object.entries(d)) {
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(store, 'readwrite')
        for (const row of rows) tx.objectStore(store).put(row)
        tx.oncomplete = () => res()
        tx.onerror = () => rej(tx.error)
      })
    }
    db.close()
  }, data)
  await page.reload()
}

const viewports = [
  { name: '390', size: { width: 390, height: 844 }, touch: true },
  { name: '1440', size: { width: 1440, height: 900 }, touch: false },
]

for (const vp of viewports) {
  test.describe(`Gym at ${vp.name}`, () => {
    test.use({ viewport: vp.size, hasTouch: vp.touch })

    test('each floor shows its one-tap action without scrolling; no horizontal scroll', async ({ page }) => {
      await seed(page, { weights: [{ date: daysAgo(2), weight: 140 }] })
      const inView = async (name: string | RegExp, where = page.getByRole('main')) => {
        const box = await where.getByRole('button', { name }).first().boundingBox()
        expect(box).not.toBeNull()
        expect(box!.y + box!.height).toBeLessThanOrEqual(vp.size.height - 70)
      }
      await page.goto('/#/body')
      await expect(page.getByTestId('hero-weight')).toBeVisible()
      await inView(/^(Save|Update)$/)
      await page.goto('/#/food')
      await expect(page.getByLabel('Quick add a meal')).toBeVisible()
      await inView(/^Add$/)
      await page.goto('/#/training')
      await inView(/^Log workout$/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })

    test('Training: tapping a day advances the week ring; the stage meter counts it', async ({ page }) => {
      await seed(page, { habits: [{ name: 'Lift', area: 'health', perWeek: 1, createdAt: new Date().toISOString() }] })
      await page.goto('/#/training')
      const meter = page.getByTestId('stage-meter')
      await expect(meter).toHaveAttribute('data-stage', '0')
      const count = page.getByTestId('train-count')
      await expect(count).toHaveText('0')
      const today = page.getByRole('list', { name: 'This week' }).getByRole('button', { pressed: false }).and(page.locator('.is-today'))
      await today.click()
      await expect(count).toHaveText('1')
      await expect(meter).toHaveAttribute('data-stage', '1')
      await meter.getByRole('button').click()
      await expect(page.getByRole('dialog', { name: 'Gym stage' })).toContainText('Training target hit')
    })
  })
}

test.describe('Gym More sheet', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('every Gym feature stays reachable behind one More row', async ({ page }) => {
    await seed(page, { weights: [{ date: daysAgo(9), weight: 138 }, { date: daysAgo(1), weight: 139 }] })
    await page.goto('/#/body')
    await page.getByTestId('floor-more').click()
    let sheet = page.getByRole('dialog', { name: 'Weigh-in: more' })
    await sheet.getByRole('button', { name: /Goal and date/ }).click()
    await expect(page.getByLabel('Goal weight (lb)')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /^Close/ }).click()
    // Kitchen: week view, favorites, templates, targets live in the sheet.
    await page.goto('/#/food')
    await page.getByTestId('floor-more').click()
    sheet = page.getByRole('dialog', { name: 'Kitchen: more' })
    for (const label of ['Week view', 'Favorites', 'Templates', 'Daily targets', 'Pick a date']) await expect(sheet.getByRole('button', { name: new RegExp(label) })).toBeVisible()
    await sheet.getByRole('button', { name: /Week view/ }).click()
    await expect(page.getByText('Calories per day')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /^Close/ }).click()
    // The lookup (Open Food Facts, opt-in) is still one tap into a meal slot.
    await page.getByRole('button', { name: 'Add to lunch' }).click()
    await expect(page.getByLabel('Meal name')).toBeVisible()
  })
})
