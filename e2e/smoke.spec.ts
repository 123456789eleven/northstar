// Smoke flows against the real UI text. Run: npm run build && npx playwright test (see docs/dev-setup.md).
import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./fixtures/two-tx-one-balance.json', import.meta.url))

test('Settings: add from a data file (2 transactions, 1 balance)', async ({ page }) => {
  await page.goto('/#/settings')
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Add from a data file/ }).click(),
  ])
  await chooser.setFiles(fixture)
  const dialog = page.getByRole('dialog', { name: 'Add from this file?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Transactions: will add')).toBeVisible()
  await dialog.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dialog).toBeHidden()
  // The toast reports what was added, with an Undo.
  await expect(page.getByText(/2 transactions/)).toBeVisible()
})

test('Finance > Budgets: add a bill', async ({ page }) => {
  await page.goto('/#/finance')
  await page.getByRole('tab', { name: 'Budgets' }).click()
  await page.getByRole('button', { name: 'Add bill' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add bill' })
  await dialog.getByLabel('Name').fill('Fixture Car Insurance')
  await dialog.getByLabel('Amount per payment').fill('600')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Edit Fixture Car Insurance' })).toBeVisible()
})

test('Body: log a weight from the capture bar', async ({ page }) => {
  await page.goto('/#/body')
  const capture = page.getByLabel('Quick capture')
  await capture.fill('w 136.4')
  await capture.press('Enter')
  // The weight form now shows today's logged value in its placeholder.
  await expect(page.getByLabel('Weight in pounds')).toHaveAttribute('placeholder', /136\.4/)
})

test('Journal: enter Focus mode and exit with Esc', async ({ page }) => {
  await page.goto('/#/journal')
  await page.getByRole('button', { name: 'Focus', exact: true }).click()
  const focus = page.getByRole('dialog', { name: /Writing focus/ })
  await expect(focus).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(focus).toBeHidden()
})

test('Ctrl+K palette: search and navigate', async ({ page }) => {
  await page.goto('/')
  // The Ctrl+K listener is attached when the shell mounts; wait for the Search trigger so the key press is not lost.
  await expect(page.getByRole('button', { name: /^Search/ }).first()).toBeVisible()
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search and commands' })
  await expect(palette).toBeVisible()
  await page.getByRole('combobox', { name: /Search tasks/ }).fill('Finance')
  await palette.getByRole('option', { name: /Finance/ }).first().click()
  await expect(page).toHaveURL(/#\/finance/)
})

test('Career: log a win and see it listed', async ({ page }) => {
  await page.goto('/#/career')
  await page.getByLabel('Log a win').fill('Fixture shipped the new checklist #reliability #impact 3h/week')
  await page.getByRole('button', { name: 'Log win' }).click()
  await expect(page.getByRole('list', { name: 'Wins' }).getByText('Fixture shipped the new checklist')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Wins' }).getByText('3h/week')).toBeVisible()
})
