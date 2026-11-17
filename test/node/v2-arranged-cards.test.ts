// e-arranged-cards on the playground's Reports page, the way a staff member arranges it: Customize,
// move, remove and add cards, Done, and the order the dev server keeps comes back on a reload.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const defaults = 'net-sales orders average-order-value return-rate net-sales-chart sales-report products-report'

async function reports(width = 1440) {
  const opened = await pages.open(`${pages.ui}/playground/reports`, width)
  await opened.page.waitForFunction(() => customElements.get('e-arranged-cards') && customElements.get('e-card'))
  return opened
}

const customize = (page: Page) => page.getByRole('button', { name: 'Customize' }).click()

const shown = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('e-arranged-cards > [card]')]
      .filter((card) => !card.hidden)
      .map((card) => card.getAttribute('heading')),
  )

const strip = (page: Page, card: string) => page.locator(`[card="${card}"] > [data-part="strip"]`)

// Done, and the card ids its form posts.
async function done(page: Page): Promise<string> {
  const posted = page.waitForRequest((request) => request.method() === 'POST')
  await page.getByRole('button', { name: 'Done' }).click()
  const request = await posted
  expect(new URL(request.url()).pathname).toBe('/playground/reports')
  const cards = new URLSearchParams(request.postData() ?? '').get('cards') ?? ''
  await page.waitForLoadState('load')
  return cards
}

async function addCard(page: Page, name: string): Promise<void> {
  await page.locator('e-arranged-cards > [data-part="add"]').click()
  await page.locator('#card-library dialog').waitFor()
  await page.locator('#card-library').getByRole('button', { name, exact: true }).click()
}

test('picking Top products in Add card shows a "Top products" placeholder last, before Done', async () => {
  const { page, errors } = await reports()
  await customize(page)
  await addCard(page, 'Top products')
  expect((await shown(page)).at(-1)).toBe('Top products')
  const last = page.locator('e-arranged-cards > [card]:not([hidden])').last()
  expect(await last.getAttribute('data-placeholder')).toBe('')
  expect(await last.textContent()).toContain('Shows once you press Done.')
  expect(await page.locator('#card-library dialog[open]').count()).toBe(0)
  expect(errors).toEqual([])
})

test('remove Products report, Add card > Top products, Done: the form posts the order and a reload keeps it', async () => {
  const { page } = await reports()
  await customize(page)
  await strip(page, 'products-report').getByRole('button', { name: 'Remove Products report' }).click()
  await addCard(page, 'Top products')
  expect(await done(page)).toBe(
    'net-sales orders average-order-value return-rate net-sales-chart sales-report top-products',
  )
  await page.reload()
  expect(await shown(page)).toEqual([
    'Net sales',
    'Orders',
    'Average order value',
    'Return rate',
    'Net sales a day',
    'Sales report',
    'Top products',
  ])
  // Edit mode is over: no strip, bar or tile is left in the page.
  expect(await page.locator('e-arranged-cards [data-part]').count()).toBe(0)
})

test('dragging Sales report above the chart by its handle and Done posts Sales report first of the two', async () => {
  const { page } = await reports()
  await customize(page)
  const handle = strip(page, 'sales-report').locator('[data-part="handle"]')
  await handle.scrollIntoViewIfNeeded()
  const from = (await handle.boundingBox())!
  const chart = (await page.locator('[card="net-sales-chart"]').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  // Into the chart's near half, low down and at its start, so Sales report goes before it.
  await page.mouse.move(chart.x + 20, chart.y + chart.height * 0.75, { steps: 8 })
  await page.mouse.up()
  const ids = (await done(page)).split(' ')
  expect(ids.indexOf('sales-report')).toBeLessThan(ids.indexOf('net-sales-chart'))
  expect(ids).toHaveLength(7)
})

test('dropping Orders on the strip of Net sales, beside it, puts Orders first', async () => {
  const { page } = await reports()
  await customize(page)
  const from = (await strip(page, 'orders').locator('[data-part="handle"]').boundingBox())!
  const to = (await strip(page, 'net-sales').locator('span').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 6 })
  await page.mouse.up()
  expect((await shown(page)).slice(0, 2)).toEqual(['Orders', 'Net sales'])
})

test('pressing Reset to default brings back the 7 default cards in order, and the library lists only the others', async () => {
  const { page } = await reports()
  await customize(page)
  await strip(page, 'orders').getByRole('button', { name: 'Remove Orders' }).click()
  await addCard(page, 'Low stock')
  await strip(page, 'low-stock').getByRole('button', { name: 'Remove Low stock' }).click()
  await addCard(page, 'Orders')
  await page.getByRole('button', { name: 'Reset to default' }).click()
  expect(await shown(page)).toEqual([
    'Net sales',
    'Orders',
    'Average order value',
    'Return rate',
    'Net sales a day',
    'Sales report',
    'Products report',
  ])
  await page.locator('e-arranged-cards > [data-part="add"]').click()
  const offered = await page
    .locator('#card-library [card]')
    .evaluateAll((entries) =>
      entries.filter((entry) => !(entry as HTMLElement).hidden).map((entry) => entry.textContent),
    )
  expect(offered).toEqual(['Top products', 'Sales by channel', 'Low stock'])
})

test('with every card on the page, a removed card is offered in the library and drawn nowhere else', async () => {
  const { page } = await pages.open('', 1440)
  await page.request.post(`${pages.ui}/playground/reports`, {
    form: { cards: `${defaults} top-products sales-by-channel low-stock` },
    maxRedirects: 0,
  })
  await page.goto(`${pages.ui}/playground/reports`)
  await page.waitForFunction(() => customElements.get('e-arranged-cards') && customElements.get('e-card'))
  await customize(page)
  await strip(page, 'orders').getByRole('button', { name: 'Remove Orders' }).click()
  expect(await page.locator('[card="orders"]:not(e-arranged-cards > *):not(#card-library dialog *)').count()).toBe(0)
  await addCard(page, 'Orders')
  expect((await shown(page)).at(-1)).toBe('Orders')
})

