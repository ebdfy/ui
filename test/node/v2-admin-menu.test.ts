// From 1040 px the Admin's menu is a 232 px column under a 56 px top band. Its entries keep their
// height in a short window and the menu scrolls; the current area's sub-pages hang on a rail; a label
// names the installed apps, each with its tile; and an entry can carry a lime count.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, { lang = 'en', width = 1440, height = 900 } = {}) {
  const opened = await pages.open('', width, { viewport: { width, height } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  return opened
}

const menu = (page: Page) => page.locator('e-admin-frame > [slot="menu"]')

const entryHeights = (page: Page) =>
  menu(page).evaluate((nav) =>
    [...nav.querySelectorAll('a')].map((entry) => [entry.textContent?.trim(), entry.getBoundingClientRect().height]),
  )

const style = (page: Page, selector: string, pseudo?: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element, which) => {
      const { backgroundColor, fontSize, content, borderInlineStartWidth, width, height } = getComputedStyle(
        element,
        which,
      )
      return { backgroundColor, fontSize, content, borderInlineStartWidth, width, height }
    }, pseudo)

test('at 1440 the menu column is 232 px and the top band 56 px', async () => {
  const { page } = await open('/playground/settings/store')
  const panel = await page.locator('e-admin-panel').boundingBox()
  expect(panel!.x).toBeCloseTo(232, 0)
  expect(panel!.y).toBeCloseTo(56, 0)
  const band = await page.locator('[slot="store"]').boundingBox()
  expect(band!.height).toBeCloseTo(56, 0)
})

// Twelve more installed apps make the main menu longer than a short window leaves it room for.
const moreApps = (page: Page) =>
  menu(page).evaluate((nav) => {
    const app = nav.querySelector('a[data-app]')!
    for (let count = 0; count < 12; count++) app.after(app.cloneNode(true))
  })

test('in a 1366 by 640 window with the sub-pages open every entry keeps its height, and the menu scrolls', async () => {
  const tall = await open('/playground/orders/drafts')
  await moreApps(tall.page)
  const expected = await entryHeights(tall.page)
  const short = await open('/playground/orders/drafts', { width: 1366, height: 640 })
  await moreApps(short.page)
  // The app's own pages add to the menu on the app's page; on an Admin page the sub-pages are open.
  expect(await entryHeights(short.page)).toEqual(expected)
  const scrolls = await menu(short.page).evaluate((nav) => {
    nav.scrollTop = 100
    return {
      overflow: getComputedStyle(nav).overflowY,
      longer: nav.scrollHeight > nav.clientHeight,
      top: nav.scrollTop,
    }
  })
  expect(scrolls).toEqual({ overflow: 'auto', longer: true, top: 100 })
})

test('in a 1440 by 768 window Settings keeps its Back row and 11 pages as tall as at 900', async () => {
  const tall = await open('/playground/settings/staff')
  const expected = await entryHeights(tall.page)
  expect(expected).toHaveLength(12)
  const short = await open('/playground/settings/staff', { height: 768 })
  expect(await entryHeights(short.page)).toEqual(expected)
})

test('a focused entry or top band button rings in the frame text colour, which reads on the navy', async () => {
  const { page } = await open('/playground/orders/drafts')
  const frameText = await page.locator('e-admin-frame').evaluate((frame) => getComputedStyle(frame).color)
  for (const target of [
    menu(page).locator(':scope > a').first(),
    menu(page).locator('.e-menu-pages > a').first(),
    page.locator('e-admin-frame > [slot="actions"] > .e-search-button'),
  ]) {
    await target.focus()
    expect(await target.evaluate((element) => getComputedStyle(element).outlineColor)).toBe(frameText)
  }
})

