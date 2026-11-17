// An app's action in a record's More actions: on the playground's product page Translate follows
// Duplicate with the sample app's tile, and opens the app's page on that product, which reads its id
// and placement from ebdfy.config as from its frame's address.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const product = '/playground/products/7'

async function open(path: string, width = 1440, lang: 'en' | 'bn' = 'en') {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  return opened
}

async function appFrame(page: Page): Promise<Frame> {
  const isApp = (frame: Frame) => frame.url().startsWith(`${pages.sampleApp}/`)
  await expect.poll(() => page.frames().some(isApp)).toBe(true)
  return page.frames().find(isApp)!
}

const more = (page: Page, name = 'More actions') =>
  page.locator('e-admin-panel > header').getByRole('button', { name }).click()

// Every mark the menu and the tab bar carry, as [where, name, mark].
const marks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[slot="menu"] a[aria-current], [slot="tabs"] a[aria-current]')].map((link) => [
      link.closest('[slot]')?.getAttribute('slot'),
      link.textContent,
      link.getAttribute('aria-current'),
    ]),
  )

test('the product page answers whole and as its panel, headed by the product', async () => {
  const whole = await fetch(`${pages.ui}${product}`)
  expect(whole.status).toBe(200)
  expect(await whole.text()).toContain('<h1>Jamdani Panjabi</h1>')
  const panel = await (await fetch(`${pages.ui}${product}`, { headers: { 'Ebdfy-Panel': '1' } })).text()
  expect(panel.startsWith('<title>')).toBe(true)
  expect(panel).not.toContain('<e-admin-frame')
})

test("More actions lists Duplicate, then Translate with the sample app's 20 px tile, its label lined up", async () => {
  const { page, errors } = await open(product)
  await more(page)
  const items = page.getByRole('menu').getByRole('menuitem')
  expect(await items.allTextContents()).toEqual(['Duplicate', 'STranslate'])
  const lineUp = await page.getByRole('menu').evaluate((menu) => {
    const [duplicate, translate] = [...menu.querySelectorAll('e-menu-item')]
    const left = (node: Node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return Math.round(range.getBoundingClientRect().left)
    }
    const tile = translate!.querySelector('.e-tile')!.getBoundingClientRect()
    return {
      tile: [tile.width, tile.height],
      labels: [left(duplicate!.querySelector('span')!), left(translate!.lastChild!)],
    }
  })
  expect(lineUp.tile).toEqual([20, 20])
  expect(lineUp.labels[1]).toBe(lineUp.labels[0])
  expect(errors).toEqual([])
})

test("picking Translate opens the app on prod_7, which reads its id and placement from ebdfy.config", async () => {
  const { page, errors } = await open(product)
  await more(page)
  await page.getByRole('menuitem', { name: 'Translate' }).click()
  await page.waitForURL(`${pages.ui}/playground/translate?id=prod_7`)
  const app = await appFrame(page)
  const address = new URL(app.url())
  expect([address.origin, address.pathname, address.searchParams.get('id'), address.searchParams.get('store')]).toEqual([
    pages.sampleApp,
    '/translate',
    'prod_7',
    'demo',
  ])
  await expect.poll(() => app.locator('#translating').textContent()).toBe('Translating prod_7')
  await expect
    .poll(() => app.evaluate(() => ({ placement: ebdfy.config.placement, id: ebdfy.config.id })))
    .toEqual({ placement: 'PRODUCT_MORE_ACTIONS', id: 'prod_7' })
  expect(errors).toEqual([])
})

test('Enter on Translate follows it, and Ctrl+press opens it in a new tab', async () => {
  const { page } = await open(product)
  await more(page)
  const tab = page.context().waitForEvent('page')
  await page.getByRole('menuitem', { name: 'Translate' }).click({ modifiers: ['Control'] })
  const opened = await tab
  await opened.waitForURL(`${pages.ui}/playground/translate?id=prod_7`)
  expect(page.url()).toBe(`${pages.ui}${product}`)

  await more(page)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForURL(`${pages.ui}/playground/translate?id=prod_7`)
})

test('in Bangla More actions and Duplicate are Bangla, and the product and the app keep their own words', async () => {
  const { page } = await open(product, 1440, 'bn')
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Jamdani Panjabi')
  await more(page, 'আরও অ্যাকশন')
  expect(await page.getByRole('menu').getByRole('menuitem').allTextContents()).toEqual(['ডুপ্লিকেট করুন', 'STranslate'])
})

for (const width of [1440, 360]) {
  test(`at ${width} px a move between Drafts and the product page marks what a full load of each marks`, async () => {
    const { page } = await open(product, width)
    const full = { product: await marks(page), drafts: [] as unknown }
    // Products leads to Import, and a product is in its area.
    expect(full.product).toEqual([
      ['menu', 'Products', 'true'],
      ['tabs', 'Products', 'true'],
    ])
    await page.goto(`${pages.ui}/playground/orders/drafts`)
    full.drafts = await marks(page)
    // The product page has no menu entry of its own, so a link in Drafts' panel takes the move there.
    const go = (path: string) =>
      page.evaluate((href) => {
        const link = document.createElement('a')
        link.href = href
        document.querySelector('e-admin-panel > .admin-page')!.append(link)
        link.click()
      }, path)
    await go(product)
    await page.waitForURL(`**${product}`)
    await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Jamdani Panjabi')
    expect(await marks(page)).toEqual(full.product)
    await go('/playground/orders/drafts')
    await page.waitForURL('**/playground/orders/drafts')
    await expect.poll(() => marks(page)).toEqual(full.drafts)
  })
}

// The id and placement belong to the page the Admin opened from the placement, not to the pages the
// app moves to from it, which read their own address.
test('a page the app moves to from Translate hears no placement, nor the id it was opened with', async () => {
  const { page, errors } = await open('/playground/translate?id=prod_7')
  const app = await appFrame(page)
  await expect.poll(() => app.locator('#translating').textContent()).toBe('Translating prod_7')
  await app.evaluate(() => location.assign('/orders?store=demo'))
  const moved = await appFrame(page)
  await expect.poll(() => new URL(moved.url()).pathname).toBe('/orders')
  await moved.waitForFunction(() => 'ebdfy' in globalThis)
  const heard = await moved.evaluate(async () => {
    await ebdfy.user()
    return { placement: ebdfy.config.placement, id: ebdfy.config.id }
  })
  expect(heard).toEqual({ placement: '', id: '' })
  expect(errors).toEqual([])
})

test("the app's nav entries open with the store, never the record's id", async () => {
  const { page } = await open('/playground/translate?id=prod_7')
  const app = await appFrame(page)
  await app.evaluate(() => location.assign('/orders?store=demo'))
  const links = page.locator('.e-app-nav a')
  await expect.poll(() => links.count()).toBe(3)
  const queries = await links.evaluateAll((all) => all.map((link) => new URL((link as HTMLAnchorElement).href).search))
  expect(queries).toEqual(['?store=demo', '?store=demo', '?store=demo'])
})
