// A table's totals row, read on /components/table where a person meets it: the last row, in 600
// weight under a 1 px rule, with its figures in the columns of the rows above, in English and Bangla.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// Every table on the page that ends in a totals row: the English example's and the Bangla one's.
const totalTables = 'e-table:has(> e-row[total])'

function read(page: Page) {
  return page.evaluate((selector) => {
    return [...document.querySelectorAll(selector)].map((table) => {
      const rows = [...table.querySelectorAll(':scope > e-row')]
      const total = rows.at(-1)!
      const above = rows.at(-2)!
      const style = getComputedStyle(total.children[0]!)
      return {
        lang: table.closest('[lang]')?.getAttribute('lang') ?? '',
        last: total.hasAttribute('total'),
        weights: [...total.children].map((cell) => getComputedStyle(cell).fontWeight),
        top: style.borderTopWidth,
        bottom: style.borderBottomWidth,
        aboveBottom: getComputedStyle(above.children[0]!).borderBottomWidth,
        // Each row's end-aligned figures: where their text ends and where their cell starts.
        ends: rows.map((row) => {
          return [...row.querySelectorAll(':scope > [align="end"]')].map((cell) => {
            const text = document.createRange()
            text.selectNodeContents(cell)
            return Math.round(text.getBoundingClientRect().right)
          })
        }),
        lefts: rows.map((row) => [...row.children].map((cell) => Math.round(cell.getBoundingClientRect().left))),
        scroll: { width: table.scrollWidth, client: table.clientWidth },
        role: total.getAttribute('role'),
      }
    })
  }, totalTables)
}

test('the totals example ends in a row at 600 weight under a 1 px rule, with no rule below it', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/table`, 1440)
  const tables = await read(page)
  expect(tables.map((table) => table.lang)).toEqual(['en', 'bn'])
  for (const table of tables) {
    expect(table.last).toBe(true)
    expect(new Set(table.weights)).toEqual(new Set(['600']))
    expect(table.top).toBe('1px')
    expect(table.bottom).toBe('0px')
    // The row above gives up its own rule, so the totals row's is the only one: 1 px, not 2.
    expect(table.aboveBottom).toBe('0px')
    expect(table.role).toBe('row')
  }
  expect(errors).toEqual([])
})

for (const width of [1440, 360]) {
  test(`at ${width} px each figure of the totals row ends within 1 px of the figures above it`, async () => {
    const { page } = await pages.open(`${pages.ui}/components/table`, width)
    for (const table of await read(page)) {
      const [head, ...body] = table.ends
      expect(head!.length).toBe(5)
      for (const row of body) {
        for (const [i, end] of row.entries()) {
          expect(Math.abs(end - head![i]!), `${table.lang} column ${i}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })
}

test('at 360 px a table wider than its card scrolls sideways with its totals row under its columns', async () => {
  const { page } = await pages.open(`${pages.ui}/components/table`, 360)
  const before = await read(page)
  for (const table of before) expect(table.scroll.width, table.lang).toBeGreaterThan(table.scroll.client)
  await page.evaluate((selector) => {
    for (const table of document.querySelectorAll(selector)) table.scrollLeft = table.scrollWidth
  }, totalTables)
  for (const table of await read(page)) {
    const [head, ...body] = table.lefts
    for (const row of body) expect(row, table.lang).toEqual(head)
    // Scrolled to its end, the last figure of each row ends at the same place.
    const lastEnds = table.ends.map((row) => row.at(-1)!)
    expect(Math.max(...lastEnds) - Math.min(...lastEnds), table.lang).toBeLessThanOrEqual(1)
  }
})

test('with v2.js held back the totals row draws the same, and nothing moves over 1 px once it runs', async () => {
  const { page } = await pages.open('', 360)
  let release = () => {}
  const held = new Promise<void>((done) => (release = done))
  await page.route(/\/ui\/v2\.js/, async (route) => {
    await held
    await route.continue()
  })
  const loaded = page.goto(`${pages.ui}/components/table`)
  await page.waitForSelector(`${totalTables} e-row[total] > :last-child`)
  const boxes = () =>
    page.evaluate((selector) => {
      return [...document.querySelectorAll(`${selector} e-row > *`)].map((cell) => {
        const { left, top, width, height } = cell.getBoundingClientRect()
        return [left, top, width, height]
      })
    }, totalTables)
  const before = await boxes()
  const weights = await page.evaluate(() => getComputedStyle(document.querySelector('e-row[total] > *')!).fontWeight)
  expect(weights).toBe('600')
  release()
  await loaded
  await page.waitForFunction(() => customElements.get('e-row') && document.querySelector('e-row[total][role="row"]'))
  const after = await boxes()
  expect(after.length).toBe(before.length)
  for (const [i, box] of after.entries()) {
    for (const [j, value] of box.entries()) expect(Math.abs(value - before[i]![j]!)).toBeLessThanOrEqual(1)
  }
})
