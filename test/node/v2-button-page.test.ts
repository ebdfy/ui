// The v2 Button page draws every button whole before v2.js runs, and nothing moves when it does.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const boxes = () =>
  [...document.querySelectorAll('e-button')].map((tag) => {
    const { x, y, width, height } = tag.getBoundingClientRect()
    return { x, y, width, height, label: tag.textContent?.trim() ?? '' }
  })

test.for([360, 1280])(
  'at %i px with v2.js blocked the primary button is 44 px on a phone, 32 px wider, with its fill, and the script moves no button',
  async (width) => {
    const { page, errors } = await pages.open('', width)
    await page.route('**/ui/v2.js', (route) => route.abort())
    await page.goto(`${pages.ui}/components/button`)
    await page.evaluate(() => document.fonts.ready)
    const primary = page.locator('e-button[tone="primary"]').first()
    expect((await primary.boundingBox())?.height).toBe(width < 600 ? 44 : 32)
    // Midnight's light primary, the navy fill.
    expect(await primary.evaluate((tag) => getComputedStyle(tag).backgroundColor)).toBe('oklch(0.25 0.04 262)')
    expect(await page.locator('e-button button').count()).toBe(0)
    const before = await page.evaluate(boxes)
    expect(before.length).toBeGreaterThanOrEqual(6)

    await page.unroute('**/ui/v2.js')
    await page.evaluate(() => {
      const script = document.createElement('script')
      script.type = 'module'
      script.src = '/ui/v2.js'
      document.head.append(script)
    })
    await page.waitForFunction(() => document.querySelectorAll('e-button > button').length > 0)
    const after = await page.evaluate(boxes)
    const moved = before.flatMap((one, index) =>
      (['x', 'y', 'width', 'height'] as const)
        .filter((key) => Math.abs(one[key] - after[index]![key]) > 1)
        .map((key) => `${one.label} ${key} ${one[key]} -> ${after[index]![key]}`),
    )
    expect(moved).toEqual([])
    expect(await page.locator('e-button').count()).toBe(await page.locator('e-button > button').count())
    // The one error is the blocked v2.js itself.
    expect(errors).toEqual(['Failed to load resource: net::ERR_FAILED'])
  },
)

test('the page shows each state: default, primary, plain, disabled, the three sizes and an icon', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280)
  await page.waitForFunction(() => document.querySelectorAll('e-button > button').length > 0)
  expect(await page.locator('e-button:not([tone])').count()).toBeGreaterThan(0)
  expect(await page.locator('e-button[tone="primary"]').count()).toBeGreaterThan(0)
  expect(await page.locator('e-button[tone="plain"]').count()).toBeGreaterThan(0)
  await expect.poll(() => page.getByRole('button', { disabled: true }).count()).toBeGreaterThan(0)
  expect(await page.locator('e-button[size="sm"]').count()).toBeGreaterThan(0)
  expect(await page.locator('e-button[size="lg"]').count()).toBeGreaterThan(0)
  expect(await page.locator('e-button e-icon').count()).toBeGreaterThan(0)
  expect(await page.getByRole('button', { name: 'Save' }).count()).toBeGreaterThan(0)
})
