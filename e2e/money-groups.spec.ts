// Money page: five groups with sub-tabs, remembered per group, and old deep links mapped onto them.
import { expect, test } from '@playwright/test'

const sel = (page: import('@playwright/test').Page, name: string) => page.getByRole('tab', { name, exact: true })

test('money: five groups, sub-tabs shown only for the active group and remembered', async ({ page }) => {
  await page.goto('/#/finance')
  for (const g of ['Overview', 'Markets', 'Cash', 'Wealth', 'Academy']) await expect(sel(page, g)).toBeVisible()
  await expect(sel(page, 'Budgets')).toHaveCount(0)

  await sel(page, 'Cash').click()
  await expect(sel(page, 'Transactions')).toHaveAttribute('aria-selected', 'true')
  await sel(page, 'Budgets').click()
  await expect(sel(page, 'Budgets')).toHaveAttribute('aria-selected', 'true')

  await sel(page, 'Wealth').click()
  await expect(sel(page, 'Net worth')).toBeVisible()
  await expect(sel(page, 'Budgets')).toHaveCount(0)
  await sel(page, 'Investments').click()

  await sel(page, 'Cash').click()
  await expect(sel(page, 'Budgets')).toHaveAttribute('aria-selected', 'true')
  await sel(page, 'Wealth').click()
  await expect(sel(page, 'Investments')).toHaveAttribute('aria-selected', 'true')
})

test('money: old ?tab= deep links open the right group and sub-tab', async ({ page }) => {
  const cases: [string, string, string][] = [
    ['budgets', 'Cash', 'Budgets'], ['networth', 'Wealth', 'Net worth'], ['investments', 'Wealth', 'Investments'],
    ['practice', 'Academy', 'Practice'], ['learn', 'Academy', 'Learn'],
  ]
  for (const [id, group, sub] of cases) {
    await page.goto(`/#/finance?tab=${id}`)
    await page.reload()
    await expect(sel(page, group)).toHaveAttribute('aria-selected', 'true')
    await expect(sel(page, sub)).toHaveAttribute('aria-selected', 'true')
  }
  await page.goto('/#/finance?tab=markets')
  await page.reload()
  await expect(sel(page, 'Markets')).toHaveAttribute('aria-selected', 'true')
})
