// v2 follows the device's theme: a v2 page draws Midnight light or dark as the device asks.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test.for(['light', 'dark'] as const)('on a %s device the Button page draws that theme', async (scheme) => {
  const { page } = await pages.open('', 360, { colorScheme: scheme })
  await page.goto(`${pages.ui}/components/button`)
  // The panel's colour as the browser computes it, read through an element.
  const drawn = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.color = 'var(--e-color-panel)'
    document.body.append(probe)
    return { scheme: getComputedStyle(document.documentElement).colorScheme, panel: getComputedStyle(probe).color }
  })
  expect(drawn).toEqual({
    scheme,
    panel: scheme === 'light' ? 'oklch(0.99 0.002 262)' : 'oklch(0.18 0.02 262)',
  })
})
