import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const light = 'oklch(0.985 0.002 85)'
const dark = 'oklch(0.16 0.004 85)'

async function background(colorScheme: 'light' | 'dark', theme?: 'light' | 'dark') {
  const { page, errors } = await pages.open('')
  await page.emulateMedia({ colorScheme })
  await page.goto(`${pages.ui}/`)
  await page.waitForFunction(() => customElements.get('eb-card') !== undefined)
  if (theme) await page.evaluate((forced) => (document.documentElement.dataset.theme = forced), theme)
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--eb-color-bg').trim(),
  )
  expect(errors).toEqual([])
  return value
}

test('a page with v1.js follows the device: Ink light in a light browser, Ink dark in a dark one', async () => {
  expect(await background('light')).toBe(light)
  expect(await background('dark')).toBe(dark)
})

test('data-theme on the root forces its theme against the device', async () => {
  expect(await background('light', 'dark')).toBe(dark)
  expect(await background('dark', 'light')).toBe(light)
})

// The sample app's own page background, read inside its frame in the playground.
async function appBackground(page: Awaited<ReturnType<typeof pages.open>>['page']) {
  const frame = page.frames().find((one) => one.url().startsWith(pages.sampleApp))
  if (!frame) return ''
  return frame
    .evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--eb-color-bg').trim())
    .catch(() => '')
}

test('the playground turns the sample app dark with its theme switch, and light again', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  await expect.poll(() => page.locator('[part="title"]').textContent(), { timeout: 15_000 }).toBe('Orders')
  expect(await appBackground(page)).toBe(light)
  const toggle = page.getByRole('toolbar', { name: 'Playground' }).locator('#theme')
  await toggle.click()
  await expect.poll(() => appBackground(page)).toBe(dark)
  expect(await toggle.textContent()).toBe('Light theme')
  await toggle.click()
  await expect.poll(() => appBackground(page)).toBe(light)
  expect(await toggle.textContent()).toBe('Dark theme')
  expect(errors).toEqual([])
})

test('the sample app in a dark playground on a dark device is dark from its first answer', async () => {
  const { page } = await pages.open('', 1280)
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => page.locator('[part="title"]').textContent(), { timeout: 15_000 }).toBe('Orders')
  expect(await appBackground(page)).toBe(dark)
  expect(await page.getByRole('toolbar', { name: 'Playground' }).locator('#theme').textContent()).toBe('Light theme')
})

test('the sample app opened in a bare tab follows the device setting', async () => {
  const { page } = await pages.open('')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`${pages.sampleApp}/`)
  await page.waitForFunction(() => customElements.get('eb-button') !== undefined)
  const read = () =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--eb-color-bg').trim())
  expect(await read()).toBe(dark)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBeUndefined()
  await page.emulateMedia({ colorScheme: 'light' })
  expect(await read()).toBe(light)
})
