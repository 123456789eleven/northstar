// Phase G4: Mind (Journal, Learning), Career, People. Fictional data only. Run at phone and desktop widths.
import { expect, test, type Page } from '@playwright/test'

const sizes = [
  { name: 'phone 390', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'desktop 1440', viewport: { width: 1440, height: 900 }, touch: false },
]

async function noHScroll(page: Page) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(over).toBeLessThanOrEqual(0)
}

for (const s of sizes) {
  test.describe(s.name, () => {
    test.use({ viewport: s.viewport, hasTouch: s.touch })

    test('Learning: a focus run logs minutes and Undo takes them back', async ({ page }) => {
      await page.clock.install()
      await page.goto('/#/learning')
      await page.getByRole('button', { name: 'Add item' }).click()
      const modal = page.getByRole('dialog', { name: 'Add learning item' })
      await modal.getByLabel('Title').fill('Fixture Spreadsheet Course')
      await modal.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(modal).toBeHidden()
      await expect(page.getByTestId('study-ring').getByRole('img')).toHaveAttribute('aria-label', /^0m of/)

      await page.getByRole('button', { name: 'Start focus on Fixture Spreadsheet Course' }).click()
      const sheet = page.getByTestId('focus-sheet')
      await sheet.getByRole('button', { name: '25 min' }).click()
      await sheet.getByRole('button', { name: 'Begin' }).click()
      await page.clock.fastForward(3 * 60_000 + 5_000)
      await expect(sheet.getByRole('timer')).toHaveText(/^03:0\d$/)
      await sheet.getByRole('button', { name: 'Pause' }).click()
      await page.clock.fastForward(10 * 60_000)
      await sheet.getByRole('button', { name: 'Resume' }).click()
      await sheet.getByRole('button', { name: 'Stop and log' }).click()

      await expect(page.getByText('Logged 3m on Fixture Spreadsheet Course')).toBeVisible()
      await expect(page.getByTestId('study-ring').getByRole('img')).toHaveAttribute('aria-label', /^3m of/)
      await page.getByRole('button', { name: 'Undo' }).click()
      await expect(page.getByTestId('study-ring').getByRole('img')).toHaveAttribute('aria-label', /^0m of/)
      await noHScroll(page)
    })

    test('Career: the case meter rises after logging a win', async ({ page }) => {
      await page.goto('/#/career')
      const score = page.getByTestId('case-score')
      await expect(score).toHaveAttribute('data-score', '0')
      await expect(page.getByText('Next: ')).toBeVisible()
      await page.getByRole('button', { name: 'Log a win' }).first().click()
      await page.getByLabel('Log a win', { exact: true }).fill('Fixture: shipped the handoff checklist #reliability')
      await page.getByRole('button', { name: 'Log win', exact: true }).click()
      await expect(page.getByText('Win logged')).toBeVisible()
      await expect.poll(async () => Number(await score.getAttribute('data-score'))).toBeGreaterThan(0)
      await page.getByText('How this is scored').click()
      await expect(page.getByText('Five parts, 20 points each')).toBeVisible()
      await noHScroll(page)
    })

    test('People: a person with a cadence shows on the tree and opens Details', async ({ page }) => {
      await page.goto('/#/people')
      await page.getByRole('button', { name: 'Add your first person' }).click()
      const form = page.getByRole('dialog', { name: 'Add a person' })
      await form.getByLabel('Name').fill('Fixture Ingrid Vale')
      await form.getByText('Weekly', { exact: true }).click()
      await form.getByRole('button', { name: 'Add person' }).click()
      await expect(form).toBeHidden()
      const dot = page.getByTestId('people-tree').getByRole('button', { name: /Fixture Ingrid Vale/ })
      await expect(dot).toBeVisible()
      await expect(page.getByTestId('reach-out')).toContainText('Fixture Ingrid Vale')
      await dot.click({ force: true })
      await expect(page.getByRole('dialog', { name: 'Fixture Ingrid Vale' })).toBeVisible()
      await noHScroll(page)
    })

    test('People: branches by relation, add to a branch, collapse, keyboard, list toggle', async ({ page }) => {
      await page.goto('/#/people')
      await page.getByRole('button', { name: 'Add your first person' }).click()
      const form = page.getByRole('dialog', { name: 'Add a person' })
      await form.getByLabel('Name').fill('Fixture Rhea Quill')
      await form.getByLabel('Relation').fill('sister')
      await form.getByRole('button', { name: 'Add person' }).click()
      const tree = page.getByTestId('people-tree')
      const branch = tree.getByRole('button', { name: /^Family, 1 person, expanded/ })
      await expect(branch).toBeVisible()
      await tree.getByRole('button', { name: 'Add a person to Family' }).click({ force: true })
      await expect(page.getByRole('dialog', { name: 'Add a person' }).getByLabel('Relation')).toHaveValue('Family')
      await page.getByRole('dialog', { name: 'Add a person' }).getByRole('button', { name: 'Cancel' }).click()
      await branch.focus()
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: 'Fixture Rhea Quill' })).toBeVisible()
      await page.getByRole('button', { name: 'Done' }).click()
      await branch.click({ force: true })
      await expect(tree.getByRole('button', { name: /Fixture Rhea Quill/ })).toHaveCount(0)
      await page.getByRole('tab', { name: 'List' }).click()
      await expect(page.getByText('Fixture Rhea Quill')).toBeVisible()
      await noHScroll(page)
    })

    test('Journal: the word ring fills as you type; Mind hub shows the overview', async ({ page }) => {
      await page.goto('/#/journal')
      const ring = page.getByRole('img', { name: /^Today's words: \d+ of \d+$/ })
      await expect(ring).toHaveAttribute('aria-label', /^Today's words: 0 of/)
      await page.getByLabel('Journal entry').fill('one two three four five six seven eight nine ten eleven twelve')
      await expect(ring).toHaveAttribute('aria-label', /^Today's words: 12 of/)
      await expect(page.getByTestId('journal-hero')).toBeVisible()
      await noHScroll(page)
      await page.goto('/#/mind')
      await expect(page.getByTestId('mind-overview')).toBeVisible()
      await expect(page.getByTestId('mood-preview')).toBeVisible()
      await noHScroll(page)
    })
  })
}
