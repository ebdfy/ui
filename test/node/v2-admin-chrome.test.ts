// Every playground page draws the Admin's chrome from one source, by its own address: the main menu
// with the Orders area's sub-pages and the installed apps, or Settings' own menu with a Back row. Its
// words are Bangla when the staff member's language is.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { adminChrome } from '../../scripts/admin-chrome.ts'
import { ordersPages, settingsPages } from '../../src/playground-admin.ts'
import { sitePage } from '../../src/site-routes.ts'
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
  return opened
}

// The text of each row of a menu, and which of them is current.
const rows = (page: Page, name: string) =>
  page.getByRole('navigation', { name, exact: true }).evaluate((nav) =>
    [...nav.querySelectorAll(':scope > a, :scope > p, :scope > div > a')].map((row) => ({
      text: row.textContent?.trim(),
      current: row.getAttribute('aria-current'),
    })),
  )

test('the Admin pages are served at their own addresses, and app pages still open the playground', () => {
  for (const { path } of [...settingsPages, ...ordersPages]) expect(sitePage('ui', path)).toBeNull()
  expect(sitePage('ui', '/playground/orders')).toBe('/playground')
  expect(sitePage('ui', '/playground/orders/1042')).toBe('/playground')
  expect(sitePage('ui', '/playground/home')).toBe('/playground')
})

test('the chrome of an app page has Orders current with its sub-pages, and the sample app under Installed apps', () => {
  const html = adminChrome('/playground')
  expect(html).toContain('aria-label="Main"')
  expect(html).toMatch(/<a href="\/playground\/orders" aria-current="page" count="3" data-bn-count="৩">/)
  for (const { path } of ordersPages) expect(html).toContain(`href="${path}"`)
  expect(html.indexOf('Installed apps')).toBeLessThan(html.indexOf('Sample app'))
  expect(html).toMatch(
    /<a href="\/playground" data-app="sample"><span class="e-tile" data-size="20" aria-hidden="true">S<\/span>/,
  )
})

test('an Admin page of Settings gets Settings menu with Back, a label and the 11 pages', () => {
  const html = adminChrome('/playground/settings/staff')
  const menu = /<nav slot="menu"[\s\S]*?<\/nav>/.exec(html)![0]
  expect(menu).toContain('aria-label="Settings"')
  expect(menu).not.toContain('Installed apps')
  expect(menu).toMatch(/<a href="\/playground\/settings\/staff" aria-current="page">/)
  expect(menu.match(/href="\/playground\/settings\//g)).toHaveLength(11)
})

test('at 1440 Settings > Staff shows Back, Settings and its 11 pages, Staff current', async () => {
  const { page, errors } = await open('/playground/settings/staff')
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Staff')
  expect(await page.title()).toBe('Staff · Playground · ebdfy design system v2')
  const menu = await rows(page, 'Settings')
  expect(menu.map(({ text }) => text)).toEqual(['Back', 'Settings', ...settingsPages.map(({ en }) => en)])
  expect(menu.filter(({ current }) => current === 'page').map(({ text }) => text)).toEqual(['Staff'])
  expect(errors).toEqual([])
})

test('each Admin page answers with its title in the panel', async () => {
  const { page } = await open('/playground/settings/store')
  for (const { path, en } of [...settingsPages, ...ordersPages]) {
    const response = await page.goto(`${pages.ui}${path}`)
    expect(response?.status(), path).toBe(200)
    expect(await page.locator('e-admin-panel > header h1').textContent(), path).toBe(en)
  }
})

test('on Drafts the main menu shows Orders with Drafts current on its rail', async () => {
  const { page } = await open('/playground/orders/drafts')
  const menu = await rows(page, 'Main')
  expect(menu.find(({ text }) => text?.startsWith('Orders'))?.current).toBe('true')
  expect(menu.filter(({ current }) => current === 'page').map(({ text }) => text)).toEqual(['Drafts'])
})

test('in Bangla the chrome of the app page reads Bangla, and turns English with the language', async () => {
  const { page } = await open('/playground', 'bn')
  const menu = page.getByRole('navigation', { name: 'প্রধান', exact: true })
  await expect.poll(() => menu.locator(':scope > a').first().textContent()).toBe('হোম')
  expect(await page.locator('[slot="store"]').textContent()).toContain('ডেমো শপ')
  expect(await page.locator('[slot="menu"]').getByText('ইনস্টল করা অ্যাপ').isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await page.locator('#e-user').getByRole('button', { name: 'English' }).click()
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en')
  expect(
    await page.getByRole('navigation', { name: 'Main', exact: true }).locator(':scope > a').first().textContent(),
  ).toBe('Home')
})

test('in Bangla Settings > Staff names its menu and its page in Bangla', async () => {
  const { page } = await open('/playground/settings/staff', 'bn')
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('স্টাফ')
  const menu = await rows(page, 'সেটিংস')
  expect(menu.map(({ text }) => text)).toEqual(['ফিরে যান', 'সেটিংস', ...settingsPages.map(({ bn }) => bn)])
})
