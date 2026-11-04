// Phase G2b: Goals quest log, Habits rings and the Plan hub overview, at phone and desktop widths. Fictional data only.
import { expect, test, type Page } from '@playwright/test'

const SIZES = [
  { name: '390x844', viewport: { width: 390, height: 844 }, touch: true },
  { name: '1440x900', viewport: { width: 1440, height: 900 }, touch: false },
]

async function noHScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

async function newHabit(page: Page, name: string) {
  await page.goto('/#/habits')
  await page.getByRole('button', { name: 'New habit' }).first().click()
  const modal = page.getByRole('dialog', { name: 'New habit' })
  await modal.getByLabel('Name').fill(name)
  await modal.getByRole('button', { name: 'Save' }).click()
  await expect(modal).toBeHidden()
}

for (const size of SIZES) {
  test.describe(`g2b at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: size.touch })

    test('Goals: adopt a boss from the empty state, check a milestone, link a weight metric and see HP', async ({ page }) => {
      await page.goto('/#/body')
      const weigh = page.getByLabel('Weight in pounds')
      await weigh.fill('180')
      await weigh.press('Enter')
      await expect(page.getByLabel('Weight in pounds')).toHaveAttribute('placeholder', /180/)

      await page.goto('/#/goals')
      await expect(page.getByText('Create your first boss')).toBeVisible()
      await page.getByRole('button', { name: 'Adopt this boss' }).first().click()
      const boss = page.getByTestId('boss-card').first()
      await expect(boss).toContainText('Run a 5K without stopping')
      await expect(boss.getByTestId('boss-hp')).toHaveText('HP 100%')
      await expect(boss).toContainText('Next step')
      await expect(boss).toContainText('Run 1 mile')
      await noHScroll(page)

      // Detail opens in a panel (side on desktop, bottom sheet on phone); checking a milestone drains HP.
      await boss.click()
      const panel = page.getByRole('dialog', { name: 'Run a 5K without stopping' })
      await expect(panel).toBeVisible()
      await panel.getByRole('checkbox', { name: 'Run 1 mile' }).click()
      await expect(boss.getByTestId('boss-hp')).toHaveText('HP 75%')
      await panel.getByRole('button', { name: 'Close Run a 5K without stopping' }).click()
      await expect(panel).toBeHidden()

      // A second boss tracked automatically from weight: live number and +5 lb flags.
      await page.getByRole('button', { name: 'New goal' }).click()
      const editor = page.getByRole('dialog', { name: /New quarter goal/ })
      await editor.getByLabel('Goal').fill('Reach 165 lb')
      await editor.getByLabel('Track automatically').selectOption('weight')
      await editor.getByLabel('Target (lb)').fill('165')
      await editor.getByRole('button', { name: 'Save' }).click()
      await expect(editor).toBeHidden()
      const weightBoss = page.locator('[data-testid=boss-card]', { hasText: 'Reach 165 lb' })
      await expect(weightBoss.getByTestId('boss-number')).toContainText('180 of 165 lb')
      await expect(weightBoss.getByTestId('boss-hp')).toHaveText('HP 100%')
      await expect(weightBoss.locator('.bossbar-label')).toHaveText(['175', '170', '165'])
      await noHScroll(page)
    })

    test('Habits: check in and the weekly ring updates', async ({ page }) => {
      await newHabit(page, 'Walk 20 minutes')
      await expect(page.getByTestId('today-habit')).toBeVisible()
      const card = page.getByTestId('habit-card')
      await expect(card.getByTestId('habit-ring-count')).toHaveText('0')
      if (size.touch) {
        const box = await page.getByTestId('today-habit').boundingBox()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }
      await card.getByRole('button', { name: /check in today/ }).click()
      await expect(card.getByTestId('habit-ring-count')).toHaveText('1')
      await expect(card.getByRole('img', { name: '1 of 7 this week' })).toBeVisible()
      await expect(page.getByTestId('today-habit')).toBeHidden() // no longer due today
      await noHScroll(page)

      // Month heat map in the detail panel.
      await card.getByRole('button', { name: /^Walk 20 minutes Health/ }).click()
      const panel = page.getByRole('dialog', { name: 'Walk 20 minutes' })
      await expect(panel.locator('.mheat-cell.on')).toHaveCount(1)
    })

    test('Plan hub: overview renders with data', async ({ page }) => {
      await page.goto('/#/goals')
      await page.getByRole('button', { name: 'Adopt this boss' }).first().click()
      await expect(page.getByTestId('boss-card').first()).toBeVisible()
      await newHabit(page, 'Stretch')
      await page.getByRole('button', { name: /check in today/ }).click()

      await page.goto('/#/plan')
      await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()
      await expect(page.getByRole('heading', { name: "This week's focus" })).toBeVisible()
      await expect(page.getByText('Open slot: pin a task')).toHaveCount(3)
      await expect(page.getByRole('heading', { name: 'Season boss' })).toBeVisible()
      await expect(page.locator('.plan-boss')).toContainText('Run a 5K without stopping')
      await expect(page.locator('.plan-boss')).toContainText('HP 100%')
      await expect(page.getByTestId('plan-ring')).toHaveText('1/7')
      await expect(page.getByRole('heading', { name: 'Next time block' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Quick links' }).getByRole('link', { name: 'Goals' })).toBeVisible()
      await noHScroll(page)
    })
  })
}
