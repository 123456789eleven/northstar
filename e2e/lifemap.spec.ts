// Home is the Life map: the city renders, the district strip focuses a district and switches the breakout panel (one tab at a
// time), keyboard works, the phone gets a bottom sheet, and Today still lives at /today. Fresh profile, no data.
import { expect, test } from '@playwright/test'

test.describe('Home at 1440', () => {
  test('loads the map as the main screen, with a quiet first-run city and the accessible table', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('lifemap')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Northstar' })).toBeVisible()
    await expect(page).toHaveTitle('Home | Northstar')
    await expect(page.locator('.lm-hit')).toHaveCount(5)
    await expect(page.locator('table.sr-only tbody tr')).toHaveCount(5)
    const overview = page.getByRole('region', { name: 'Overview' })
    for (const label of ['Net worth', "Today's plan", 'Calories', 'To contact']) await expect(overview.getByText(label, { exact: true })).toBeVisible()
    await expect(overview.getByText(/Your city is quiet/)).toBeVisible()
    await expect(overview.getByRole('button', { name: 'Load demo data' })).toBeVisible()
    // /map stays an alias.
    await page.goto('/#/map')
    await expect(page.getByTestId('lifemap')).toBeVisible()
    await expect(page).toHaveTitle('Home | Northstar')
  })

  test('a panel tab focuses its district and switches the right panel; only one tab shows', async ({ page }) => {
    await page.goto('/')
    const panel = page.getByTestId('home-panel')
    const strip = panel
    await expect(page.getByTestId('home-tabpanel')).toHaveCount(1)
    await expect(panel.getByRole('heading', { name: "Today's plan" })).toBeVisible()
    await expect(panel.getByRole('link', { name: /Open Today/ })).toHaveAttribute('href', /#\/today$/)

    await strip.getByRole('tab', { name: 'Money' }).click()
    await expect(strip.getByRole('tab', { name: 'Money' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('.lm-hit[data-district="money"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'money')
    await expect(panel.getByRole('tab', { name: 'Money' })).toHaveAttribute('aria-selected', 'true')
    await expect(panel.getByRole('link', { name: /Open Money/ })).toHaveAttribute('href', /finance/)
    await expect(panel.getByRole('heading', { name: "Today's plan" })).toHaveCount(0)
    await expect(page.getByTestId('home-tabpanel')).toHaveCount(1)

    await strip.getByRole('tab', { name: 'People' }).click()
    await expect(panel.getByRole('heading', { name: 'Reach out soon' })).toBeVisible()
    await expect(panel.getByText(/Safe to spend|Spent this month/)).toHaveCount(0)

    // Tapping a district on the map does the same; Overview goes back to Today.
    await page.locator('.lm-hit[data-district="body"]').click()
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'body')
    await strip.getByRole('tab', { name: 'Today' }).click()
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'today')
    await expect(page.locator('.lm-hit[aria-pressed="true"]')).toHaveCount(0)

    // The panel collapses and comes back.
    await panel.getByRole('button', { name: 'Hide panel' }).click()
    await expect(panel).toBeHidden()
    await page.getByRole('button', { name: /Show panel/ }).click()
    await expect(page.getByTestId('home-panel')).toBeVisible()
  })

  test('keyboard: arrows move along the panel tabs, Enter on a district focuses it, Escape clears', async ({ page }) => {
    await page.goto('/')
    const strip = page.getByTestId('home-panel')
    await strip.getByRole('tab', { name: 'Today' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(strip.getByRole('tab', { name: 'Money' })).toBeFocused()
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'money')
    await page.keyboard.press('End')
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'people')

    await page.locator('.lm-hit[data-district="mind"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'mind')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'today')

    const viewport = page.getByRole('group', { name: /Life map/ })
    await viewport.focus()
    await page.keyboard.press('+')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('0')
    await expect(page.locator('.lm-hit')).toHaveCount(5)
  })

  test('/today still works', async ({ page }) => {
    await page.goto('/#/today')
    await expect(page).toHaveTitle('Today | Northstar')
    await expect(page.getByRole('heading', { name: /Today's plan|Plan done/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Focus' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Districts' }).getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('navigation', { name: 'Plan sections' }).getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')
  })
})

test.describe('Home at 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test('the panel is a bottom sheet with the same tabs; the map above it stays usable', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('lifemap')).toBeVisible()
    const sheet = page.getByTestId('home-panel')
    await expect(sheet).toBeVisible()
    await sheet.getByRole('tab', { name: 'Body' }).click()
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'body')
    await expect(page.locator('.lm-hit[data-district="body"]')).toHaveAttribute('aria-pressed', 'true')

    const grab = sheet.getByRole('button', { name: 'Expand details' })
    await grab.click()
    await expect(sheet.getByRole('button', { name: 'Shrink details' })).toHaveAttribute('aria-expanded', 'true')
    await sheet.getByRole('button', { name: 'Shrink details' }).click()

    // A district above the sheet can still be tapped.
    await page.locator('.lm-hit[data-district="money"]').tap()
    await expect(page.getByTestId('home-tabpanel')).toHaveAttribute('data-tab', 'money')

    // The district strip sits below the sheet: Home, Plan, Money, Body, Mind, Career, People.
    const bar = page.getByRole('navigation', { name: 'Districts' })
    await expect(bar.getByRole('link')).toHaveText(['Home', 'Plan', 'Money', 'Body', 'Mind', 'Career', 'People'])
    const sb = (await sheet.boundingBox())!
    expect(sb.y + sb.height).toBeLessThanOrEqual((await bar.boundingBox())!.y + 16)
    for (const el of await sheet.getByRole('tab').all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(32)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
})
