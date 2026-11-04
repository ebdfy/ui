// ⌘K on an Apple device and Ctrl+K elsewhere opens a search over the docs' page titles; the header's
// Search button shows the shortcut each reader's keyboard has.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const devices = [
  {
    name: 'a Mac',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    keys: 'Meta+k',
    hint: '⌘K',
  },
  {
    name: 'Windows',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    keys: 'Control+k',
    hint: 'Ctrl+K',
  },
]

for (const device of devices) {
  test(`on ${device.name} the search button shows ${device.hint}, and ${device.keys} finds Table and Tabs for "tab"`, async () => {
    const { page, errors } = await pages.open('', 1280, { userAgent: device.userAgent })
    await page.goto(`${pages.ui}/components/button`)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
    const button = page.locator('header.bar').getByRole('button', { name: 'Search' })
    expect(await button.locator('eb-kbd').evaluate((el) => el.shadowRoot?.textContent?.trim())).toBe(device.hint)
    await page.keyboard.press(device.keys)
    const dialog = page.getByRole('dialog', { name: 'Search' })
    await expect.poll(() => dialog.isVisible()).toBe(true)
    const box = dialog.getByRole('combobox', { name: 'Search pages' })
    await expect.poll(() => box.evaluate((el) => el === document.activeElement)).toBe(true)
    await box.fill('tab')
    expect(await dialog.getByRole('option').allTextContents()).toEqual(['Table', 'Tabs'])
    // The option Enter will open is the one marked.
    expect(await dialog.locator('[role="option"][aria-selected="true"]').allTextContents()).toEqual(['Table'])
    await page.keyboard.press('Enter')
    await page.waitForURL(`${pages.ui}/components/table`)
    expect(errors).toEqual([])
  })
}

test("the other platform's shortcut does not open the search", async () => {
  const { page } = await pages.open('', 1280, { userAgent: devices[1]!.userAgent })
  await page.goto(`${pages.ui}/components/button`)
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  await page.keyboard.press('Meta+k')
  expect(await page.getByRole('dialog', { name: 'Search' }).isVisible()).toBe(false)
})

test('at 360 px the search button opens the search, Escape closes it and gives the focus back', async () => {
  const { page } = await pages.open(`${pages.ui}/`, 360)
  await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  const button = page.locator('header.bar').getByRole('button', { name: 'Search' })
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await expect.poll(() => dialog.isVisible()).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await dialog.getByRole('combobox', { name: 'Search pages' }).fill('zzz')
  expect(await dialog.getByRole('option').count()).toBe(0)
  expect(await dialog.getByText('No page matches').isVisible()).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog.isVisible()).toBe(false)
  expect(await button.evaluate((el) => el === document.activeElement)).toBe(true)
})
