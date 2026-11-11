// G3 (Body, Food, Money): key flows at phone (390x844) and desktop (1440x900). Fictional data only, seeded straight into IndexedDB.
import { expect, test, type Page } from '@playwright/test'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }

/** Add rows to Dexie stores (app opened once first so the schema exists), then reload so live queries pick them up. */
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
  test.describe(`Plan round 2 at ${vp.name}`, () => {
    test.use({ viewport: vp.size, hasTouch: vp.touch })

    test('Body: hero, path chart and checkpoint chips render with three weigh-ins', async ({ page }) => {
      await seed(page, { weights: [{ date: daysAgo(14), weight: 135 }, { date: daysAgo(7), weight: 136.2 }, { date: daysAgo(1), weight: 137.4 }] })
      await page.goto('/#/body')
      await expect(page.getByTestId('hero-weight')).toBeVisible()
      await expect(page.getByTestId('body-pace')).toContainText('lb/wk')
      await expect(page.getByRole('progressbar', { name: /Weight path to goal/ })).toBeVisible()
      await expect(page.locator('.wpath, .recharts-wrapper').first()).toBeVisible()
      await expect(page.getByRole('list', { name: 'Checkpoints' })).toBeVisible()
      await page.screenshot({ path: `test-results/body-${vp.name}.png`, fullPage: false })
    })

    test('Food: default 3,000 kcal target shows with an inline edit', async ({ page }) => {
      await seed(page, { meals: [{ date: daysAgo(0), slot: 'lunch', name: 'Lentil soup', calories: 600, protein: 30, createdAt: new Date().toISOString() }] })
      await page.goto('/#/food')
      await expect(page.getByTestId('ring-calories')).toContainText('of 3,000 kcal')
      await expect(page.getByTestId('food-default')).toContainText('Default target')
      await page.getByRole('button', { name: 'Change it' }).click()
      await page.getByLabel('Daily calorie target').fill('3200')
      await page.getByTestId('food-default').getByRole('button', { name: 'Save' }).click()
      await expect(page.getByTestId('ring-calories')).toContainText('of 3,200 kcal')
      await expect(page.getByTestId('food-default')).toHaveCount(0)
    })
  })
}
