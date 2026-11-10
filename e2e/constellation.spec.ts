// Constellation shell (phase G1): hub navigation on phone and desktop, the capture orb, Home and Today, Calm mode and a
// quest that completes itself from real data. Fictional data only.
import { expect, test } from '@playwright/test'

test.describe('phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('bottom bar reaches its four tabs, You from the top bar, and the capture orb opens the sheet', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Main mobile' })
    await expect(bar).toBeVisible()

    await bar.getByRole('link', { name: 'Plan' }).click()
    await expect(page).toHaveURL(/#\/plan$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Plan sections' }).getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)

    await bar.getByRole('link', { name: 'Areas' }).click()
    await expect(page).toHaveURL(/#\/skills$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Areas' })).toBeVisible()

    await page.getByRole('link', { name: 'You', exact: true }).click()
    await expect(page).toHaveURL(/#\/you$/)
    await expect(page.getByRole('heading', { level: 1, name: 'You' })).toBeVisible()

    await bar.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByTestId('lifemap')).toBeVisible()

    // Tap targets: every bottom-bar control is at least 44px tall.
    for (const el of await bar.locator('a, button').all()) {
      const box = await el.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    await bar.getByRole('button', { name: 'Capture' }).click()
    const sheet = page.getByRole('dialog', { name: 'Capture' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Weigh-in' }).click()
    const line = sheet.getByLabel('Quick capture')
    await expect(line).toHaveValue('w ')
    await line.pressSequentially('137.2')
    await line.press('Enter')
    await expect(sheet.getByText(/137\.2/)).toBeVisible()
    await sheet.getByRole('button', { name: 'Close Capture' }).click()
    await expect(sheet).toBeHidden()

    // No horizontal scroll on the hubs at phone width.
    for (const r of ['/', '/today', '/plan', '/skills', '/mind', '/you', '/food']) {
      await page.goto('/#' + r)
      await expect(page.locator('.route-view')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  })
})

test('desktop 1440: rail with Home, Today and area groups; no right rail; old URLs sit inside their hub', async ({ page }) => {
  await page.goto('/')
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(rail).toBeVisible()
  for (const name of ['Home', 'Today', 'Plan', 'Body', 'Money', 'Mind', 'Career', 'People', 'Milestones', 'Settings']) {
    await expect(rail.getByRole('link', { name, exact: false }).first()).toBeVisible()
  }
  // The old right rail is gone: its season and week lines live in Home's Today tab.
  await expect(page.getByRole('complementary', { name: 'Plan and week' })).toHaveCount(0)
  const panel = page.getByTestId('home-panel')
  await expect(panel.getByRole('link', { name: /Q\d \d{4}/ })).toBeVisible()
  await expect(panel.getByRole('list', { name: /This week/ })).toBeVisible()
  await expect(page).toHaveTitle('Home | Northstar')
  await page.goto('/#/today')
  await expect(page).toHaveTitle('Today | Northstar')

  // /food keeps working and lights Body in the hub strip and Food in the sub-strip.
  await page.goto('/#/food')
  await expect(page.getByRole('navigation', { name: 'Areas sections' }).getByRole('link', { name: 'Body' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('navigation', { name: 'Body pages' }).getByRole('link', { name: 'Food' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveTitle('Food | Northstar')
})

test('Areas hub shows five rings with their inputs and a table view, no levels', async ({ page }) => {
  await page.goto('/#/skills')
  await expect(page.getByRole('heading', { level: 1, name: 'Areas' })).toBeVisible()
  await expect(page.locator('.area-card')).toHaveCount(5)
  await expect(page.getByText(/Level \d|XP/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Table view' }).click()
  await expect(page.getByRole('table', { name: 'Areas this week' })).toBeVisible()
})

test('a weigh-in quest completes itself when you log a weight', async ({ page }) => {
  await page.goto('/#/body')
  const capture = page.getByLabel('Quick capture')
  // A recent weigh-in (yesterday) makes "Weigh in" one of today's quests.
  await capture.fill('w 140.0 yesterday')
  await capture.press('Enter')
  await expect(page.locator('.topbar .qc-saved')).toBeVisible()
  await page.goto('/#/today')
  const quest = page.locator('[data-quest="weigh-in"]')
  await expect(quest).toBeVisible()
  await expect(quest).not.toHaveClass(/is-done/)
  await expect(quest).toContainText('not done yet')

  await capture.fill('w 139.6')
  await capture.press('Enter')
  await expect(quest).toHaveClass(/is-done/)
  await expect(quest).toContainText('(done)')
})

test('Settings > Progress: counting table and settings', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Show counting table' }).click()
  const table = page.getByRole('table', { name: 'Counting table' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row', { name: /Logged a weigh-in/ })).toContainText('+15')
  await page.getByRole('radio', { name: 'Reduced' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await page.getByLabel('Active days a week').selectOption('4')
  await expect(page.getByLabel('Active days a week')).toHaveValue('4')
  await expect(page.getByRole('switch', { name: 'Haptics' })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('switch', { name: 'Calm mode' })).toHaveCount(0)
})
