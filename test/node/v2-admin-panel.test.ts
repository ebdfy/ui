// A move between two Admin pages fetches the next page's panel and swaps it in under the frame,
// which stays the same node: the address, Back, Forward and a reload work as for whole pages. A move
// to the app's page, or to a page beside another menu, loads that page whole.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, lang: 'en' | 'bn' = 'en', width = 1440) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  // A mark on the frame and on the window that a whole page load would wipe.
  await opened.page.evaluate(() => {
    Object.assign(document.querySelector('e-admin-frame')!, { kept: true })
    Object.assign(globalThis, { stayed: true })
  })
  return opened
}

const heading = (page: Page) => page.locator('e-admin-panel > header h1').textContent()
const path = (page: Page) => new URL(page.url()).pathname
const kept = (page: Page) =>
  page.evaluate(() => [
    (document.querySelector('e-admin-frame') as unknown as { kept?: boolean }).kept === true,
    (globalThis as unknown as { stayed?: boolean }).stayed === true,
  ])
const current = (page: Page) => page.locator('[slot="menu"] a[aria-current="page"]').textContent()

const settingsLink = (page: Page, name: string) =>
  page.locator('[slot="menu"] > a').filter({ hasText: new RegExp(`^${name}$`) })

test('from Store, Staff swaps in under the same frame with no page load', async () => {
  const { page, errors } = await open('/playground/settings/store')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(path(page)).toBe('/playground/settings/staff')
  expect(await kept(page)).toEqual([true, true])
  expect(await current(page)).toBe('Staff')
  expect(await page.title()).toBe('Staff · Playground · ebdfy design system v2')
  expect(errors).toEqual([])
})

test('browser Back returns to Store with its form, and Forward to Staff', async () => {
  const { page } = await open('/playground/settings/store')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Store')
  expect(path(page)).toBe('/playground/settings/store')
  expect(await current(page)).toBe('Store')
  // The swapped-in form is built as on a page load.
  await page.locator('e-phone-field input').waitFor({ state: 'attached' })
  await page.goForward()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(await kept(page)).toEqual([true, true])
})

test('browser Back after two moves returns through both pages in order', async () => {
  const { page } = await open('/playground/settings/store')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Payments').click()
  await expect.poll(() => heading(page)).toBe('Payments')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(path(page)).toBe('/playground/settings/staff')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Store')
  expect(path(page)).toBe('/playground/settings/store')
  expect(await kept(page)).toEqual([true, true])
})

test('a reload of Staff after a move draws the whole page', async () => {
  const { page } = await open('/playground/settings/store')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await page.reload()
  expect(await heading(page)).toBe('Staff')
  expect(await page.locator('e-admin-frame > [slot="menu"]').getAttribute('aria-label')).toBe('Settings')
  expect(await current(page)).toBe('Staff')
})

test('the panel request carries the panel header, and the dev server answers the panel alone', async () => {
  const { page } = await open('/playground/settings/store')
  const asked = page.waitForRequest((request) => request.url().endsWith('/playground/settings/staff'))
  await settingsLink(page, 'Staff').click()
  expect((await asked).headers()['ebdfy-panel']).toBe('1')

  const panel = await fetch(`${pages.ui}/playground/settings/staff`, { headers: { 'Ebdfy-Panel': '1' } })
  const html = await panel.text()
  expect(panel.headers.get('vary')).toContain('Ebdfy-Panel')
  expect(html).toMatch(
    /^<title>Staff · Playground · ebdfy design system v2<\/title>\s*<e-admin-panel[\s\S]*<\/e-admin-panel>$/,
  )
  expect(html).not.toContain('e-admin-frame')
  const whole = await fetch(`${pages.ui}/playground/settings/staff`)
  expect(whole.headers.get('vary')).toContain('Ebdfy-Panel')
  expect(await whole.text()).toContain('<e-admin-frame>')
})

test('in Bangla the swapped-in page reads Bangla', async () => {
  const { page } = await open('/playground/settings/store', 'bn')
  await settingsLink(page, 'স্টাফ').click()
  await expect.poll(() => heading(page)).toBe('স্টাফ')
  expect(await page.locator('e-admin-panel e-text').textContent()).toBe('প্লেগ্রাউন্ডে এই পাতাটি এখনো ফাঁকা।')
  expect(await kept(page)).toEqual([true, true])
})

test("a link to the app's page loads it whole, with the app in its frame", async () => {
  const { page } = await open('/playground/orders/drafts')
  await page.locator('[slot="menu"] > a[data-app="sample"]').click()
  await page.locator('e-admin-panel > iframe').waitFor()
  expect(await kept(page)).toEqual([false, false])
})

test('from Drafts, Settings loads whole with its own menu', async () => {
  const { page } = await open('/playground/orders/drafts')
  await page
    .locator('[slot="menu"] a')
    .filter({ hasText: /^Returns$/ })
    .click()
  await expect.poll(() => heading(page)).toBe('Returns')
  expect(await kept(page)).toEqual([true, true])
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Settings$/ })
    .click()
  await expect.poll(() => heading(page)).toBe('Store')
  expect(await page.locator('e-admin-frame > [slot="menu"]').getAttribute('aria-label')).toBe('Settings')
  expect(await kept(page)).toEqual([false, false])
})

// Settings' Back row leads to the address the staff member came from, or Home.
const back = (page: Page) => page.locator('[slot="menu"] > a[data-back]')

test('the Back row of Settings returns to the orders page Settings was opened from', async () => {
  const { page } = await open('/playground/orders')
  await page.locator('e-admin-panel > iframe').waitFor()
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Settings$/ })
    .click()
  await expect.poll(() => heading(page)).toBe('Store')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(await back(page).getAttribute('href')).toBe('/playground/orders')
  await back(page).click()
  await page.waitForURL(`${pages.ui}/playground/orders`)
  await page.locator('e-admin-panel > iframe').waitFor()
})

test('the Back row of Settings returns to Drafts when Settings was opened from there', async () => {
  const { page } = await open('/playground/orders/drafts')
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Settings$/ })
    .click()
  await expect.poll(() => heading(page)).toBe('Store')
  // The heading is in the markup before v2-host.js has set the Back row.
  await expect.poll(() => back(page).getAttribute('href')).toBe('/playground/orders/drafts')
})

test('the Back row of Settings goes Home when Settings was the first page', async () => {
  const { page } = await open('/playground/settings/staff')
  expect(await back(page).getAttribute('href')).toBe('/playground/home')
  await back(page).click()
  await page.waitForURL(`${pages.ui}/playground/home`)
})
