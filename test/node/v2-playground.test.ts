// The v2 playground draws the Midnight Admin frame: the menu, store and search on the navy frame,
// and the sample app's iframe filling an inset light panel below its title bar.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const desktop = { viewport: { width: 1440, height: 900 } }
const phone = { viewport: { width: 360, height: 780 } }

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).boundingBox()
  if (!found) throw new Error(`${selector} has no box`)
  return found
}

// The panel, its title bar and the iframe, as the edges acceptance names.
async function geometry(page: Page) {
  const panel = await box(page, 'e-admin-panel')
  const title = await box(page, 'e-admin-panel > header')
  const frame = await box(page, 'e-admin-panel > iframe')
  return { panel, title, frame }
}

function expectInsetGeometry({ panel, title, frame }: Awaited<ReturnType<typeof geometry>>) {
  expect(panel.x).toBeCloseTo(228, 0)
  expect(panel.x + panel.width).toBeCloseTo(1430, 0)
  expect(panel.y + panel.height).toBeCloseTo(890, 0)
  expect(panel.y).toBeCloseTo(58, 0)
  expect(frame.x).toBeCloseTo(panel.x, 0)
  expect(frame.x + frame.width).toBeCloseTo(panel.x + panel.width, 0)
  expect(frame.y).toBeCloseTo(title.y + title.height, 0)
  expect(frame.y + frame.height).toBeCloseTo(panel.y + panel.height, 0)
}

const noScroll = (page: Page) =>
  page.evaluate(() => ({
    tall: document.documentElement.scrollHeight <= innerHeight,
    wide: document.documentElement.scrollWidth <= innerWidth,
  }))

const background = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => getComputedStyle(element).backgroundColor)

test('at 1440 the panel sits inset on the frame and the iframe fills it below the title bar', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1440, desktop)
  expectInsetGeometry(await geometry(page))
  expect(await noScroll(page)).toEqual({ tall: true, wide: true })
  // The title bar holds the app's name until the app names its page, as the orders page does.
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Orders')
  expect(errors).toEqual([])
})

