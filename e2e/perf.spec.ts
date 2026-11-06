// The game engine loads lazily: it is fetched on Today (idle / board mount) but never while Calm mode is on.
import { expect, test } from '@playwright/test'

test('engine chunk loads on Today and the mission board fills in', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => seen.push(r.url()))
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: /Today's missions|Day cleared/ })).toBeVisible()
  expect(seen.some((u) => u.includes('/EngineHost-'))).toBe(true)
})

test('Calm mode never loads the engine chunk', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Calm mode').click()
  await expect(page.locator('html[data-calm="on"]')).toHaveCount(1)
  const seen: string[] = []
  page.on('request', (r) => seen.push(r.url()))
  await page.reload()
  await page.locator('h1.page-title').first().waitFor()
  await page.waitForTimeout(3500) // past the idle timeout
  expect(seen.some((u) => u.includes('/EngineHost-'))).toBe(false)
  await expect(page.getByRole('heading', { name: /Today's missions/ })).toHaveCount(0)
})