test('after removing two cards, Reset to default then Done posts the default order', async () => {
  const { page } = await reports()
  await customize(page)
  await strip(page, 'orders').getByRole('button', { name: 'Remove Orders' }).click()
  await strip(page, 'sales-report').getByRole('button', { name: 'Remove Sales report' }).click()
  await page.getByRole('button', { name: 'Reset to default' }).click()
  expect(await done(page)).toBe(defaults)
})

test('at 360 px Move up on the second card makes it first; the ends are disabled; each arrow is 44 by 44 px', async () => {
  const { page } = await reports(360)
  await customize(page)
  const up = strip(page, 'orders').getByRole('button', { name: 'Move Orders up' })
  await up.click()
  expect((await shown(page)).slice(0, 2)).toEqual(['Orders', 'Net sales'])
  expect(await up.isDisabled()).toBe(true)
  expect(
    await strip(page, 'products-report').getByRole('button', { name: 'Move Products report down' }).isDisabled(),
  ).toBe(true)
  for (const button of await page.locator('[data-part="strip"] > :is([data-part="up"], [data-part="down"])').all()) {
    expect(await button.boundingBox()).toMatchObject({ width: 44, height: 44 })
  }
  expect(await page.locator('[data-part="handle"]').first().isVisible()).toBe(false)
  // Focus stays on the arrows that moved the card: Move down, now that Move up is disabled.
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('Move Orders down')
})

for (const width of [1440, 360]) {
  test(`at ${width} px no strip covers a card's own actions, which keep their box in the card`, async () => {
    const { page } = await reports(width)
    // Each card's own header controls, as the card shows them: its actions, or its More on a phone.
    const read = () =>
      page.evaluate(() => {
        const controls = [
          ...document.querySelectorAll<HTMLElement>(
            'e-arranged-cards > [card] > [slot="actions"], e-arranged-cards > [card] > [data-part="more"]',
          ),
        ].filter((control) => control.getBoundingClientRect().width > 0)
        const strips = [...document.querySelectorAll('[data-part="strip"]')].map((one) => one.getBoundingClientRect())
        return controls.map((control) => {
          const box = control.getBoundingClientRect()
          const card = control.parentElement!.getBoundingClientRect()
          const covered = strips.some(
            (over) => over.left < box.right && box.left < over.right && over.top < box.bottom && box.top < over.bottom,
          )
          return { at: [box.left - card.left, box.top - card.top, box.width, box.height], covered }
        })
      })
    const before = await read()
    expect(before.length).toBeGreaterThanOrEqual(2)
    await customize(page)
    const after = await read()
    expect(after.map((control) => control.at)).toEqual(before.map((control) => control.at))
    expect(after.filter((control) => control.covered)).toEqual([])
  })
}

test('edit mode entered at 1440 px and resized to 360 px shows the arrows and Done, and Done still posts', async () => {
  const { page } = await reports(1440)
  await customize(page)
  await page.setViewportSize({ width: 360, height: 800 })
  expect(await strip(page, 'orders').getByRole('button', { name: 'Move Orders up' }).isVisible()).toBe(true)
  expect(await page.getByRole('button', { name: 'Done' }).isVisible()).toBe(true)
  await strip(page, 'orders').getByRole('button', { name: 'Move Orders up' }).click()
  expect(await done(page)).toBe(
    'orders net-sales average-order-value return-rate net-sales-chart sales-report products-report',
  )
})

test('pressing Esc in the library closes it, and focus goes back to Add card', async () => {
  const { page } = await reports()
  await customize(page)
  await page.locator('e-arranged-cards > [data-part="add"]').click()
  await page.locator('#card-library dialog[open]').waitFor()
  // Each entry is a row of its own, 44 px tall and as wide as the list.
  const rows = await page.locator('#card-library [card]').evaluateAll((entries) =>
    entries.map((entry) => {
      const { width, height } = entry.getBoundingClientRect()
      return { width: Math.round(width), height, left: Math.round(entry.getBoundingClientRect().left) }
    }),
  )
  expect(new Set(rows.map((row) => row.left)).size).toBe(1)
  for (const row of rows) expect(row).toMatchObject({ width: rows[0]!.width, height: 44 })
  await page.keyboard.press('Escape')
  expect(await page.locator('#card-library dialog[open]').count()).toBe(0)
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-part'))).toBe('add')
})

test('on /components/arranged-cards, Customize, Move and Done work in both languages, and Done posts nowhere', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/arranged-cards`, 1440)
  await page.waitForFunction(() => customElements.get('e-arranged-cards') && customElements.get('e-card'))
  for (const [lang, customize, done, move] of [
    ['en', 'Customize', 'Done', 'Move Orders'],
    ['bn', 'সাজান', 'সম্পন্ন', 'অর্ডার সরান'],
  ]) {
    const example = page.locator(`.example:has(e-arranged-cards[id="cards-${lang}"])`)
    await example.getByRole('button', { name: customize, exact: true }).click()
    await example.getByRole('button', { name: move, exact: true }).press('ArrowLeft')
    const url = page.url()
    await example.getByRole('button', { name: done, exact: true }).click()
    expect(await example.locator('output').textContent()).toBe('cards: orders net-sales sales-report')
    expect(page.url()).toBe(url)
    expect(await example.locator('e-arranged-cards [data-part]').count()).toBe(0)
  }
  expect(errors).toEqual([])
})
