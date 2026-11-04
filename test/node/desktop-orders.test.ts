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

// The title, its line and Add order are the page's own header; filters are tabs with counts, in one
// row with the search, at a desktop, at the playground's frame width and at a small tablet.
test.for([1280, 1044, 600])(
  'at %i px the page header holds Add order and the toolbar holds whole tabs and the search',
  async (width) => {
    const { page, errors } = await openOrders(width)
    const header = page.locator('eb-page')
    expect(await header.getAttribute('heading')).toBe('Orders')
    expect(await header.getAttribute('description')).toBe('Your store’s orders, newest first.')
    const add = page.locator('eb-page > eb-button[slot="actions"]')
    expect(await add.innerText()).toBe('Add order')
    expect(await add.getAttribute('variant')).toBe('primary')
    expect(await page.locator('eb-card[heading="Orders"]').count()).toBe(0)

    const tabs = page.getByRole('tablist', { name: 'Show' })
    // A tab's count is drawn after its label, from its count property.
    const names = await tabs
      .getByRole('tab')
      .evaluateAll((els) =>
        els.map((el) => `${el.textContent!.trim()} ${(el as HTMLElement & { count: number }).count}`),
      )
    expect(names).toEqual(['All 6', 'New 2', 'Confirmed 1', 'With courier 1', 'Returned 1'])
    expect(await tabs.getByRole('tab', { selected: true }).innerText()).toContain('All')
    const search = page.getByRole('searchbox', { name: 'Search orders' })
    expect(await search.count()).toBe(1)
    const [tabsBox, searchBox, table] = [
      await box(page, 'eb-tabs'),
      await box(page, '.toolbar eb-search-field'),
      await box(page, 'eb-table'),
    ]
    // One row from the playground's frame width: the search beside the tabs, its middle on theirs.
    // A narrower list puts the search under them. Either way the table comes under both.
    if (width >= 1044) {
      expect(searchBox.left).toBeGreaterThanOrEqual(tabsBox.right)
      expect(Math.abs((searchBox.top + searchBox.bottom) / 2 - (tabsBox.top + tabsBox.bottom) / 2)).toBeLessThanOrEqual(
        2,
      )
    } else expect(searchBox.top).toBeGreaterThanOrEqual(tabsBox.bottom)
    expect(searchBox.right).toBeLessThanOrEqual(width)
    // Every tab shows whole: the row does not have to scroll to reach one.
    const clipped = () =>
      page.locator('eb-tabs').evaluate((tabs) => {
        const row = tabs.shadowRoot!.querySelector('.row')!
        return row.scrollWidth - row.clientWidth
      })
    expect(await clipped()).toBe(0)
    await page.locator('.languages eb-button[data-lang="bn"]').click({ timeout: 5_000 })
    await expect.poll(() => page.locator('eb-tab').first().textContent()).toBe('সব')
    expect(await clipped()).toBe(0)
    expect(tabsBox.bottom).toBeLessThanOrEqual(table.top)
    expect(searchBox.bottom).toBeLessThanOrEqual(table.top)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
  },
)

test('in the playground at 1280 px the framed orders keep the tabs and the search in one row', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.locator('eb-row').first().waitFor({ timeout: 15_000 })
  const frameWidth = await app.locator('html').evaluate((html) => html.clientWidth)
  expect(frameWidth).toBeLessThan(1100)
  const tabs = await app.locator('eb-tabs').boundingBox()
  const search = await app.locator('.toolbar eb-search-field').boundingBox()
  expect(search!.x).toBeGreaterThanOrEqual(tabs!.x + tabs!.width)
  expect(Math.abs(search!.y + search!.height / 2 - (tabs!.y + tabs!.height / 2))).toBeLessThanOrEqual(2)
  expect(errors).toEqual([])
})