test('at 1440 the menu, store and search sit on the navy frame and the panel is light', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`, 1440, desktop)
  // The menu's own entries; the app's pages sit in a nav of their own under its current one.
  const menu = page.getByRole('navigation', { name: 'Main' })
  const entry = (name: string) => menu.locator(':scope > a').filter({ hasText: new RegExp(`^${name}$`) })
  for (const name of ['Home', 'Orders', 'Products', 'Customers']) {
    await expect.poll(() => entry(name).isVisible()).toBe(true)
  }
  const orders = entry('Orders')
  expect(await orders.getAttribute('aria-current')).toBe('page')
  expect(await orders.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('oklch(0.89 0.17 125)')
  expect(await page.getByRole('searchbox').isVisible()).toBe(true)
  expect(await background(page, 'e-admin-frame')).toBe('oklch(0.22 0.03 262)')
  expect(await background(page, 'e-admin-panel')).toBe('oklch(0.99 0.002 262)')
})

test('the frame draws whole before v2-host.js runs, and the script moves no box', async () => {
  const { page } = await pages.open('', 1440, desktop)
  await page.route('**/ui/v2-host.js', (route) => route.abort())
  await page.goto(`${pages.ui}/playground`)
  const before = await geometry(page)
  expectInsetGeometry(before)
  expect(await noScroll(page)).toEqual({ tall: true, wide: true })
  expect(await page.locator('e-admin-frame nav e-icon svg').count()).toBe(0)

  await page.unroute('**/ui/v2-host.js')
  await page.addScriptTag({ type: 'module', url: '/ui/v2-host.js' })
  await page.locator('e-admin-frame nav e-icon svg').first().waitFor({ state: 'attached' })
  const after = await geometry(page)
  for (const part of ['panel', 'title', 'frame'] as const) {
    for (const edge of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(after[part][edge] - before[part][edge]), `${part} ${edge}`).toBeLessThanOrEqual(1)
    }
  }
})

const bangla: Record<string, string> = {
  Home: 'হোম',
  Orders: 'অর্ডার',
  Products: 'পণ্য',
  Customers: 'গ্রাহক',
  'Demo shop': 'ডেমো শপ',
}

test.for(['en', 'bn'] as const)('at 360 in %s the frame takes the phone layout', async (lang) => {
  const { page } = await pages.open(`${pages.ui}/playground`, 360, phone)
  if (lang === 'bn') {
    await page.evaluate((words) => {
      document.documentElement.lang = 'bn'
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim() ?? ''
        if (words[text]) node.textContent = words[text]
      }
      const search = document.querySelector('input[type="search"]') as HTMLInputElement
      search.placeholder = 'অর্ডার, পণ্য, গ্রাহক খুঁজুন'
    }, bangla)
  }
  const label = (word: string) => (lang === 'bn' ? bangla[word] : word)

  const menu = page.getByRole('navigation', { name: 'Main' })
  const bar = await menu.boundingBox()
  expect(bar!.y + bar!.height).toBeCloseTo(780, 0)
  expect(bar!.width).toBeCloseTo(360, 0)
  for (const name of ['Home', 'Orders', 'Products']) {
    const link = await menu.getByRole('link', { name: label(name), exact: true }).boundingBox()
    expect(link!.y).toBeGreaterThanOrEqual(bar!.y)
  }

  const panel = await box(page, 'e-admin-panel')
  expect(panel.x).toBeCloseTo(0, 0)
  expect(panel.width).toBeCloseTo(360, 0)
  expect(panel.y).toBeCloseTo(56, 0)
  expect(panel.y + panel.height).toBeCloseTo(bar!.y, 0)
  expect(await page.locator('e-admin-panel').evaluate((element) => getComputedStyle(element).borderTopLeftRadius)).toBe(
    '22px',
  )
  expect(await background(page, 'e-admin-frame')).toBe('oklch(0.22 0.03 262)')

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    past: [...document.body.querySelectorAll('*')]
      .filter((element) => element.getBoundingClientRect().right > 360)
      .map((element) => element.localName),
  }))
  expect(overflow).toEqual({ scrollWidth: 360, past: [] })
})

// The top bar's search, language switch and Notifications, and the title bar's chevron.
const controls = ['[slot="search"]', '[slot="actions"] > [data-language]', '[aria-label="Notifications"]']

const size = (page: Page, selector: string) =>
  box(page, selector).then(({ width, height }) => [Math.round(width), Math.round(height)])

test('at 360 the search, language switch, Notifications and title chevron are 44 px targets', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`, 360, phone)
  await page.locator('.e-app-pages-button').waitFor({ state: 'visible' })
  // The search is a bar as wide as the room allows, so only its height is 44.
  expect((await size(page, controls[0]!))[1]).toBe(44)
  // The language switch is a word, as wide as the word needs.
  const language = await size(page, controls[1]!)
  expect(language[1]).toBe(44)
  expect(language[0]).toBeGreaterThanOrEqual(44)
  expect(await size(page, controls[2]!)).toEqual([44, 44])
  // The chevron keeps its drawn 36 px and takes 44 px of hit area: taps 21 px from its centre land on it.
  const reach = await page.locator('.e-app-pages-button').evaluate((button) => {
    const { left, top, width, height } = button.getBoundingClientRect()
    const [x, y] = [left + width / 2, top + height / 2]
    return [
      [x, y - 21],
      [x, y + 21],
      [x - 21, y],
      [x + 21, y],
    ].map(([px, py]) => button.contains(document.elementFromPoint(px!, py!)))
  })
  expect(reach).toEqual([true, true, true, true])
  // The top bar stays 56 px.
  expect((await box(page, 'e-admin-panel')).y).toBeCloseTo(56, 0)
})

test('at 1440 the search, language switch and Notifications keep their 36 px', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`, 1440, desktop)
  expect((await size(page, controls[0]!))[1]).toBe(36)
  expect((await size(page, controls[1]!))[1]).toBe(36)
  expect(await size(page, controls[2]!)).toEqual([36, 36])
})

test('in dark the frame and the panel take their dark values', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`, 1440, { ...desktop, colorScheme: 'dark' })
  expect(await background(page, 'e-admin-frame')).toBe('oklch(0.13 0.02 262)')
  expect(await background(page, 'e-admin-panel')).toBe('oklch(0.18 0.02 262)')
})
