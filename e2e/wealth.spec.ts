// Wealth scoreboard: form guide, net worth headline, records, savings engine, wins feed. Fictional data only.
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

const seedAll = (page: Page) => seed(page, {
  budgets: [{ category: 'Groceries', monthlyLimit: 520 }],
  transactions: [
    { date: daysAgo(10), amount: -40, description: 'Fictional Market', category: 'Groceries' },
    { date: daysAgo(17), amount: -50, description: 'Fictional Market', category: 'Groceries' },
    { date: daysAgo(24), amount: -300, description: 'Fictional Market', category: 'Groceries' },
    { date: daysAgo(45), amount: 3000, description: 'Fictional Pay', category: 'Income' },
    { date: daysAgo(40), amount: -900, description: 'Fictional Rent', category: 'Housing' },
  ],
  balances: [
    { date: daysAgo(60), name: 'Checking', kind: 'asset', balance: 2000 },
    { date: daysAgo(30), name: 'Checking', kind: 'asset', balance: 2600 },
    { date: daysAgo(1), name: 'Checking', kind: 'asset', balance: 3900 },
  ],
  contributions: [{ date: daysAgo(5), amount: 250, account: 'Checking', kind: 'contribution' }],
})

for (const [name, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
  test.describe(name, () => {
    test.use({ viewport: size })

    test('overview: form guide with its rule, wins feed ends caught up', async ({ page }) => {
      await seedAll(page)
      await page.goto('/#/finance')
      const fg = page.getByTestId('form-guide')
      await expect(fg).toBeVisible()
      await expect(fg.getByRole('img', { name: /Loss/ }).first()).toBeVisible()
      await fg.getByText('How the marks work').click()
      await expect(page.getByTestId('fg-rule')).toContainText('Monday to Sunday')
      await expect(page.getByTestId('wins')).toContainText("You're caught up.")
    })

    test('wealth: net worth headline, high marker, next milestone, records', async ({ page }) => {
      await seedAll(page)
      await page.goto('/#/finance')
      await expect(page.getByTestId('networth-hero')).toContainText('$3,900')
      await expect(page.getByTestId('nw-high')).toBeVisible()
      await expect(page.getByTestId('nw-next')).toContainText('$4,000')
      await page.goto('/#/finance/archive')
      await expect(page.getByTestId('records')).toContainText('Biggest net worth jump')
      await expect(page.getByTestId('records')).toContainText('+$1,300')
    })

    test('investments: savings engine shows surplus, limit and an illustration', async ({ page }) => {
      await seedAll(page)
      await page.goto('/#/finance/archive')
      await page.getByTestId('floor-more').click()
      await page.getByRole('button', { name: 'Savings engine', exact: true }).click()
      const eng = page.getByTestId('savings-engine')
      await expect(eng).toContainText('Put it to work')
      await expect(page.getByTestId('invest-monthly')).toContainText('$83')
      await expect(page.getByTestId('projection')).toContainText('not a forecast')
    })
  })
}