// Whether the frame's light text colour is painted along the line 3 px under an element: where a
// focus ring's bottom edge is drawn.
const ringUnder = async (page: Page, selector: string) => {
  const box = (await page.locator(selector).first().boundingBox())!
  const shot = await page.screenshot({ clip: { x: box.x, y: box.y + box.height + 3, width: box.width, height: 1 } })
  return page.evaluate(async (png) => {
    const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0))
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(image.width, image.height)
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, image.width, image.height)
    let light = 0
    for (let at = 0; at < data.length; at += 4)
      if (data[at]! > 200 && data[at + 1]! > 200 && data[at + 2]! > 200) light++
    return light > image.width / 2
  }, shot.toString('base64'))
}

test("a focused entry's ring is whole above the lime current entry", async () => {
  const { page } = await open('/playground/orders/drafts')
  const home = '[slot="menu"] > a[href="/playground/home"]'
  await page.locator(home).focus()
  expect(await ringUnder(page, home)).toBe(true)
})

test('on the orders page Drafts, Returns and Parcels hang under Orders on a 1 px rail', async () => {
  const { page } = await open('/playground/orders')
  const orders = await menu(page).locator(':scope > a', { hasText: 'Orders' }).boundingBox()
  const rail = menu(page).locator('.e-menu-pages')
  expect(await rail.locator('a').allTextContents()).toEqual(['Drafts', 'Returns', 'Parcels'])
  const box = await rail.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(orders!.y + orders!.height)
  expect((await style(page, '[slot="menu"] .e-menu-pages')).borderInlineStartWidth).toBe('1px')
})

test('the current sub-page has a quiet fill, and an entry fills on hover', async () => {
  const { page } = await open('/playground/orders/drafts')
  const drafts = await style(page, '.e-menu-pages > a[aria-current="page"]')
  const returns = await style(page, '.e-menu-pages > a:not([aria-current])')
  expect(drafts.backgroundColor).not.toBe(returns.backgroundColor)
  expect(returns.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  const products = menu(page).locator(':scope > a', { hasText: 'Products' })
  const before = await products.evaluate((entry) => getComputedStyle(entry).backgroundColor)
  await products.hover()
  await expect.poll(() => products.evaluate((entry) => getComputedStyle(entry).backgroundColor)).not.toBe(before)
})

test('"Installed apps" names the sample app, whose entry carries a 20 px tile with its letter', async () => {
  const { page } = await open('/playground/orders')
  const label = await menu(page).locator('.e-menu-label').boundingBox()
  const app = menu(page).locator(':scope > a[data-app="sample"]')
  const entry = await app.boundingBox()
  expect(label!.y + label!.height).toBeLessThanOrEqual(entry!.y)
  expect(await menu(page).locator('.e-menu-label').textContent()).toBe('Installed apps')
  const tile = app.locator('.e-tile')
  expect(await tile.textContent()).toBe('S')
  expect(await tile.evaluate((element) => [element.clientWidth, element.clientHeight])).toEqual([20, 20])
})

test('one tile serves the store at 28 px and a page at 40 px', async () => {
  const { page } = await open('/playground/orders')
  expect(
    await page.locator('[slot="store"] > .e-tile').evaluate((tile) => [tile.clientWidth, tile.clientHeight]),
  ).toEqual([28, 28])
  const big = await page.evaluate(() => {
    const tile = document.createElement('span')
    tile.className = 'e-tile'
    tile.dataset.size = '40'
    tile.textContent = 'S'
    document.querySelector('e-admin-panel')!.append(tile)
    return [tile.clientWidth, tile.clientHeight]
  })
  expect(big).toEqual([40, 40])
})

test('a count draws its number on a lime ground, and in Bangla at 13 px', async () => {
  const { page } = await open('/playground/orders')
  const count = await style(page, '[slot="menu"] > a[count]', '::after')
  expect(count.content).toBe('"3"')
  expect(count.backgroundColor).toBe('oklch(0.89 0.17 125)')
  const bangla = await open('/playground/orders', { lang: 'bn' })
  const drawn = await style(bangla.page, '[slot="menu"] > a[count]', '::after')
  expect(drawn.content).toBe('"৩"')
  expect(drawn.fontSize).toBe('13px')
})
