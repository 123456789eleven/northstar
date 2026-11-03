// Constellation shell (phase G1): hub navigation on phone and desktop, the capture orb, the mission rail, Calm mode and a
// quest that completes itself from real data. Fictional data only.
import { expect, test } from '@playwright/test'

test.describe('phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('bottom bar reaches all five items and the capture orb opens the sheet', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Main mobile' })
    await expect(bar).toBeVisible()

    await bar.getByRole('link', { name: 'Plan' }).click()
    await expect(page).toHaveURL(/#\/plan$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Plan sections' }).getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)

    await bar.getByRole('link', { name: 'Skills' }).click()
    await expect(page).toHaveURL(/#\/skills$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Skills' })).toBeVisible()

    await bar.getByRole('link', { name: 'You' }).click()
    await expect(page).toHaveURL(/#\/you$/)
    await expect(page.getByRole('heading', { level: 1, name: 'You' })).toBeVisible()

    await bar.getByRole('link', { name: 'Today' }).click()
    await expect(page).toHaveURL(/#\/$/)

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
    for (const r of ['/', '/plan', '/skills', '/mind', '/you', '/food']) {
      await page.goto('/#' + r)
      await expect(page.locator('.route-view')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    }
  })
})

test('desktop 1440: rail with skill groups and the mission rail are visible; old URLs sit inside their hub', async ({ page }) => {
  await page.goto('/')
  const rail = page.getByRole('navigation', { name: 'Main' })
  await expect(rail).toBeVisible()
  for (const name of ['Today', 'Plan', 'Body', 'Money', 'Mind', 'Career', 'People', 'Trophies', 'Settings']) {
    await expect(rail.getByRole('link', { name, exact: false }).first()).toBeVisible()
  }
  const mission = page.getByRole('complementary', { name: 'Mission' })
  await expect(mission).toBeVisible()
  await expect(mission.getByText('Northstar level')).toBeVisible()
  await expect(mission.getByRole('progressbar').first()).toBeVisible()

  // /food keeps working and lights Body in the hub strip and Food in the sub-strip.
  await page.goto('/#/food')
  await expect(page.getByRole('navigation', { name: 'Skills sections' }).getByRole('link', { name: 'Body' })).toHaveAttribute('aria-current', 'true')
  await expect(page.getByRole('navigation', { name: 'Body pages' }).getByRole('link', { name: 'Food' })).toHaveAttribute('aria-current', 'page')
  await expect(page).toHaveTitle('Food | Northstar')

  // Below 1280px the mission rail collapses.
  await page.setViewportSize({ width: 1180, height: 900 })
  await expect(mission).toBeHidden()
})

test('Calm mode hides the game layer and keeps the useful Today', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Today's missions" })).toBeVisible()
  await page.goto('/#/settings')
  const calm = page.getByRole('switch', { name: 'Calm mode' })
  await calm.click()
  await expect(calm).toHaveAttribute('aria-checked', 'true')
  await page.goto('/')
  await expect(page.getByText('Your day')).toBeVisible()
  await expect(page.getByRole('heading', { name: "Today's missions" })).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Mission' })).toHaveCount(0)
  await expect(page.locator('.nav-pip')).toHaveCount(0)
  await page.goto('/#/skills')
  await expect(page.getByRole('heading', { level: 1, name: 'Skills' })).toBeVisible()
  await expect(page.locator('.constellation')).toHaveCount(0)
})

test('a weigh-in quest completes itself when you log a weight', async ({ page }) => {
  await page.goto('/#/body')
  const capture = page.getByLabel('Quick capture')
  // A recent weigh-in (yesterday) makes "Weigh in" one of today's quests.
  await capture.fill('w 140.0 yesterday')
  await capture.press('Enter')
  await expect(page.locator('.topbar .qc-saved')).toBeVisible()
  await page.goto('/')
  const quest = page.locator('.mission [data-quest="weigh-in"]')
  await expect(quest).toBeVisible()
  await expect(quest).not.toHaveClass(/is-done/)
  await expect(quest).toContainText('not done yet')

  await capture.fill('w 139.6')
  await capture.press('Enter')
  await expect(quest).toHaveClass(/is-done/)
  await expect(quest).toContainText('(done)')
  await expect(quest).toContainText('+15')
})

test('Settings > Game: XP table and settings', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Show XP table' }).click()
  const table = page.getByRole('table', { name: 'XP table' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row', { name: /Logged a weigh-in/ })).toContainText('+15')
  await page.getByRole('radio', { name: 'Reduced' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')
  await page.getByLabel('Active days a week').selectOption('4')
  await expect(page.getByLabel('Active days a week')).toHaveValue('4')
  await expect(page.getByRole('switch', { name: 'Haptics' })).toHaveAttribute('aria-checked', 'false')
})
