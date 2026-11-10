// Learn tab: open a lesson, answer the check, mark it complete, and see progress update.
import { expect, test } from '@playwright/test'

test('learn: open lesson, answer the check, complete it, progress updates', async ({ page }) => {
  await page.goto('/#/finance')
  await page.getByRole('tab', { name: 'Learn' }).click()
  await expect(page.getByText('0 of 34 lessons')).toBeVisible()
  await page.getByRole('button', { name: /^How markets work/ }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'How markets work' })).toBeVisible()
  await expect(page.getByText('Education, not advice.')).toBeVisible()

  const answers = [1, 1, 1]
  const groups = page.locator('fieldset')
  for (let i = 0; i < answers.length; i++) await groups.nth(i).locator('label').nth(answers[i]).click()
  await expect(page.getByText('3 of 3 correct')).toBeVisible()
  await page.getByRole('button', { name: 'Retake check' }).click()
  await expect(page.getByText('3 of 3 correct')).toHaveCount(0)

  await page.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByText('Marked complete.')).toBeVisible()
  await page.getByRole('button', { name: 'All lessons' }).click()
  await expect(page.getByText('1 of 34 lessons')).toBeVisible()
  await expect(page.getByRole('button', { name: /^How markets work.*complete/ })).toBeVisible()
})
