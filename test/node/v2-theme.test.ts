// v2 follows the device's theme: a v2 page draws Midnight light or dark as the device asks.
import { readFileSync } from 'node:fs'

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
    panel: scheme === 'light' ? 'oklch(0.968 0.004 262)' : 'oklch(0.165 0.02 262)',
  })
})

// Dark is written twice in tokens.css, once for a dark device and once for data-theme="dark"; a token
// added to one block only would draw light on one of the two.
test('the dark device and data-theme="dark" set the same tokens to the same values', () => {
  const tokens = readFileSync(new URL('../../src/v2/tokens.css', import.meta.url), 'utf8')
  const block = (opening: string) => {
    const start = tokens.indexOf(opening)
    expect(start).toBeGreaterThan(-1)
    const body = tokens.slice(start + opening.length, tokens.indexOf('}', start))
    return body
      .split(';')
      .map((line) => line.trim())
      .filter(Boolean)
      .sort()
  }
  const device = block(":root:not([data-theme='light']) {")
  expect(device.length).toBeGreaterThan(40)
  expect(block("\n[data-theme='dark'] {")).toEqual(device)
})
