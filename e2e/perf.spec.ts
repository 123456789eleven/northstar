// The game engine loads lazily: it is fetched on Today and on Home (idle / board mount) (the Calm switch is retired).
import { expect, test } from '@playwright/test'

test('engine chunk loads on Today and the mission board fills in', async ({ page }) => {
  const seen: string[] = []
  page.on('request', (r) => seen.push(r.url()))
  await page.goto('/#/today')
  await expect(page.getByRole('heading', { name: /Today's plan|Plan done/ })).toBeVisible()
  expect(seen.some((u) => u.includes('/EngineHost-'))).toBe(true)
})