test('at 1280 px order #1039 shows in a pane beside the table, with Ask for advance and Confirm order', async () => {
  const { page, errors } = await openOrders(1280)
  const pane = page.locator('.pane')
  await pane.locator('eb-heading:defined').first().waitFor()
  expect(await pane.locator('eb-heading[level="1"]').textContent()).toBe('#1039')
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

test('the New tab shows only the new orders, and a search for 1040 only #1040', async () => {
  const { page, errors } = await openOrders(1280)
  const tabs = page.getByRole('tablist', { name: 'Show' })
  await tabs.getByRole('tab', { name: /^New/ }).click()
  await expect.poll(() => numbers(page)).toEqual(['1042', '1039'])
  expect(await tabs.getByRole('tab', { name: /^New/ }).getAttribute('aria-selected')).toBe('true')
  expect(await tabs.getByRole('tab', { name: /^All/ }).getAttribute('aria-selected')).toBe('false')
  await tabs.getByRole('tab', { name: /^All/ }).click()
  await page.getByRole('searchbox', { name: 'Search orders' }).fill('1040')
  await expect.poll(() => numbers(page)).toEqual(['1040'])
  expect(errors).toEqual([])
})

// The pane reads as one order: one line of meta, 12 px between its blocks, each price on its item's
// first line, and its actions in reach however far it scrolls.
test('at 1280 x 600 the pane has one meta line, 12 px blocks, prices on the first line and actions in view', async () => {
  const { page, errors } = await openOrders(1280)
  await page.setViewportSize({ width: 1280, height: 600 })
  const pane = page.locator('.pane')
  await pane.locator('eb-heading:defined').first().waitFor()
  expect(await pane.getByText(/2 h ago/).count()).toBe(1)
  const gaps = await page.locator('.pane-content').evaluate((content) => {
    const boxes = [...content.children].map((child) => child.getBoundingClientRect())
    return boxes.slice(1).map((box, i) => Math.round(box.top - boxes[i]!.bottom))
  })
  expect(gaps.length).toBeGreaterThanOrEqual(4)
  expect(new Set(gaps)).toEqual(new Set([12]))
  const items = pane.locator('eb-card[heading="Items"] eb-thumbnail')
  for (let i = 0; i < (await items.count()); i++) {
    const tops = await items.nth(i).evaluate((thumb) => {
      const row = thumb.parentElement!
      const [name, price] = [row.children[1]!.firstElementChild!, row.lastElementChild!]
      return [name.getBoundingClientRect().top, price.getBoundingClientRect().top]
    })
    expect(Math.abs(tops[0]! - tops[1]!)).toBeLessThanOrEqual(1)
  }
  const confirm = pane.getByRole('button', { name: 'Confirm order' })
  const inView = async () => {
    const box = (await confirm.boundingBox())!
    return box.y >= 0 && box.y + box.height <= 600
  }
  expect(await inView()).toBe(true)
  await page.mouse.wheel(0, 300)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  expect(await inView()).toBe(true)
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

// The risk flag rides beside the customer's name, its icon centred on the name's ink rather than on
// the line box, in which Bangla sits low.
for (const lang of ['en', 'bn']) {
  test(`at 1280 px in ${lang} the risk flag's icon sits on the middle of the name, within 1 px`, async () => {
    const { page } = await openOrders(1280)
    await page.locator(`.languages eb-button[data-lang="${lang}"]`).click()
    await page.locator(`html[lang="${lang}"]`).waitFor({ state: 'attached' })
    const flag = page.locator('eb-row eb-tooltip').first()
    await flag.waitFor()
    await page.evaluate(() => document.fonts.ready)
    const offset = await flag.evaluate((tooltip) => {
      const name = tooltip.parentElement!.firstChild as Text
      const style = getComputedStyle(tooltip.parentElement!)
      const context = document.createElement('canvas').getContext('2d')!
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const ink = context.measureText(name.data.trim())
      const range = document.createRange()
      range.selectNodeContents(name)
      const baseline = range.getBoundingClientRect().top + ink.fontBoundingBoxAscent
      const inkMiddle = baseline + (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2
      const icon = tooltip.querySelector('svg')!.getBoundingClientRect()
      return icon.top + icon.height / 2 - inkMiddle
    })
    expect(Math.abs(offset), `${offset.toFixed(2)} px off`).toBeLessThanOrEqual(1)
  })
}

// A tab's count is drawn in the page's language, so a switch to Bangla redraws it in Bangla digits.
test('after a switch to Bangla the status tabs count in Bangla digits, and in English again after', async () => {
  const { page, errors } = await openOrders(1280)
  const counts = () =>
    page
      .locator('eb-tab')
      .evaluateAll((tabs) => tabs.map((tab) => tab.shadowRoot!.querySelector('.count')?.textContent))
  expect(await counts()).toEqual(['6', '2', '1', '1', '1'])
  await page.locator('.languages eb-button[data-lang="bn"]').click()
  await expect.poll(counts).toEqual(['৬', '২', '১', '১', '১'])
  await page.locator('.languages eb-button[data-lang="en"]').click()
  await expect.poll(counts).toEqual(['6', '2', '1', '1', '1'])
  expect(errors).toEqual([])
})
