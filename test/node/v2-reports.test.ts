// The playground's Reports page: an Admin page drawn in the panel, Reports current in the menu, the
// staff member's cards in the order they chose, which the dev server keeps as the Admin will.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const defaults = [
  'Net sales',
  'Orders',
  'Average order value',
  'Return rate',
  'Net sales a day',
  'Sales report',
  'Products report',
]

const headings = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('e-arranged-cards > [card]')].map((card) => card.getAttribute('heading')),
  )

const library = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll('#card-library [card]')].map((entry) => entry.textContent))

test('/playground/reports is drawn in the panel with Reports current in the menu, under its chart icon', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground/reports`, 1440)
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Reports')
  expect(await page.locator('e-admin-panel > iframe').count()).toBe(0)
  const current = page.locator('nav[slot="menu"] a[aria-current]')
  expect(await current.count()).toBe(1)
  expect(await current.textContent()).toBe('Reports')
  expect(await current.locator('e-icon').getAttribute('name')).toBe('chart-column')
  expect(await headings(page)).toEqual(defaults)
  expect(await library(page)).toEqual(['Top products', 'Sales by channel', 'Low stock'])
  // The 30-day chart: 30 bars, today's the last.
  const bars = page.locator('[card="net-sales-chart"] e-chart-bar')
  expect(await bars.count()).toBe(30)
  expect(await page.locator('[card="net-sales-chart"] e-chart-bar[today]').getAttribute('label')).toBe('13 Nov')
  // Nothing of the cards the page does not show is in it.
  expect(await page.locator('template, [card="top-products"]:not(#card-library *)').count()).toBe(0)
  expect(errors).toEqual([])
})

test('at 360 px no tab is current and More holds Reports as the page', async () => {
  const { page } = await pages.open(`${pages.ui}/playground/reports`, 360)
  expect(await page.locator('nav[slot="tabs"] > a[aria-current]').count()).toBe(0)
  expect(await page.locator('#e-more a[aria-current="page"]').textContent()).toBe('Reports')
})

test('a posted layout comes back on every load, whole or as the panel a move swaps in', async () => {
  const { page } = await pages.open('', 1440)
  const posted = await page.request.post(`${pages.ui}/playground/reports`, {
    form: { cards: 'sales-report net-sales top-products made-up' },
    maxRedirects: 0,
  })
  expect(posted.status()).toBe(303)
  expect(posted.headers().location).toBe('/playground/reports')
  await page.goto(`${pages.ui}/playground/reports`)
  expect(await headings(page)).toEqual(['Sales report', 'Net sales', 'Top products'])
  expect(await library(page)).toEqual([
    'Orders',
    'Average order value',
    'Return rate',
    'Net sales a day',
    'Products report',
    'Sales by channel',
    'Low stock',
  ])
  // A move from another Admin page swaps in the panel, in the same order.
  await page.goto(`${pages.ui}/playground/orders/drafts`)
  await page.locator('nav[slot="menu"] a', { hasText: 'Reports' }).click()
  await page.waitForURL('**/playground/reports')
  await page.waitForSelector('e-admin-panel e-arranged-cards')
  expect(await headings(page)).toEqual(['Sales report', 'Net sales', 'Top products'])
  expect(await page.locator('nav[slot="menu"] a[aria-current="page"]').textContent()).toBe('Reports')
})

// Every mark the menu and the tab bar carry, as [where, name, mark].
const marks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[slot="menu"] a[aria-current], [slot="tabs"] a[aria-current]')].map((link) => [
      link.closest('[slot]')?.getAttribute('slot'),
      link.textContent,
      link.getAttribute('aria-current'),
    ]),
  )

for (const width of [1440, 360]) {
  test(`at ${width} px a move from Drafts to Reports and back marks what a full load of each marks`, async () => {
    const { page } = await pages.open(`${pages.ui}/playground/orders/drafts`, width)
    const drafts = await marks(page)
    await page.goto(`${pages.ui}/playground/reports`)
    const reports = await marks(page)
    await page.goto(`${pages.ui}/playground/orders/drafts`)
    const open = (name: string) =>
      width > 1000
        ? page.locator('nav[slot="menu"] a', { hasText: name }).first().click()
        : page
            .locator('nav[slot="tabs"] > button[popovertarget]')
            .click()
            .then(() => page.locator('#e-more > a', { hasText: name }).first().click())
    await open('Reports')
    await page.waitForURL('**/playground/reports')
    await page.waitForSelector('e-admin-panel e-arranged-cards')
    expect(await marks(page)).toEqual(reports)
    await open('Drafts')
    await page.waitForURL('**/playground/orders/drafts')
    expect(await marks(page)).toEqual(drafts)
  })
}

test('a browser that kept no layout gets the default cards', async () => {
  const { page } = await pages.open(`${pages.ui}/playground/reports`, 1440)
  expect(await headings(page)).toEqual(defaults)
})

test('a posted layout that names a card twice draws it once, where it first comes', async () => {
  const { page } = await pages.open('', 1440)
  await page.request.post(`${pages.ui}/playground/reports`, {
    form: { cards: 'net-sales net-sales orders orders net-sales' },
    maxRedirects: 0,
  })
  await page.goto(`${pages.ui}/playground/reports`)
  expect(await headings(page)).toEqual(['Net sales', 'Orders'])
})
