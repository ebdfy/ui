// Starts the dev servers on free ports and opens pages in Chromium at phone size.
import { createServer } from 'node:net'

import { type Browser, type BrowserContextOptions, chromium } from 'playwright'
import { onTestFinished } from 'vitest'

import { startDev } from '../../scripts/dev.ts'

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, () => {
      const { port } = server.address() as { port: number }
      server.close(() => resolve(port))
    })
  })
}

// A port found free can be taken by another test file's server before ours listens on it, so a
// taken port is tried again with new ones.
async function startDevOnFreePorts(tries = 5): ReturnType<typeof startDev> {
  try {
    return await startDev({ ui: await freePort(), sampleApp: await freePort() })
  } catch (error) {
    if (tries <= 1 || !String(error).includes('already in use')) throw error
    return startDevOnFreePorts(tries - 1)
  }
}

export async function startPages() {
  const dev = await startDevOnFreePorts()
  const browser: Browser = await chromium.launch()
  return {
    ...dev,
    async open(url: string, width = 360, options: BrowserContextOptions = {}) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, ...options })
      // The page goes with its test, so a file's pages never pile up in its one Chromium.
      onTestFinished(() => context.close())
      const page = await context.newPage()
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      if (url) await page.goto(url)
      return { page, errors }
    },
    openContexts: () => browser.contexts().length,
    async close() {
      await browser.close()
      await dev.close()
    },
  }
}
