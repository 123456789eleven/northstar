// Scoreboard (/score): empty, first-run and lots-of-data states at phone and desktop width. Fictional data only.
import { expect, test, type Page } from '@playwright/test'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d }

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
}

async function noHScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

function lotsOfData() {
  const tasks = [], habitLogs = [], transactions = [], studySessions = [], balances = []
  for (let w = 0; w < 14; w++) {
    for (let k = 0; k <= (w % 4); k++) {
      const at = daysAgo(w * 7 + k + 8).toISOString()
      tasks.push({ title: `Fixture task ${w}-${k}`, priority: 2, status: 'done', doneAt: at, recurrence: 'none', createdAt: at })
    }
    habitLogs.push({ habitId: 1, date: iso(daysAgo(w * 7 + 9)) })
    transactions.push({ date: iso(daysAgo(w * 7 + 10)), amount: 50 * w - 300, description: 'Fixture', category: 'Misc' })
    studySessions.push({ itemId: 1, date: iso(daysAgo(w * 7 + 11)), minutes: 20 + w * 5 })
  }
  for (let m = 0; m < 4; m++) balances.push({ date: iso(daysAgo(90 - m * 25)), name: 'Fixture savings', kind: 'asset', balance: 4000 + m * 900 })
  return { tasks, habitLogs, transactions, studySessions, balances }
}

for (const vp of [{ name: '390', size: { width: 390, height: 844 }, touch: true }, { name: '1440', size: { width: 1440, height: 900 }, touch: false }]) {
  test.describe(`Scoreboard at ${vp.name}`, () => {
    test.use({ viewport: vp.size, hasTouch: vp.touch })

    test('first run explains how records appear', async ({ page }) => {
      await page.goto('/#/score')
      await expect(page.getByRole('heading', { level: 1, name: 'Scoreboard' })).toBeVisible()
      await expect(page.getByTestId('standing-headline')).toHaveText('No standing yet.')
      await expect(page.getByTestId('records-empty')).toContainText('A record appears')
      await expect(page.getByTestId('reel-empty')).toBeVisible()
      await noHScroll(page)
    })

    test('with history: standing, records, ghost, reel with end card and share image', async ({ page }) => {
      await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
      await seed(page, lotsOfData())
      await page.goto('/#/score')
      await page.reload()
      await expect(page.getByTestId('standing-headline')).toContainText('Top ')
      await expect(page.getByTestId('ghost-week')).toBeVisible()
      expect(await page.getByTestId('record').count()).toBeGreaterThan(2)
      await expect(page.getByTestId('reel-end')).toContainText("You're caught up.")
      await noHScroll(page)
      const first = page.getByTestId('highlight').first()
      if (await first.count()) {
        await first.scrollIntoViewIfNeeded()
        const dl = page.waitForEvent('download')
        await first.getByTestId('highlight-share').click()
        expect((await dl).suggestedFilename()).toMatch(/^northstar-highlight-.*\.png$/)
        await expect(first).toContainText('Image ready.')
      }
    })
  })
}
