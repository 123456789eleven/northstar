// G5a (You hub: Trophies, Season, Intel, You, Settings): key flows at phone (390x844) and desktop (1440x900). Fictional data only.
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
  await page.reload()
}

async function noHScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
}

const milestones = [
  { at: daysAgo(1).toISOString(), area: 'career', kind: 'goal.done', title: 'Fixture: finished the onboarding guide', milestone: true },
  { at: daysAgo(20).toISOString(), area: 'learning', kind: 'goal.done', title: 'Fixture: completed the spreadsheet course', milestone: true },
  { at: daysAgo(3).toISOString(), area: 'health', kind: 'body.milestone', title: 'Fixture: first 5 lb down', milestone: true },
]

for (const vp of [{ name: '390', size: { width: 390, height: 844 }, touch: true }, { name: '1440', size: { width: 1440, height: 900 }, touch: false }]) {
  test.describe(`G5a at ${vp.name}`, () => {
    test.use({ viewport: vp.size, hasTouch: vp.touch })

    test('Trophies: shelf renders seeded milestones with rarity words and next trophies', async ({ page }) => {
      await seed(page, { events: milestones })
      await page.goto('/#/history')
      await expect(page.getByRole('heading', { name: 'Trophy shelf' })).toBeVisible()
      await expect(page.getByTestId('trophy-card')).toHaveCount(3)
      await expect(page.getByTestId('trophy-card').filter({ hasText: 'first 5 lb down' })).toContainText('Rare')
      await expect(page.getByTestId('trophy-card').filter({ hasText: 'onboarding guide' })).toContainText('Uncommon')
      await expect(page.getByTestId('trophy-card').filter({ hasText: 'first 5 lb down' })).toContainText('New')
      await expect(page.getByRole('list', { name: 'Next trophies' })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Timeline' })).toBeVisible()
      await noHScroll(page)
    })

    test('Season: boss header and story cards', async ({ page }) => {
      await seed(page, {
        goals: [{ title: 'Fixture quarter goal', area: 'career', horizon: 'quarter', status: 'active', milestones: [{ id: 'm1', title: 'Step one', done: true }, { id: 'm2', title: 'Step two', done: false }], createdAt: new Date().toISOString() }],
      })
      await page.goto('/#/review')
      await expect(page.getByRole('heading', { level: 1, name: 'Season' })).toBeVisible()
      const header = page.getByTestId('season-header')
      await expect(header).toContainText(/Q[1-4] \d{4}/)
      await expect(header).toContainText('Fixture quarter goal')
      await expect(header.getByRole('progressbar')).toBeVisible()
      if (vp.touch) {
        const stories = page.getByTestId('story-cards')
        await expect(stories.locator('article')).toHaveCount(5)
        const track = stories.locator('.story-track')
        await track.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'instant' as ScrollBehavior }))
        await expect(stories.getByRole('button', { name: /^Show / }).nth(1)).toHaveAttribute('aria-current', 'true')
      } else {
        await expect(page.getByText('Week in numbers')).toBeVisible()
      }
      await noHScroll(page)
    })

    test('Intel: accept an overdue-task proposal', async ({ page }) => {
      await seed(page, { tasks: [{ title: 'Fixture overdue chore', due: iso(daysAgo(4)), priority: 2, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() }] })
      await page.goto('/#/ops')
      await expect(page.getByRole('heading', { level: 1, name: 'Intel' })).toBeVisible()
      const card = page.getByRole('button', { name: /Reschedule .Fixture overdue chore/ })
      await expect(card).toBeVisible()
      await card.click()
      await page.getByRole('button', { name: 'Accept', exact: true }).click()
      await expect(card).toBeHidden()
      await noHScroll(page)
    })

    test('You hub: backup status and links', async ({ page }) => {
      await page.goto('/#/you')
      const backup = page.getByTestId('backup-status')
      await expect(backup).toContainText('No backup yet')
      await expect(backup.getByRole('button', { name: 'Export encrypted backup' })).toBeVisible()
      await expect(page.locator('.hub-grid').getByRole('link', { name: /Settings/ })).toBeVisible()
      await noHScroll(page)
    })

    test('Settings: Game is the first section card', async ({ page }) => {
      await page.goto('/#/settings')
      const first = page.locator('.set-page .set-anchor').first()
      await expect(first).toHaveAttribute('id', 'set-game')
      await expect(first.getByText('Calm mode')).toBeVisible()
      await noHScroll(page)
    })
  })
}
