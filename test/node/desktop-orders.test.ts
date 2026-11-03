import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

type Page = Awaited<ReturnType<typeof pages.open>>['page']

async function openOrders(width: number) {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, width)
  await page.locator('eb-row').first().waitFor({ timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const { top, bottom, left, right, width, height } = el.getBoundingClientRect()
      return { top, bottom, left, right, width, height }
    })
const numbers = (page: Page) =>
  page.locator('eb-row').evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.number))

test('at 1280 px a toolbar row of filters and a search field sits above the 44 px table', async () => {
  const { page, errors } = await openOrders(1280)
  const filters = page.locator('.toolbar eb-button-group eb-button')
  expect(await filters.allTextContents()).toEqual(['All 6', 'New 2', 'Confirmed 1', 'With courier 1', 'Returned 1'])
  expect(await filters.evaluateAll((els) => els.map((el) => el.getAttribute('variant')))).toEqual([
    'primary',
    'ghost',
    'ghost',
    'ghost',
    'ghost',
  ])
  // A screen reader hears which filter is on, not only sees it.
  expect(await page.getByRole('button', { name: 'All 6', pressed: true }).count()).toBe(1)
  expect(await page.getByRole('button', { name: 'New 2', pressed: false }).count()).toBe(1)
  expect(await page.locator('.toolbar eb-button-group').getAttribute('label')).toBe('Show')
  expect(await page.locator('.toolbar eb-search-field').getAttribute('label')).toBe('Search orders')
  const [toolbar, table, group, search] = [
    await box(page, '.toolbar'),
    await box(page, 'eb-table'),
    await box(page, '.toolbar eb-button-group'),
    await box(page, '.toolbar eb-search-field'),
  ]
  expect(toolbar.bottom).toBeLessThanOrEqual(table.top)
  // One row: the search field beside the filters, not under them.
  expect(search.left).toBeGreaterThanOrEqual(group.right)
  expect(search.top).toBeLessThan(group.bottom)
  expect((await box(page, 'eb-row[open] [part="row"]')).height).toBe(44)
  expect(await page.locator('eb-row[open]').getAttribute('data-number')).toBe('1039')
  expect(errors).toEqual([])
})

test('at 1280 px order #1039 shows in a pane beside the table, with Ask for advance and Confirm order', async () => {
  const { page, errors } = await openOrders(1280)
  const pane = page.locator('.pane')
  await pane.locator('eb-heading:defined').first().waitFor()
  expect(await pane.locator('eb-heading[level="3"]').textContent()).toBe('#1039')
  expect(await pane.locator('eb-heading[level="2"]').textContent()).toBe('৳1,800')
  expect(await pane.locator('eb-banner[tone="danger"]').textContent()).toContain('Ask for a ৳120 bKash advance')
  expect(await pane.locator('eb-button').allTextContents()).toEqual(['Ask for advance', 'Confirm order'])
  const [table, aside] = [await box(page, 'eb-table'), await box(page, '.pane')]
  expect(aside.left).toBeGreaterThanOrEqual(table.right)
  expect(aside.top).toBeLessThan(table.bottom)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280)
  expect(errors).toEqual([])
})

for (const width of [1040, 1044]) {
  test(`at ${width} px beside the pane every row of both pages stays one 44 px line, in English and in Bangla`, async () => {
    const { page, errors } = await openOrders(width)
    expect((await box(page, '.pane')).width).toBeGreaterThan(0)
    const heights = () =>
      page.locator('eb-row [part="row"]').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height))
    const switchTo = async (lang: string) => {
      await page.locator(`.languages eb-button[data-lang="${lang}"]`).click()
      await page.locator(`html[lang="${lang}"]`).waitFor({ state: 'attached' })
      await page.evaluate(() => document.fonts.ready)
    }
    expect(await heights()).toEqual([44, 44, 44, 44, 44])
    await switchTo('bn')
    await expect.poll(heights).toEqual([44, 44, 44, 44, 44])
    await page.locator('eb-pagination button').last().click()
    await page.locator('eb-row[data-number="1037"]').waitFor()
    await expect.poll(heights).toEqual([44])
    await switchTo('en')
    await expect.poll(heights).toEqual([44])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
  })
}

