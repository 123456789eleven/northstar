// Constellation shell (phase G1): hub navigation on phone and desktop, the capture orb, Home and Today, Calm mode and a
// quest that completes itself from real data. Fictional data only.
import { expect, test } from '@playwright/test'

test.describe('phone 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('district strip reaches every district, You from the top bar, and the capture orb opens the sheet', async ({ page }) => {
    await page.goto('/')
    const bar = page.getByRole('navigation', { name: 'Districts' })
    await expect(bar).toBeVisible()
    await expect(bar.getByRole('link')).toHaveText(['Home', 'Plan', 'Money', 'Body', 'Mind', 'Career', 'People'])

    await bar.getByRole('link', { name: 'Plan' }).click()
    await expect(page).toHaveURL(/#\/today$/)
    await expect(bar.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('navigation', { name: 'Town hall floors' }).getByRole('link', { name: 'Tasks' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)
    await expect(bar.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'true')

    await bar.getByRole('link', { name: 'Body' }).click()
    await expect(page).toHaveURL(/#\/body$/)
    await expect(bar.getByRole('link', { name: 'Body' })).toHaveAttribute('aria-current', 'page')
    await expect(bar.getByRole('link', { name: /^Plan/ })).toHaveAttribute('href', /#\/tasks$/)
    // Coming back to Plan returns to the last page there.
    await bar.getByRole('link', { name: 'Plan' }).click()
    await expect(page).toHaveURL(/#\/tasks$/)

    await page.getByRole('link', { name: 'You', exact: true }).click()
    await expect(page).toHaveURL(/#\/you$/)
    await expect(page.getByRole('heading', { level: 1, name: 'You' })).toBeVisible()
    await expect(bar.locator('[aria-current]')).toHaveCount(0)

    await bar.getByRole('link', { name: 'Home' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByTestId('lifemap')).toBeVisible()

    // Tap targets: every strip link is at least 32px tall.
    for (const el of await bar.locator('a').all()) {
      const box = await el.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(32)
    }

    await page.getByRole('button', { name: 'Capture' }).click()
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

test('desktop 1440: district strip is the primary nav; no right rail; old URLs sit inside their district', async ({ page }) => {
  await page.goto('/')
  const strip = page.getByRole('navigation', { name: 'Districts' })
  await expect(strip).toBeVisible()
  await expect(strip.getByRole('link')).toHaveText(['Home', 'Plan', 'Money', 'Body', 'Mind', 'Career', 'People'])
  await expect(strip.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  // Keyboard: arrows move along the strip.
  await strip.getByRole('link', { name: 'Home' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(strip.getByRole('link', { name: 'Plan' })).toBeFocused()
  await page.keyboard.press('End')
  await expect(strip.getByRole('link', { name: 'People' })).toBeFocused()
  // The old right rail is gone: its season and week lines live in Home's Today tab.
  await expect(page.getByRole('complementary', { name: 'Plan and week' })).toHaveCount(0)
  const panel = page.getByTestId('home-panel')
  await expect(panel.getByRole('link', { name: /Q\d \d{4}/ })).toBeVisible()
  await expect(panel.getByRole('list', { name: /This week/ })).toBeVisible()
  await expect(page).toHaveTitle('Home | Northstar')
  await page.goto('/#/today')
  await expect(page).toHaveTitle('Today | Northstar')

  // /food keeps working: Body lights in the strip, the Gym's Kitchen floor lights in the elevator.
  await page.goto('/#/food')
  await expect(strip.getByRole('link', { name: 'Body' })).toHaveAttribute('aria-current', 'true')
  const lift = page.getByRole('navigation', { name: 'Gym floors' })
  await expect(lift.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('aria-current', 'page')
  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(crumb.getByRole('link', { name: 'Gym' })).toHaveAttribute('href', /#\/body$/)
  await expect(crumb.locator('[aria-current="page"]')).toHaveText('Kitchen')
  // Arrow keys ride the elevator; aliases land on their floor.
  await lift.getByRole('link', { name: 'Kitchen' }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(lift.getByRole('link', { name: 'Training' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/training$/)
  await expect(lift.getByRole('link', { name: 'Training' })).toHaveAttribute('aria-current', 'page')
  await page.goto('/#/kitchen')
  await expect(page).toHaveURL(/#\/food$/)
  await page.goto('/#/food')
  await expect(page).toHaveTitle('Food | Northstar')
  // Bank floors are routes, so the head reads Bank / Trading floor and the strip returns there.
  await page.goto('/#/finance')
  await page.getByRole('navigation', { name: 'Bank floors' }).getByRole('link', { name: 'Trading floor' }).click()
  await expect(page).toHaveURL(/#\/finance\/trading$/)
  await expect(crumb.locator('[aria-current="page"]')).toHaveText('Trading floor')
  await strip.getByRole('link', { name: 'People' }).click()
  await expect(page.locator('.city-head')).toHaveAttribute('data-district', 'people')
  await expect(crumb.locator('[aria-current="page"]')).toHaveText('Tree')
  await expect(crumb).toHaveText(/Park\s*Tree/)
  await strip.getByRole('link', { name: 'Money' }).click()
  await expect(page).toHaveURL(/#\/finance\/trading$/)
  // An old Money deep link lands on its floor: Bank / Vault.
  await page.goto('/#/finance?tab=budgets')
  await expect(page).toHaveURL(/#\/finance\/vault$/)
  await expect(crumb.locator('[aria-current="page"]')).toHaveText('Vault')
  // The mini-map lights the active district and goes where you tap.
  const mini = page.getByRole('group', { name: /City map, you are in Money/ })
  await expect(mini.getByRole('link', { name: 'Money' })).toHaveAttribute('aria-current', 'true')
  await mini.getByRole('link', { name: 'Career' }).click()
  await expect(page).toHaveURL(/#\/career$/)
  await expect(page.getByRole('group', { name: /you are in Career/ })).toBeVisible()
  await expect(page).toHaveTitle('Career | Northstar')
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
