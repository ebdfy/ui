import { playwright } from '@vitest/browser-playwright'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

import { playgroundApiPlugin } from './scripts/pages.ts'

// One fixture refuses to be framed, as an app sending X-Frame-Options: DENY does.
const refuseFraming: Plugin = {
  name: 'refuse-framing',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/test/browser/fixtures/refused.html')) res.setHeader('X-Frame-Options', 'DENY')
      next()
    })
  },
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['test/node/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // The browser project runs first and alone: beside this project's Chromiums and dev
          // servers, its tests that load a page into the modal sheet timed out at 15 s, one or more
          // a run, though they pass alone.
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          // Packing builds dist afresh, which the other projects' tests read and write, so it
          // waits until they have finished.
          name: 'package',
          include: ['test/package/**/*.test.ts'],
          environment: 'node',
          sequence: { groupOrder: 2 },
        },
      },
      {
        plugins: [refuseFraming, playgroundApiPlugin()],
        test: {
          name: 'browser',
          include: ['test/browser/**/*.test.ts'],
          setupFiles: ['./test/browser/setup.ts'],
          // A frame's page can take seconds to load while the node project's Chromium runs beside
          // this one; a poll still ends as soon as it passes.
          expect: { poll: { timeout: 10_000 } },
          browser: {
            enabled: true,
            headless: true,
            // The page is served on 127.0.0.1, so a frame loaded from localhost is a second origin.
            api: { host: '127.0.0.1' },
            // Overlays ease in, and a click on a sliding sheet waits for it to stand still; beside
            // the node project's Chromium that wait outran the test. These tests assert end
            // states, so they run with reduced motion; test/node/motion.test.ts asserts the motion.
            provider: playwright({ contextOptions: { reducedMotion: 'reduce' } }),
            instances: [{ browser: 'chromium', viewport: { width: 360, height: 800 } }],
          },
        },
      },
    ],
  },
})
