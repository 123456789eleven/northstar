// Life map: renders, tapping a district opens its panel, keyboard works. Run at phone and desktop width.
import { expect, test } from '@playwright/test'

for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test.describe(`Life map at ${vp.width}`, () => {
    test.use({ viewport: vp })

    test('renders five districts and the accessible table', async ({ page }) => {
      await page.goto('/#/map')
      await expect(page.getByRole('heading', { name: 'Life map' })).toBeVisible()
      await expect(page.locator('.lm-hit')).toHaveCount(5)
      await expect(page.getByText('Prototype').first()).toBeVisible()
      await expect(page.locator('table.sr-only tbody tr')).toHaveCount(5)
    })

    test('tapping a district opens its panel with a link', async ({ page }) => {
      await page.goto('/#/map')
      await page.locator('.lm-hit[data-district="money"]').click()
      const panel = page.getByTestId('lifemap-panel')
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('heading', { name: 'Money' })).toBeVisible()
      await expect(panel.getByRole('link', { name: 'Open Money' })).toHaveAttribute('href', /finance/)
      await page.getByRole('button', { name: 'Close Money details' }).click()
      await expect(panel).toBeHidden()
    })

    test('keyboard: tab strip and Escape', async ({ page }) => {
      await page.goto('/#/map')
      const tab = page.locator('.lm-tab[data-tab="mind"]')
      await tab.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('lifemap-panel').getByRole('heading', { name: 'Mind' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('lifemap-panel')).toBeHidden()
      await page.locator('.lm-hit[data-district="people"]').focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('lifemap-panel').getByRole('heading', { name: 'People' })).toBeVisible()
    })
  })
}
