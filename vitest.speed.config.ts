import { defineConfig } from 'vitest/config'

// The speed check, run apart from the suite by `pnpm test:speed` and the speed job in CI: it builds
// the site, serves it as the ebdfy hosts do, and measures it against the budgets one file at a time,
// so one measurement never slows another.
export default defineConfig({
  test: {
    name: 'speed',
    include: ['test/speed/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    // The numbers are the point of the check, so they print on every run, passing or not.
    reporters: ['default'],
    silent: false,
  },
})
