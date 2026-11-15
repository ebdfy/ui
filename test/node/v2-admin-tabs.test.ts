// Below 1040 px the Admin's menu gives way to a 64 px tab bar of Home, Orders, Products and More. The
// active tab has a 3 px bar, no Bangla in it is under 13 px, More opens a sheet with everything else,
// and the bar steps aside in a window under 520 px tall.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, { lang = 'en', width = 360, height = 780 } = {}) {
  const opened = await pages.open('', width, { viewport: { width, height } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  return opened
}

const tabs = (page: Page) => page.locator('e-admin-frame > [slot="tabs"]')

const fontSizes = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((found) => found.map((element) => getComputedStyle(element).fontSize))

test('at 360 the tab bar is 64 px at the bottom and reads Home, Orders, Products, More', async () => {
  const { page, errors } = await open('/playground')
  const bar = await tabs(page).boundingBox()
  expect(bar!.height).toBeCloseTo(64, 0)
  expect(bar!.y + bar!.height).toBeCloseTo(780, 0)
  expect(await tabs(page).locator(':scope > :is(a, button)').allTextContents()).toEqual([
    'Home',
    'Orders',
    'Products',
    'More',
  ])
  expect(await page.locator('e-admin-frame > [slot="menu"]').isVisible()).toBe(false)
  expect(errors).toEqual([])
})

test('the active tab has a 3 px bar and a 600 weight, and its label is 12 px', async () => {
  const { page } = await open('/playground')
  const active = tabs(page).locator(':scope > a[aria-current="page"]')
  expect(await active.textContent()).toBe('Orders')
  const drawn = await active.evaluate((tab) => {
    const bar = getComputedStyle(tab, '::before')
    return { bar: bar.height, shown: bar.display !== 'none', weight: getComputedStyle(tab).fontWeight }
  })
  expect(drawn).toEqual({ bar: '3px', shown: true, weight: '600' })
  expect(await fontSizes(page, '[slot="tabs"] > :is(a, button) > span')).toEqual(['12px', '12px', '12px', '12px'])
})

test('in Bangla the tab labels and the staff initials are 13 px', async () => {
  const { page } = await open('/playground', { lang: 'bn' })
  expect(await tabs(page).locator(':scope > :is(a, button)').allTextContents()).toEqual(['হোম', 'অর্ডার', 'পণ্য', 'আরও'])
  expect(await fontSizes(page, '[slot="tabs"] > :is(a, button) > span')).toEqual(['13px', '13px', '13px', '13px'])
  expect(await fontSizes(page, '[slot="actions"] > .e-initials')).toEqual(['13px'])
})

test('the More tab opens a sheet with Customers, the sample app, the sub-pages and Settings, then the user items', async () => {
  const { page } = await open('/playground')
  await tabs(page).getByRole('button', { name: 'More' }).click()
  const sheet = page.locator('#e-more')
  await expect.poll(() => sheet.isVisible()).toBe(true)
  // Each row's words, past an app's tile.
  const rows = await sheet
    .locator('a, button')
    .evaluateAll((found) => found.map((row) => row.querySelector('[data-bn]')?.textContent ?? row.textContent))
  expect(rows).toEqual([
    'Customers',
    'Sample app',
    'Drafts',
    'Returns',
    'Parcels',
    'Settings',
    'English',
    'বাংলা',
    'Account and security',
    'Switch store',
    'Log out',
  ])
  // It lies on the screen's bottom edge, across the phone.
  const box = await sheet.boundingBox()
  expect(Math.round(box!.y + box!.height)).toBe(780)
  expect(box!.width).toBeCloseTo(360, 0)
  await page.keyboard.press('Escape')
  await expect.poll(() => sheet.isVisible()).toBe(false)
})

test('on a Settings page More lists Settings pages as the area sub-pages', async () => {
  const { page } = await open('/playground/settings/staff')
  await tabs(page).getByRole('button', { name: 'More' }).click()
  const sheet = page.locator('#e-more')
  await expect.poll(() => sheet.isVisible()).toBe(true)
  const rows = await sheet.locator('a').allTextContents()
  expect(rows).toContain('Payments')
  expect(await sheet.locator('a[aria-current="page"]').textContent()).toBe('Staff')
})

test('on Drafts the Orders tab keeps its bar as the area, and still has it after a move to Returns', async () => {
  const { page } = await open('/playground/orders/drafts')
  const orders = tabs(page).getByRole('link', { name: 'Orders' })
  const bar = () =>
    orders.evaluate((tab) => [tab.getAttribute('aria-current'), getComputedStyle(tab, '::before').height])
  expect(await bar()).toEqual(['true', '3px'])
  await tabs(page).getByRole('button', { name: 'More' }).click()
  await page.locator('#e-more').getByRole('link', { name: 'Returns' }).click()
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Returns')
  expect(await bar()).toEqual(['true', '3px'])
})

test("a focused tab's ring is drawn inside the tab, where the bar does not clip it", async () => {
  const { page } = await open('/playground')
  const home = tabs(page).getByRole('link', { name: 'Home' })
  await home.focus()
  const ring = await home.evaluate((tab) => {
    const { outlineStyle, outlineWidth, outlineOffset } = getComputedStyle(tab)
    return { outlineStyle, reach: Number.parseFloat(outlineWidth) + Number.parseFloat(outlineOffset) }
  })
  expect(ring.outlineStyle).toBe('solid')
  expect(ring.reach).toBeLessThanOrEqual(0)
})

test('in a 360 by 480 window the tab bar is hidden', async () => {
  const { page } = await open('/playground', { height: 480 })
  expect(await tabs(page).isVisible()).toBe(false)
  const panel = await page.locator('e-admin-panel').boundingBox()
  expect(Math.round(panel!.y + panel!.height)).toBe(480)
})

test("a move picked in More's sheet swaps the page and closes the sheet", async () => {
  const { page } = await open('/playground/settings/store')
  await tabs(page).getByRole('button', { name: 'More' }).click()
  const sheet = page.locator('#e-more')
  await sheet.getByRole('link', { name: 'Staff' }).click()
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Staff')
  await expect.poll(() => sheet.isVisible()).toBe(false)
})
