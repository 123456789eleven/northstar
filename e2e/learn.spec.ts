// Learn tab: open a lesson, answer the check, mark it complete, and see progress update.
import { expect, test } from '@playwright/test'

test('learn: open lesson, answer the check, complete it, progress updates', async ({ page }) => {
  await page.goto('/#/finance/academy')
  await expect(page.getByText('0 of 34 lessons')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Foundations: 0 of 8' })).toBeVisible()
  await page.getByRole('link', { name: 'Start lesson' }).click()
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
  // The track ring beside the lesson fills; back on the floor the count and the ring move.
  await expect(page.getByRole('img', { name: '1 of 8 lessons in this track' })).toBeVisible()
  await page.getByRole('link', { name: /Academy/ }).first().click()
  await expect(page.getByText('1 of 34 lessons')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Foundations: 1 of 8' })).toBeVisible()
  await page.getByRole('link', { name: /^Foundations/ }).click()
  await expect(page.getByRole('button', { name: /^How markets work.*complete/ })).toBeVisible()
})
