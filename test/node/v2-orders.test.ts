// The sample app's v2 orders list draws whole in its first frame, in English and in Bangla, and
// nothing moves when v2.js runs.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// The script adds tags (the search field's icon), so the second reading measures the tags the first found.
const tagBoxes = () => {
  const w = window as unknown as { tags?: Element[] }
  w.tags ??= [...document.querySelectorAll('*')].filter((tag) => tag.localName.startsWith('e-'))
  return w.tags.map((tag) => {
    const { x, y, width, height } = tag.getBoundingClientRect()
    return { x, y, width, height, name: tag.localName, text: (tag.textContent ?? '').trim().slice(0, 20) }
  })
}

const blocked = async (width: number, query: string) => {
  const { page, errors } = await pages.open('', width)
  await page.route('**/ui/v2.js', (route) => route.abort())
  await page.goto(`${pages.sampleApp}/orders${query}`)
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

const drawn = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())?.height ?? 0

test.for([1280, 360])('at %i px with v2.js blocked the English page is drawn whole', async (width) => {
  const { page } = await blocked(width, '')
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en')
  expect(await drawn(page, 'e-page')).toBeGreaterThan(0)
  expect(await page.locator('e-page').getAttribute('heading')).toBe('Orders')
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('e-page')!, '::before').content)).toBe(
    '"Orders"',
  )
  expect(await drawn(page, 'e-button')).toBeGreaterThan(0)
  expect(await page.locator('e-page > e-button[slot="actions"]').textContent()).toBe('Save')
  expect(await drawn(page, 'e-search-field')).toBeGreaterThan(0)
  expect(await page.locator('e-search-field').getAttribute('placeholder')).toBe('Search orders')
  const rows = page.locator('e-row:not([head])')
  expect(await rows.count()).toBe(10)
  // Below 600 px the CSS hides the checkbox cell until select mode, and shows every cell it places.
  const drawnCells = await rows.evaluateAll((all) =>
    all.map((row) => {
      const cells = [...row.children]
      return {
        check: cells[0]!.checkVisibility(),
        placed: cells
          .filter((cell) => cell.hasAttribute('card'))
          .every((cell) => cell.getBoundingClientRect().height > 0),
      }
    }),
  )
  expect(drawnCells).toEqual(
    Array(10).fill(width < 600 ? { check: false, placed: true } : { check: true, placed: true }),
  )
  for (let index = 0; index < 10; index++)
    expect((await rows.nth(index).locator('> [card="title"]').boundingBox())?.height).toBeGreaterThan(0)
  const first = await rows.first().locator('> *').allTextContents()
  expect(first).toEqual([
    '',
    '#1042',
    'Today 11:24',
    'Rahima Akter',
    'Facebook',
    'Cash on delivery',
    'New',
    '2 items',
    '৳1,930',
  ])
  expect(await rows.last().locator('> *').last().textContent()).toBe('৳1,12,400')
})

test.for([1280, 360])('at %i px with v2.js blocked the Bangla page is drawn whole', async (width) => {
  const { page } = await blocked(width, '?lang=bn')
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('bn')
  expect(await page.locator('e-page').getAttribute('heading')).toBe('অর্ডার')
  expect(await page.locator('e-page > e-button[slot="actions"]').textContent()).toBe('সংরক্ষণ করুন')
  expect(await page.locator('e-search-field').getAttribute('placeholder')).toBe('অর্ডার খুঁজুন')
  expect(await drawn(page, 'e-search-field')).toBeGreaterThan(0)
  const rows = page.locator('e-row:not([head])')
  expect(await rows.count()).toBe(10)
  const first = await rows.first().locator('> *').allTextContents()
  expect(first).toEqual(['', '#1042', 'আজ ১১:২৪', 'রহিমা আক্তার', 'ফেসবুক', 'ক্যাশ অন ডেলিভারি', 'নতুন', '২টি পণ্য', '৳১,৯৩০'])
  expect(await rows.last().locator('> *').last().textContent()).toBe('৳১,১২,৪০০')
})

test('a stored Bangla choice draws Bangla, and ?lang=en beats it', async () => {
  const { page } = await pages.open('', 360)
  await page.route('**/ui/v2.js', (route) => route.abort())
  await page.addInitScript(() => localStorage.setItem('ebdfy-sample-lang', 'bn'))
  await page.goto(`${pages.sampleApp}/orders`)
  expect(await page.locator('e-page').getAttribute('heading')).toBe('অর্ডার')
  await page.goto(`${pages.sampleApp}/orders?lang=en`)
  expect(await page.locator('e-page').getAttribute('heading')).toBe('Orders')
})

test.for(['', '?lang=bn'])('loading v2.js moves no e-* box (%j)', async (query) => {
  const { page } = await blocked(1280, query)
  const before = await page.evaluate(tagBoxes)
  expect(before.length).toBe(67)
  await page.unroute('**/ui/v2.js')
  await page.evaluate(() => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/ui/v2.js'
    document.head.append(script)
  })
  await page.waitForFunction(() => document.querySelectorAll('e-search-field > input').length > 0)
  await page.evaluate(() => document.fonts.ready)
  const after = await page.evaluate(tagBoxes)
  const moved = before.flatMap((one, index) =>
    (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(one[key] - after[index]![key]) > 1)
      .map((key) => `${one.name} ${one.text} ${key} ${one[key]} -> ${after[index]![key]}`),
  )
  expect(moved).toEqual([])
})

// Each breakpoint's two edges, in both languages: the columns change at 600 and 800 px.
const widths = [360, 599, 600, 700, 799, 800, 1040]

