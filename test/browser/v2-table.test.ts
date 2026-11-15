import { expect, test } from 'vitest'
// e-table and e-row: drawn by v2.css alone as a grid whose columns line up across rows, with the
// script adding table roles without moving anything.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineTable } from '../../src/v2/table.ts'
import { contrast, inDark } from './colour.ts'

const row = (id: number, customer: string) =>
  `<e-row><a href="/orders/${id}">#${id}</a><span tone="subdued">Today 11:24</span><span>${customer}</span><span align="end">৳1,930</span></e-row>`

const head =
  '<e-row head><span>Order</span><span>Date</span><span>Customer</span><span align="end">Total</span></e-row>'

const orders = (attrs = 'style="--e-columns: auto auto 1fr auto"') =>
  `<div style="width: 1024px"><e-table label="Orders" ${attrs}>${head}${row(1042, 'Rahima Akter')}${row(1043, 'Nusrat Jahan Mim')}${row(1044, 'Al')}</e-table></div>`

function render(html: string): void {
  document.body.innerHTML = html
}

const cells = () => [...document.querySelectorAll('e-row > *')]
const lefts = (r: Element) => [...r.children].map((c) => Math.round(c.getBoundingClientRect().left))

test('without the script every body row is 44 px and the columns line up across the head and rows', () => {
  render(orders())
  const rows = [...document.querySelectorAll('e-row:not([head])')]
  // An e-row has no box of its own (display: contents), so a row's height is its cells' height.
  expect(rows.map((r) => [...r.children].map((c) => c.getBoundingClientRect().height))).toEqual([
    [44, 44, 44, 44],
    [44, 44, 44, 44],
    [44, 44, 44, 44],
  ])
  const headRow = document.querySelector('e-row[head]')!
  const expected = lefts(headRow)
  expect(expected.length).toBe(4)
  for (const r of rows) expect(lefts(r)).toEqual(expected)
  const total = document.querySelector('e-row:not([head]) > [align="end"]')!
  expect(getComputedStyle(total).textAlign).toBe('right')
  const t = total.getBoundingClientRect()
  const table = document.querySelector('e-table')!.getBoundingClientRect()
  expect(Math.round(t.right)).toBe(Math.round(table.right))
  for (const tag of document.querySelectorAll('e-table, e-row')) {
    const box = getComputedStyle(tag)
    expect(box.display === 'inline' && tag.getBoundingClientRect().height === 0).toBe(false)
  }
})

test('a table with no columns still lines its columns up', () => {
  render(orders(''))
  const rows = [...document.querySelectorAll('e-row')]
  const expected = lefts(rows[0]!)
  expect(new Set(expected).size).toBe(4)
  for (const r of rows) expect(lefts(r)).toEqual(expected)
})

// This test must stay before the first defineTable() of the file: it compares the CSS-only draw with
// the one after the script, and a defined e-table would copy the columns at once.
test('a columns attribute draws its columns before the script, where the script puts them', () => {
  expect(customElements.get('e-table')).toBeUndefined()
  render(
    `<e-table label="T" columns="80px 1fr 120px"><e-row head><span>A</span><span>B</span><span>C</span></e-row>` +
      `<e-row><span>a</span><span>b</span><span>c</span></e-row></e-table>`,
  )
  const boxes = () => cells().map((c) => c.getBoundingClientRect())
  const before = boxes()
  expect(before.slice(0, 3).map((b) => b.width)).toEqual([80, before[1]!.width, 120])
  expect(before[1]!.width).toBeGreaterThan(120)
  defineTable()
  expect(document.querySelector<HTMLElement>('e-table')!.style.getPropertyValue('--e-columns')).toBe('80px 1fr 120px')
  boxes().forEach((a, i) => {
    for (const k of ['left', 'top', 'width', 'height'] as const)
      expect(Math.abs(a[k] - before[i]![k])).toBeLessThanOrEqual(1)
  })
})

