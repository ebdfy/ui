import { expect, test } from 'vitest'
// e-table and e-row: drawn by v2.css alone as a grid whose columns line up across rows, with the
// script adding table roles without moving anything.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineTable } from '../../src/v2/table.ts'
import { inDark } from './colour.ts'

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

test('without the script every body row is 42 px and the columns line up across the head and rows', () => {
  render(orders())
  const rows = [...document.querySelectorAll('e-row:not([head])')]
  // An e-row has no box of its own (display: contents), so a row's height is its cells' height.
  expect(rows.map((r) => [...r.children].map((c) => c.getBoundingClientRect().height))).toEqual([
    [42, 42, 42, 42],
    [42, 42, 42, 42],
    [42, 42, 42, 42],
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

test('in dark the head row sits on surface-2 and body text is the foreground colour', async () => {
  render(orders())
  defineTable()
  const probe = (prop: 'color' | 'backgroundColor', name: string) => {
    const p = document.createElement('div')
    p.style[prop] = `var(--e-color-${name})`
    document.body.append(p)
    const c = getComputedStyle(p)[prop]
    p.remove()
    return c
  }
  const seen = await inDark(async () => [
    getComputedStyle(document.querySelector('e-row[head] > span')!).backgroundColor,
    getComputedStyle(document.querySelector('e-row:not([head]) > span:nth-child(3)')!).color,
    probe('backgroundColor', 'surface-2'),
    probe('color', 'fg'),
  ])
  expect(seen[0]).toBe(seen[2])
  expect(seen[1]).toBe(seen[3])
})