test.for(
  widths.flatMap(
    (width) =>
      [
        [width, '', 'Orders'],
        [width, '?lang=bn', 'অর্ডার'],
      ] as const,
  ),
)('at %i px nothing scrolls sideways, the table neither (%j)', async ([width, query, label]) => {
  const { page } = await pages.open(`${pages.sampleApp}/orders${query}`, width)
  await page.setViewportSize({ width, height: 780 })
  await page.getByRole('table', { name: label }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  const found = await page.evaluate(() => {
    const shown = [...document.querySelectorAll('body *')].filter((tag) => tag.checkVisibility())
    const width = document.documentElement.clientWidth
    // The view tabs may scroll inside e-tabs, which clips them; e-tabs itself stays inside.
    const clipped = (tag: Element) => tag.parentElement?.closest('e-tabs') !== null
    const past = shown
      .filter((tag) => !clipped(tag) && tag.getBoundingClientRect().right > width + 0.5)
      .map((tag) => tag.localName)
    const scrolling = shown
      .filter((tag) => tag.localName !== 'e-tabs' && tag.scrollWidth > tag.clientWidth + 1 && tag.clientWidth > 0)
      .map((tag) => tag.localName)
    return { scrollWidth: document.documentElement.scrollWidth, past, scrolling }
  })
  expect(found).toEqual({ scrollWidth: width, past: [], scrolling: [] })
})

test.for([
  ['', 'Orders', '#1042'],
  ['?lang=bn', 'অর্ডার', '#1042'],
])('after v2.js the table has 11 rows and its order link is a link (%j)', async ([query, label, id]) => {
  const { page } = await pages.open(`${pages.sampleApp}/orders${query}`, 1280)
  const table = page.getByRole('table', { name: label })
  await table.waitFor()
  expect(await table.getByRole('row').count()).toBe(11)
  const link = page.getByRole('link', { name: id })
  expect(await link.getAttribute('href')).toBe('/orders/1042')
})

// The page's markup holds the first page of the app's orders, as its data would draw it, so the rows
// the app draws later read the same: each cell's words in both languages, the link and the status.
test.for(['', '?lang=bn'])('the markup rows are the ten newest orders of the data (%j)', async (query) => {
  const { page } = await pages.open(`${pages.sampleApp}/orders${query}`, 1280)
  await page.waitForFunction(() => 'sampleOrders' in globalThis)
  const found = await page.evaluate(() => {
    interface Data {
      orders: unknown[]
      row: (order: unknown, lang: string) => Element
    }
    const data = (globalThis as unknown as { sampleOrders: Data }).sampleOrders
    const read = (rows: Element[]) =>
      rows.map((row) =>
        [...row.children].map((cell) => ({
          text: cell.textContent,
          bn: (cell.querySelector('[data-bn]') ?? cell).getAttribute('data-bn'),
          href: cell.querySelector('a')?.getAttribute('href') ?? null,
          status: cell.querySelector('e-badge')?.getAttribute('tone') ?? null,
          align: cell.getAttribute('align'),
          tone: cell.getAttribute('tone'),
          card: cell.getAttribute('card'),
        })),
      )
    const lang = document.documentElement.lang
    return {
      markup: read([...document.querySelectorAll('e-row:not([head])')]),
      data: read(data.orders.slice(0, 10).map((order) => data.row(order, lang))),
    }
  })
  expect(found.markup).toEqual(found.data)
})

// The order links draw in the kit's link colour, not the browser's blue, in both schemes.
test.for([
  ['light', 'rgb(0, 0, 238)'],
  ['dark', 'rgb(158, 158, 255)'],
] as const)(
  'in %s the order links are not the browser blue, and the focus ring is the kit’s',
  async ([scheme, blue]) => {
    const { page } = await pages.open('', 1280, { colorScheme: scheme })
    const paint = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((link) => {
          const probe = document.createElement('e-link')
          probe.innerHTML = '<a href="/">x</a>'
          document.body.append(probe)
          const kit = getComputedStyle(probe.firstElementChild!).color
          probe.remove()
          return { color: getComputedStyle(link).color, kit }
        })
    await page.goto(`${pages.sampleApp}/orders`)
    await page.getByRole('link', { name: '#1042' }).waitFor()
    const list = await paint('e-row a[href="/orders/1042"]')
    expect(list.color).not.toBe(blue)
    expect(list.color).toBe(list.kit)
    await page.goto(`${pages.sampleApp}/orders/1042`)
    await page.getByRole('link', { name: 'All orders' }).waitFor()
    // The back arrow is an icon link in the text's own colour.
    const back = await paint('e-page > a[slot="back"]')
    expect(back.color).not.toBe(blue)
    await page.getByRole('link', { name: 'All orders' }).focus()
    const ring = await page
      .getByRole('link', { name: 'All orders' })
      .evaluate((link) => getComputedStyle(link).outlineWidth)
    expect(ring).toBe('2px')
  },
)

test('the data holds 120 orders, #923 to #1042, with one tab count for each status', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/orders`, 1280)
  await page.waitForFunction(() => 'sampleOrders' in globalThis)
  const counts = await page.evaluate(() => {
    const { orders } = (globalThis as unknown as { sampleOrders: { orders: { number: number; status: string }[] } })
      .sampleOrders
    const by: Record<string, number> = {}
    for (const order of orders) by[order.status] = (by[order.status] ?? 0) + 1
    return { length: orders.length, first: orders[0]!.number, last: orders.at(-1)!.number, by }
  })
  expect(counts).toEqual({
    length: 120,
    first: 1042,
    last: 923,
    by: { new: 12, confirmed: 18, courier: 54, delivered: 30, returned: 6 },
  })
})
