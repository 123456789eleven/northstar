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
  test.describe(`G3 at ${vp.name}`, () => {
    test.use({ viewport: vp.size, hasTouch: vp.touch })

    test('Body: a weigh-in through the stepper updates the hero', async ({ page }) => {
      await seed(page, { weights: [{ date: daysAgo(1), weight: 136 }] })
      await page.goto('/#/body')
      const hero = page.getByTestId('hero-weight')
      await expect(hero).toContainText('136.0')
      const input = page.getByLabel('Weight in pounds')
      await page.getByRole('button', { name: 'Raise by 0.1 pound' }).click()
      await expect(input).toHaveValue('136.1')
      await input.fill('138')
      await page.locator('.wstep').getByRole('button', { name: /^(Save|Update)$/ }).click()
      await expect(hero).toContainText('137.0')
      // Flags: the path lists its checkpoints in words.
      await expect(page.getByRole('list', { name: 'Checkpoints' })).toBeVisible()
    })

    test('Body: empty state guides the first weigh-in', async ({ page }) => {
      await page.goto('/#/body')
      await expect(page.getByText('Your first weigh-in')).toBeVisible()
      await page.getByLabel('Weight in pounds').fill('150')
      await page.locator('.wstep').getByRole('button', { name: /^(Save|Update)$/ }).click()
      await expect(page.getByTestId('hero-weight')).toContainText('150.0')
    })

    test('Body: Log workout moves the training ring and Undo restores it', async ({ page }) => {
      await seed(page, { habits: [{ name: 'Lift', area: 'health', perWeek: 4, createdAt: new Date().toISOString() }], weights: [{ date: daysAgo(1), weight: 136 }] })
      await page.goto('/#/body')
      await page.getByRole('tab', { name: 'Training' }).click()
      const count = page.getByTestId('train-count')
      await expect(count).toHaveText('0')
      await page.getByRole('button', { name: 'Log workout' }).click()
      await expect(count).toHaveText('1')
      await page.getByRole('button', { name: 'Undo' }).click()
      await expect(count).toHaveText('0')
      await expect(page.getByRole('button', { name: 'Log workout' })).toBeVisible()
    })

    test('Food: logging a meal moves a macro ring', async ({ page }) => {
      await seed(page, { settings: [{ key: 'food.targets', value: { calories: 3000, protein: 150 } }] })
      await page.goto('/#/food')
      const kcal = page.getByTestId('ring-calories-value')
      await expect(kcal).toHaveText('0')
      const quick = page.getByLabel('Quick add a meal')
      await quick.fill('shake 600cal 40p')
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(kcal).toHaveText('600')
      await expect(page.getByTestId('ring-calories-left')).toContainText('2,400')
      await expect(page.getByTestId('ring-protein-value')).toHaveText('40')
    })

    test('Money: overview shows safe to spend with seeded budgets', async ({ page }) => {
      await seed(page, {
        budgets: [{ category: 'Groceries', monthlyLimit: 400 }, { category: 'Dining', monthlyLimit: 200 }],
        transactions: [{ date: iso(new Date()), amount: -50, description: 'Fictional Market', category: 'Groceries' }],
      })
      await page.goto('/#/finance')
      await expect(page.getByTestId('safe-hero')).toBeVisible()
      await expect(page.getByTestId('safe-inputs')).toContainText('$600 budget')
      await expect(page.getByTestId('safe-left')).toContainText('550')
      // Budgets tab shows the health bars with a state in words.
      await page.getByRole('tab', { name: 'Budgets' }).click()
      await expect(page.getByText('On pace').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    })
  })
}

test.describe('G3 phone only', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('Money: a transaction row opens the category sheet', async ({ page }) => {
    await seed(page, { transactions: [{ date: iso(new Date()), amount: -12.5, description: 'Fictional Cafe', category: 'Uncategorized' }] })
    await page.goto('/#/finance')
    await page.getByRole('tab', { name: /Transactions/ }).click()
    await page.getByRole('button', { name: /Fictional Cafe/ }).click()
    const sheet = page.getByRole('dialog', { name: 'Categorize' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Dining', exact: true }).click()
    await expect(page.getByRole('button', { name: /Fictional Cafe, Dining/ })).toBeVisible()
  })

  test('Food: no horizontal scroll and the quick-add stays above the bottom bar', async ({ page }) => {
    await seed(page, { settings: [{ key: 'food.targets', value: { calories: 3000, protein: 150 } }] })
    await page.goto('/#/food')
    const quick = page.getByLabel('Quick add a meal')
    await expect(quick).toBeVisible()
    const q = await quick.boundingBox()
    const bar = await page.getByRole('navigation', { name: 'Districts' }).boundingBox()
    expect(q!.y + q!.height).toBeLessThanOrEqual(bar!.y + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
