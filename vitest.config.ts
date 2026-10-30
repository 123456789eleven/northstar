import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    // Dates are local-time strings; pin the zone so DST/month math is deterministic.
    env: { TZ: 'America/New_York' },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/features/**/*.ts', 'src/db.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
      reporter: ['text-summary', 'text'],
    },
  },
})
