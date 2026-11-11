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
  await page.getByRole('tab', { name: 'Cash' }).click()
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
  await page.getByRole('combobox', { name: /Search tasks/ }).fill('Money')
  await palette.getByRole('option', { name: /Money/ }).first().click()
  await expect(page).toHaveURL(/#\/finance/)
})

test('Career: log a win and see it listed', async ({ page }) => {
  await page.goto('/#/career')
  await page.getByLabel('Log a win').fill('Fixture shipped the new checklist #reliability #impact 3h/week')
  await page.getByRole('button', { name: 'Log win' }).click()
  await expect(page.getByRole('list', { name: 'Wins' }).getByText('Fixture shipped the new checklist')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Wins' }).getByText('3h/week')).toBeVisible()
})

test('Goals: track a goal automatically from weight and see the live number', async ({ page }) => {
  await page.goto('/#/body')
  const capture = page.getByLabel('Quick capture')
  await capture.fill('w 138.2')
  await capture.press('Enter')
  await expect(page.getByLabel('Weight in pounds')).toHaveAttribute('placeholder', /138\.2/)

  await page.goto('/#/goals')
  await page.getByRole('button', { name: 'Create your first life goal' }).click()
  const editor = page.getByRole('dialog', { name: /New life goal/ })
  await editor.getByLabel('Goal').fill('Reach 165 lb')
  await editor.getByLabel('Track automatically').selectOption('weight')
  await editor.getByLabel('Target (lb)').fill('165')
  await editor.getByRole('button', { name: 'Save' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByTestId('goal-metric')).toContainText('138.2 of 165 lb')
})

async function searchFor(page: import('@playwright/test').Page, text: string, optionName: RegExp) {
  await expect(page.getByRole('button', { name: /^Search/ }).first()).toBeVisible()
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Search and commands' })
  await expect(palette).toBeVisible()
  await page.getByRole('combobox', { name: /Search tasks/ }).fill(text)
  await palette.getByRole('option', { name: optionName }).first().click()
  await expect(palette).toBeHidden()
}

test('Search deep link: a person opens with their details', async ({ page }) => {
  await page.goto('/#/people')
  await page.getByRole('button', { name: 'Add your first person' }).click()
  const form = page.getByRole('dialog', { name: 'Add a person' })
  await form.getByLabel('Name').fill('Fixture Wendell Marsh')
  await form.getByRole('button', { name: 'Add person' }).click()
  await expect(form).toBeHidden()
  await page.goto('/#/home')
  await searchFor(page, 'Wendell', /Fixture Wendell Marsh/)
  await expect(page).toHaveURL(/#\/people$/) // focus param is consumed and cleared
  await expect(page.getByRole('dialog', { name: 'Fixture Wendell Marsh' })).toBeVisible()
  // A second search for the same person works again, and a missing record only toasts.
  await page.goto('/#/people?focus=99999')
  await expect(page.getByText('That one has gone')).toBeVisible()
})

test('Search deep link: a task opens in the task panel', async ({ page }) => {
  await page.goto('/#/tasks')
  await page.getByLabel('New task').fill('Fixture renew library card')
  await page.getByLabel('New task').press('Enter')
  await expect(page.locator('.task-row', { hasText: 'Fixture renew library card' })).toBeVisible()
  await page.goto('/#/habits')
  await searchFor(page, 'library card', /Fixture renew library card/)
  await expect(page).toHaveURL(/#\/tasks$/)
  await expect(page.locator('.task-row.selected')).toContainText('Fixture renew library card')
  await expect(page.locator('.task-row.focus-flash')).toBeVisible()
})

test('Settings: encrypted backup round trip (export, erase, import with passphrase)', async ({ page }) => {

  const pass = 'fixture passphrase 123'
  await page.goto('/#/body')
  const capture = page.getByLabel('Quick capture')
  await capture.fill('w 141.2')
  await capture.press('Enter')
  await expect(page.getByLabel('Weight in pounds')).toHaveAttribute('placeholder', /141\.2/)

  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Export encrypted backup' }).click()
  const exp = page.getByRole('dialog', { name: 'Export encrypted backup' })
  await expect(exp.getByText(/cannot be recovered/)).toBeVisible()
  await exp.getByLabel(/^Passphrase/).fill(pass)
  await exp.getByLabel('Confirm passphrase').fill(pass)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exp.getByRole('button', { name: 'Encrypt and download' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^northstar-backup-\d{4}-\d{2}-\d{2}\.enc\.json$/)
  const saved = test.info().outputPath('backup.enc.json')
  await download.saveAs(saved)
  await expect(page.getByText(/rows, encrypted/)).toBeVisible()

  await page.getByRole('button', { name: 'Erase all data…' }).click()
  const erase = page.getByRole('dialog', { name: 'Erase all data' })
  await erase.getByLabel('Type ERASE to confirm').fill('ERASE')
  await erase.getByRole('button', { name: 'Erase everything' }).click()
  await expect(erase).toBeHidden()

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Import backup/ }).click(),
  ])
  await chooser.setFiles(saved)
  const unlock = page.getByRole('dialog', { name: 'Unlock encrypted backup' })
  await unlock.getByLabel(/^Passphrase/).fill('wrong passphrase here')
  await unlock.getByRole('button', { name: 'Unlock' }).click()
  await expect(unlock.getByText('Wrong passphrase or damaged file.')).toBeVisible()
  await unlock.getByLabel(/^Passphrase/).fill(pass)
  await unlock.getByRole('button', { name: 'Unlock' }).click()
  await page.getByRole('dialog', { name: 'Restore this backup?' }).getByRole('button', { name: 'Replace and restore' }).click()
  await expect(page.getByText(/Restored backup from/)).toBeVisible()

  await page.goto('/#/body')
  await expect(page.getByLabel('Weight in pounds')).toHaveAttribute('placeholder', /141\.2/)
})