test('below 1040 px the pane gives the table the width, and on a phone the toolbar is left out', async () => {
  for (const width of [800, 1039]) {
    const { page } = await openOrders(width)
    expect((await box(page, '.pane')).width, `${width}`).toBe(0)
  }
  const { page } = await openOrders(800)
  expect((await box(page, '.toolbar')).height).toBeGreaterThan(0)
  const phone = await openOrders(360)
  expect((await box(phone.page, '.pane')).width).toBe(0)
  expect((await box(phone.page, '.toolbar')).height).toBe(0)
})

test('the New filter shows only the new orders, and a search for 1040 only #1040', async () => {
  const { page, errors } = await openOrders(1280)
  await page.locator('.toolbar eb-button', { hasText: 'New' }).click()
  await expect.poll(() => numbers(page)).toEqual(['1042', '1039'])
  expect(await page.locator('.toolbar eb-button', { hasText: 'New' }).getAttribute('variant')).toBe('primary')
  expect(await page.getByRole('button', { name: 'New 2', pressed: true }).count()).toBe(1)
  expect(await page.locator('.toolbar eb-button', { hasText: 'All' }).getAttribute('variant')).toBe('ghost')
  await page.locator('.toolbar eb-button', { hasText: 'All' }).click()
  await page.locator('.toolbar eb-search-field input').fill('1040')
  await expect.poll(() => numbers(page)).toEqual(['1040'])
  expect(errors).toEqual([])
})

test('pressing Confirm order in the pane turns #1039 Confirmed in the list', async () => {
  const { page } = await openOrders(1280)
  await page.locator('.pane eb-button', { hasText: 'Confirm order' }).click()
  await expect
    .poll(() => page.locator('eb-row', { hasText: '#1039' }).locator('eb-badge').innerText())
    .toBe('Confirmed')
})

test('in the playground at 1280 px the pane shows inside the framed app, which never scrolls sideways', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.locator('.pane eb-heading:defined').first().waitFor({ timeout: 15_000 })
  expect(await app.locator('.pane').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(0)
  expect(await app.locator('html').evaluate((html) => html.scrollWidth <= html.clientWidth)).toBe(true)
  expect(errors).toEqual([])
})

// Without the pane the table shares its width evenly, so on a narrow table names may wrap but an
// order number, an amount and a heading never break inside.
test('at 600 and 800 px each order number, total and heading stays whole on one line', async () => {
  for (const width of [600, 800]) {
    const { page } = await openOrders(width)
    for (const lang of ['en', 'bn'] as const) {
      await page.locator(`.languages eb-button[data-lang="${lang}"]`).click()
      await expect.poll(() => page.locator('html').getAttribute('lang')).toBe(lang)
      await page.evaluate(() => document.fonts.ready)
      const broken = await page.evaluate(() => {
        const lines = (el: Element) => {
          const range = document.createRange()
          range.selectNodeContents(el)
          return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
        }
        const parts = [
          ...[...document.querySelectorAll('eb-row')].flatMap((row) => [row.children[0]!, row.children[5]!]),
          ...document.querySelectorAll('eb-table > eb-column'),
        ]
        return parts.filter((el) => lines(el) > 1).map((el) => el.textContent)
      })
      expect(broken, `${width} px in ${lang}`).toEqual([])
    }
  }
  // A window narrowed past 1040 px gives up the pane's shares as the pane goes.
  const { page } = await openOrders(1280)
  await page.setViewportSize({ width: 800, height: 800 })
  await expect
    .poll(() => page.locator('eb-table > eb-column').evaluateAll((cols) => cols.map((c) => c.getAttribute('grow'))))
    .toEqual(['1', '1', '1', '1', '1', '1'])
})

test('at 600 px every status stays inside its column, in English and Bangla', async () => {
  const { page } = await openOrders(600)
  for (const lang of ['en', 'bn'] as const) {
    await page.locator(`.languages eb-button[data-lang="${lang}"]`).click()
    await expect.poll(() => page.locator('html').getAttribute('lang')).toBe(lang)
    await page.evaluate(() => document.fonts.ready)
    const spilled = await page.evaluate(() =>
      [...document.querySelectorAll('eb-row')].flatMap((row) => {
        const cell = row.children[3]!
        const badge = cell.querySelector('eb-badge, eb-courier-status')!
        const inner = badge.localName === 'eb-badge' ? badge : badge.shadowRoot!.querySelector('eb-badge')!
        const slot = cell.assignedSlot!.parentElement!.getBoundingClientRect()
        const over = inner.getBoundingClientRect().right - slot.right
        return over > 0.5 ? [`${inner.textContent}: ${over.toFixed(1)} px`] : []
      }),
    )
    expect(spilled, lang).toEqual([])
  }
})
