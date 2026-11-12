// Bank: five floors in the elevator, no in-page tab strips, and old Money ?tab= deep links landing on the right floor.
import { expect, test } from '@playwright/test'

test('bank: the elevator rides the five floors', async ({ page }) => {
  await page.goto('/#/finance')
  const lift = page.getByRole('navigation', { name: 'Bank floors' })
  for (const f of ['Lobby', 'Vault', 'Trading floor', 'Academy', 'Archive']) await expect(lift.getByRole('link', { name: f })).toBeVisible()
  await expect(lift.getByRole('link', { name: 'Lobby' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('tab')).toHaveCount(0)
  await lift.getByRole('link', { name: 'Vault' }).click()
  await expect(page).toHaveURL(/#\/finance\/vault$/)
  await expect(lift.getByRole('link', { name: 'Vault' })).toHaveAttribute('aria-current', 'page')
  await lift.getByRole('link', { name: 'Archive' }).click()
  await expect(page).toHaveURL(/#\/finance\/archive$/)
  await expect(page.getByRole('link', { name: 'Import a file' })).toBeVisible()
  await expect(page.getByTestId('stage-meter')).toBeVisible()
})

test('bank: old ?tab= deep links open the right floor and view', async ({ page }) => {
  const cases: [string, RegExp, string][] = [
    ['overview', /#\/finance$/, 'Lobby'],
    ['budgets', /#\/finance\/vault$/, 'Vault'],
    ['markets', /#\/finance\/trading$/, 'Trading floor'],
    ['investments', /#\/finance\/trading\?view=holdings$/, 'Trading floor'],
    ['practice', /#\/finance\/academy\?view=practice$/, 'Academy'],
    ['learn', /#\/finance\/academy$/, 'Academy'],
    ['transactions', /#\/finance\/archive$/, 'Archive'],
    ['import', /#\/finance\/archive\?view=import$/, 'Archive'],
    ['networth', /#\/finance\/archive\?view=networth$/, 'Archive'],
  ]
  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  for (const [id, url, floor] of cases) {
    await page.goto(`/#/finance?tab=${id}`)
    await page.reload()
    await expect(page, id).toHaveURL(url)
    await expect(crumb.locator('[aria-current="page"]'), id).toHaveText(floor)
  }
})
