// Playwright e2e config. Needs @playwright/test installed (see docs/dev-setup.md); not part of typecheck/build.
import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    channel: 'chrome',
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
  },
  // Serves the production build (run `npm run build` first). Each test gets a fresh browser context, so a fresh IndexedDB.
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
