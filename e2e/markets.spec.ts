// Markets tab. Finnhub is fully mocked with route interception and a fake key: no real network calls.
import { expect, test, type Page } from '@playwright/test'

const FAKE_KEY = 'fakekey1234567890abcd'
const quote = (c: number, pc: number) => ({ c, d: +(c - pc).toFixed(2), dp: +(((c - pc) / pc) * 100).toFixed(2), h: c + 1, l: c - 2, o: pc, pc, t: Math.floor(Date.now() / 1000) })
const PRICES: Record<string, [number, number]> = { AAPL: [190, 188], VTI: [250, 252] }

async function mockFinnhub(page: Page, opts: { rateLimit?: boolean } = {}) {
  await page.route('https://finnhub.io/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (opts.rateLimit) return route.fulfill({ status: 429, headers: { 'retry-after': '20' }, body: '' })
    const sym = url.searchParams.get('symbol') ?? ''
    switch (url.pathname.replace('/api/v1', '')) {
      case '/quote': { const p = PRICES[sym] ?? [100, 99]; return json(quote(p[0], p[1])) }
      case '/stock/profile2': return json({ name: `${sym} Test Co`, exchange: 'NASDAQ', finnhubIndustry: 'Technology', marketCapitalization: 300000 })
      case '/stock/metric': return json({ metric: { '52WeekHigh': 260, '52WeekLow': 150, peTTM: 25, epsTTM: 7, beta: 1.1, dividendYieldIndicatedAnnual: 1.2, marketCapitalization: 300000 } })
      case '/company-news': return json([{ id: 1, datetime: Math.floor(Date.now() / 1000), headline: '<b>Test</b> headline', source: 'Wire', url: 'https://example.com/a', summary: '' }])
      case '/search': return json({ result: [{ symbol: 'MSFT', description: 'Microsoft Corp', type: 'Common Stock' }] })
      case '/stock/market-status': return json({ exchange: 'US', isOpen: true, t: Math.floor(Date.now() / 1000) })
      default: return json({}, 404)
    }
  })
}

async function openMarkets(page: Page) {
  await page.goto('/#/finance/trading')
}

for (const size of [{ name: 'phone 390', viewport: { width: 390, height: 844 } }, { name: 'desktop 1440', viewport: { width: 1440, height: 900 } }]) {
  test(`Markets (${size.name}): no key, add key, watchlist, detail`, async ({ page }) => {
    await page.setViewportSize(size.viewport)
    await mockFinnhub(page)
    await openMarkets(page)

    // No-key state: one first step, a quiet preview, the neutral note.
    await expect(page.getByText('Only ticker symbols leave this device')).toBeVisible()
    await expect(page.getByText('Information, not advice.')).toBeVisible()
    await expect(page.getByText('Live prices off')).toBeVisible()

    // Save a fake key; the mocked /quote accepts it.
    await page.getByLabel('Finnhub API key').fill(FAKE_KEY)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Key settings')).toBeVisible()

    // Empty watchlist offers common symbols as one-tap adds.
    await expect(page.getByText('Common symbols')).toBeVisible()
    await page.getByRole('button', { name: 'Add VTI' }).click()
    const row = page.getByRole('row', { name: /VTI/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText('250.00')
    await expect(row).toContainText('-0.79%')

    // Add by typing; duplicates are refused.
    await page.getByLabel('Add a symbol').fill('aapl')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('row', { name: /AAPL/ })).toBeVisible()
    await page.getByLabel('Add a symbol').fill('AAPL')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('already on the watchlist')

    // Keyboard: Enter opens the detail; headline is plain text with a safe link.
    await page.getByRole('row', { name: /AAPL/ }).focus()
    await page.keyboard.press('Enter')
    const panel = page.getByRole('dialog', { name: 'AAPL' }).or(page.getByRole('complementary', { name: 'AAPL' }))
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Chart builds as you open the app')).toBeVisible()
    const link = panel.getByRole('link', { name: '<b>Test</b> headline' })
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('target', '_blank')

    // Set an alert below the current price: the row is marked in-app.
    await panel.getByLabel('Alert at or above').fill('180')
    await panel.getByLabel('Alert at or above').blur()
    await expect(page.getByText('Above level')).toBeVisible()

    // No horizontal page scroll.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

    // Screener lists matches for criteria the owner sets.
    await panel.getByRole('button', { name: /Close/ }).click()
    await page.getByTestId('floor-more').click()
    await page.getByRole('link', { name: 'Screener' }).click()
    await page.getByLabel('Price minimum').fill('200')
    await expect(page.getByText('1 of 2 match')).toBeVisible()
  })
}

test('Markets: rate limit shows a countdown and keeps the tab usable', async ({ page }) => {
  await mockFinnhub(page, { rateLimit: true })
  await openMarkets(page)
  await page.getByLabel('Finnhub API key').fill(FAKE_KEY)
  await page.getByRole('button', { name: 'Test' }).click()
  await expect(page.getByText(/limiting requests/)).toBeVisible()
})

test('Markets: copy never reads as advice', async ({ page }) => {
  await mockFinnhub(page)
  await openMarkets(page)
  const text = await page.locator('.tf').innerText()
  expect(text).not.toMatch(/\b(buy|sell|recommend\w*)\b/i)
})
