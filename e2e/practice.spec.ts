// Practice tab: place a paper trade by hand, undo it, then write a journal entry.
import { expect, test } from '@playwright/test'

test('Practice: paper trade end to end and a journal entry', async ({ page }) => {
  await page.goto('/#/finance/academy')
  await page.getByRole('link', { name: 'Trade', exact: true }).click()
  await expect(page.getByText(/Paper account: simulated money/).first()).toBeVisible()
  await expect(page.getByText('Take your first practice trade')).toBeVisible()

  const ticket = page.locator('form.pr-form')
  await ticket.getByLabel('Symbol').fill('vti')
  await ticket.getByLabel('Quantity').fill('3.5')
  await ticket.getByLabel('Price', { exact: true }).fill('200')
  await ticket.getByRole('button', { name: 'Place paper buy' }).click()
  await expect(page.getByText('Paper bought 3.5 VTI')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'VTI' })).toBeVisible()
  await expect(page.getByText('$99,300').first()).toBeVisible() // 100000 - 700 cash, equity unchanged at cost
  await expect(page.locator('.pr-equity')).toHaveText('$100,000')

  // Overselling gives a plain message.
  await ticket.getByRole('button', { name: 'Sell' }).click()
  await ticket.getByLabel('Quantity').fill('10')
  await ticket.getByRole('button', { name: 'Place paper sell' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'You only hold 3.5 of VTI' })).toBeVisible()

  // Undo the session trade from the history list.
  await page.getByRole('button', { name: 'Undo', exact: true }).last().click()
  await expect(page.getByText('No open positions.')).toBeVisible()

  await page.getByRole('link', { name: /Academy/ }).first().click()
  await page.getByRole('link', { name: 'Write', exact: true }).click()
  await page.getByRole('button', { name: 'New entry' }).first().click()
  const dlg = page.getByRole('dialog', { name: 'New journal entry' })
  await dlg.getByRole('button', { name: 'Save entry' }).click()
  await expect(dlg.getByText(/Write the thesis/)).toBeVisible()
  await dlg.getByLabel('Symbol').fill('vti')
  await dlg.getByLabel('Thesis').fill('Broad market pullback to the 50 day')
  await dlg.getByLabel('Tags').fill('pullback')
  await dlg.getByRole('button', { name: 'Save entry' }).click()
  await expect(dlg).toBeHidden()
  await expect(page.getByText('Broad market pullback to the 50 day')).toBeVisible()
  await page.getByLabel('Search journal').fill('nomatch')
  await expect(page.getByText('No entries match.')).toBeVisible()
})