test('the script gives roles and nothing moves by more than 1 px', async () => {
  render(orders())
  const before = cells().map((c) => c.getBoundingClientRect())
  defineTable()
  await expect.element(page.getByRole('table', { name: 'Orders' })).toBeVisible()
  expect(document.querySelectorAll('[role="row"]').length).toBe(4)
  expect(document.querySelectorAll('[role="columnheader"]').length).toBe(4)
  // The three order links keep their link role, which a cell role would replace.
  expect(document.querySelectorAll('[role="cell"]').length).toBe(9)
  await expect.element(page.getByRole('link', { name: '#1042' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Orders' })
  await expect.element(table.getByRole('row').first()).toBeVisible()
  cells().forEach((c, i) => {
    const a = c.getBoundingClientRect()
    const b = before[i]!
    for (const k of ['left', 'top', 'width', 'height'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThanOrEqual(1)
  })
})

test('a row appended after the script ran gets its roles', () => {
  render(orders())
  defineTable()
  document.querySelector('e-table')!.insertAdjacentHTML('beforeend', row(1045, 'Late'))
  const added = document.querySelector('e-row:last-child')!
  expect(added.getAttribute('role')).toBe('row')
  expect([...added.children].map((c) => c.getAttribute('role'))).toEqual([null, 'cell', 'cell', 'cell'])
})

test('the columns attribute sets the grid columns once the script ran', () => {
  render(orders('columns="80px 100px 1fr 120px"'))
  defineTable()
  const widths = [...document.querySelector('e-row[head]')!.children].map((c) => c.getBoundingClientRect().width)
  expect(widths).toEqual([80, 100, 1024 - 300, 120])
})

test('at 360 px a seven-column table scrolls inside e-table, not the page', () => {
  const cell = (n: number) => `<span>Column ${n} of the long table</span>`
  const seven = [1, 2, 3, 4, 5, 6, 7].map(cell).join('')
  render(`<e-table label="Wide"><e-row head>${seven}</e-row><e-row>${seven}</e-row></e-table>`)
  defineTable()
  const table = document.querySelector('e-table')!
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  expect(table.scrollWidth).toBeGreaterThan(table.clientWidth)
})

test('without the script a cell link is a real link', async () => {
  render(orders())
  await expect.element(page.getByRole('link', { name: '#1042' })).toHaveAttribute('href', '/orders/1042')
})

const probe = (prop: 'color' | 'backgroundColor', value: string) => {
  const p = document.createElement('div')
  p.style[prop] = value
  document.body.append(p)
  const c = getComputedStyle(p)[prop]
  p.remove()
  return c
}

test('at 1440 px the head row is 36 px on surface in 12px 500 fg3, body rows 44 px, edges padded 20 px', async () => {
  await page.viewport(1440, 900)
  render(orders())
  const headCells = [...document.querySelectorAll('e-row[head] > *')]
  const first = headCells[0]!
  const s = getComputedStyle(first)
  expect(headCells.map((c) => c.getBoundingClientRect().height)).toEqual([36, 36, 36, 36])
  expect(s.backgroundColor).toBe(probe('backgroundColor', 'var(--e-color-surface)'))
  expect(s.color).toBe(probe('color', 'var(--e-color-fg3)'))
  expect(s.fontSize).toBe('12px')
  expect(s.fontWeight).toBe('500')
  expect(
    [...document.querySelectorAll('e-row:not([head]) > *')].every((c) => c.getBoundingClientRect().height === 44),
  ).toBe(true)
  expect(s.paddingLeft).toBe('20px')
  expect(getComputedStyle(headCells[3]!).paddingRight).toBe('20px')
})

test('a body row tints on hover and a selected row takes a lime tint, stronger on hover', async () => {
  render(
    `<e-table label="T" style="--e-columns: 1fr 1fr"><e-row head><span>A</span><span>B</span></e-row>` +
      `<e-row><span id="plain">a</span><span>b</span></e-row><e-row selected><span id="sel">c</span><span>d</span></e-row></e-table>`,
  )
  const plain = document.querySelector<HTMLElement>('#plain')!
  const sel = document.querySelector<HTMLElement>('#sel')!
  const tint = (pct: number) =>
    probe('backgroundColor', `color-mix(in oklab, var(--e-color-lime) ${pct}%, var(--e-color-surface))`)
  expect(getComputedStyle(sel).backgroundColor).toBe(tint(22))
  expect(getComputedStyle(sel).backgroundColor).not.toBe(getComputedStyle(plain).backgroundColor)
  await page.elementLocator(plain).hover()
  expect(getComputedStyle(plain).backgroundColor).toBe(probe('backgroundColor', 'var(--e-color-surface-2)'))
  await page.elementLocator(sel).hover()
  expect(getComputedStyle(sel).backgroundColor).toBe(tint(30))
})

test('a cell holding an e-stack aligns it to the top with 10 px above', () => {
  render(
    `<e-table label="T" style="--e-columns: 1fr 1fr"><e-row><div><e-stack gap="1"><e-text>Rahima Akter</e-text>` +
      `<e-text tone="subdued">01711-000000</e-text></e-stack></div><span>x</span></e-row></e-table>`,
  )
  const cell = document.querySelector('e-row > div')!.getBoundingClientRect()
  const stack = document.querySelector('e-stack')!.getBoundingClientRect()
  expect(Math.abs(stack.top - cell.top - 10)).toBeLessThanOrEqual(1)
})

const wrapTable = (selected: boolean, lang = 'en') =>
  `<div lang="${lang}"><e-table label="T" style="--e-columns: 60px 150px 60px"><e-row head><span>A</span><span>B</span><span>C</span></e-row>` +
  `<e-row ${selected ? 'selected' : ''}><span>x</span><span wrap>${'word '.repeat(9)}</span><span>y</span></e-row>` +
  `<e-row><span>x</span><span>y</span><span>z</span></e-row></e-table></div>`

const lineCount = (el: Element) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
}

test('a wrap cell grows its row to 3 lines with 10 px above and below', () => {
  render(wrapTable(false))
  const cell = document.querySelector<HTMLElement>('[wrap]')!
  const s = getComputedStyle(cell)
  expect(lineCount(cell)).toBe(3)
  expect(s.paddingTop).toBe('10px')
  expect(s.paddingBottom).toBe('10px')
  const box = cell.getBoundingClientRect()
  // 3 lines of body line height plus 10 px each side, and the 1 px rule under the row.
  expect(Math.abs(box.height - (3 * Number.parseFloat(s.lineHeight) + 20 + 1))).toBeLessThanOrEqual(1)
  const other = document.querySelector('e-row:last-child > *')!.getBoundingClientRect()
  expect(other.height).toBe(44)
  expect(box.height).toBeGreaterThan(other.height)
  const text = document.createRange()
  text.selectNodeContents(cell)
  const first = text.getClientRects()[0]!
  // The first line box sits 10 px under the cell's top; the glyph box is inside it by half the leading.
  expect(first.top - box.top).toBeGreaterThanOrEqual(10)
  expect(first.top - box.top).toBeLessThan(10 + (Number.parseFloat(s.lineHeight) - first.height) / 2 + 1)
})

for (const lang of ['en', 'bn']) {
  test(`a selected row with a wrap cell tints every cell over the full row height, in ${lang}`, () => {
    render(wrapTable(true, lang))
    const cellsOfRow = [...document.querySelectorAll('e-row')[1]!.children]
    const tint = probe('backgroundColor', 'var(--e-color-row-selected)')
    const wrapped = cellsOfRow[1]!.getBoundingClientRect()
    expect(wrapped.height).toBeGreaterThan(44)
    for (const c of cellsOfRow) {
      const b = c.getBoundingClientRect()
      expect(getComputedStyle(c).backgroundColor).toBe(tint)
      expect(Math.abs(b.top - wrapped.top)).toBeLessThanOrEqual(1)
      expect(Math.abs(b.bottom - wrapped.bottom)).toBeLessThanOrEqual(1)
    }
  })
}

test('a clip cell cuts a long name with an ellipsis and the row stays 44 px', () => {
  render(
    `<e-table label="T" style="--e-columns: 120px 1fr"><e-row><span clip><span>${'Rahima '.repeat(43)}</span></span><span>x</span></e-row></e-table>`,
  )
  const inner = document.querySelector('[clip] > span')!
  expect(getComputedStyle(inner).textOverflow).toBe('ellipsis')
  expect(inner.scrollWidth).toBeGreaterThan(inner.clientWidth)
  expect(document.querySelector('[clip]')!.getBoundingClientRect().height).toBe(44)
  expect(document.querySelector('[clip]')!.getBoundingClientRect().width).toBe(120)
})

test('only end-aligned cells use tabular figures', () => {
  render(orders())
  expect(getComputedStyle(document.querySelector('e-row:not([head]) > span:nth-child(3)')!).fontVariantNumeric).toBe(
    'normal',
  )
  expect(getComputedStyle(document.querySelector('e-row:not([head]) > [align="end"]')!).fontVariantNumeric).toBe(
    'tabular-nums',
  )
})

test('in dark the head row sits on surface and body text is the foreground colour', async () => {
  render(orders())
  defineTable()
  const seen = await inDark(async () => [
    getComputedStyle(document.querySelector('e-row[head] > span')!).backgroundColor,
    getComputedStyle(document.querySelector('e-row:not([head]) > span:nth-child(3)')!).color,
    probe('backgroundColor', 'var(--e-color-surface)'),
    probe('color', 'var(--e-color-fg)'),
  ])
  expect(seen[0]).toBe(seen[2])
  expect(seen[1]).toBe(seen[3])
})

test('in dark subdued text keeps 4.5:1 on a selected row, at rest and on hover', async () => {
  render(
    `<e-table label="T" style="--e-columns: 1fr 1fr"><e-row selected><span id="sel" tone="subdued">Today 11:24</span><span>d</span></e-row></e-table>`,
  )
  const sel = document.querySelector<HTMLElement>('#sel')!
  const read = () => {
    const s = getComputedStyle(sel)
    // The tint resolves to oklab; read it back as oklch, which the contrast helper takes.
    const ground = document.createElement('div')
    ground.style.color = `oklch(from ${s.backgroundColor} l c h)`
    document.body.append(ground)
    const bg = getComputedStyle(ground).color
    ground.remove()
    return { fg: s.color, bg }
  }
  const [rest, hover] = await inDark(async () => {
    const one = read()
    await page.elementLocator(sel).hover()
    return [one, read()]
  })
  expect(contrast(rest!.fg, rest!.bg)).toBeGreaterThanOrEqual(4.5)
  expect(contrast(hover!.fg, hover!.bg)).toBeGreaterThanOrEqual(4.5)
})
