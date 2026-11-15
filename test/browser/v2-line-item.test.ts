// e-line-item: an order line drawn by v2.css alone, on one row where its box has room and on two
// where it is narrow, as beside a record page's side column.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineThumbnail } from '../../src/v2/thumbnail.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const line = (title: string, meta: string, price: string, amount: string, lang = 'en') =>
  `<e-line-item lang="${lang}"><e-thumbnail></e-thumbnail><span slot="title">${title}</span><span slot="meta">${meta}</span><span slot="price">${price}</span><span slot="amount">${amount}</span></e-line-item>`

const rect = (el: Element) => el.getBoundingClientRect()
const part = (item: Element, slot: string) => item.querySelector(`[slot="${slot}"]`)!

test('at 1280 px two lines align their amounts at the line’s right edge', async () => {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<div style="width: 700px">${line('Jamdani saree', 'Red, M', '1 × ৳1,450', '৳1,450')}${line('Cotton panjabi', 'Blue, L', '12 × ৳380', '৳4,560')}</div>`
  const items = document.querySelectorAll('e-line-item')
  expect(items).toHaveLength(2)
  for (const item of items) {
    const thumb = item.querySelector('e-thumbnail')!
    expect([rect(thumb).width, rect(thumb).height]).toEqual([40, 40])
    expect(part(item, 'price').textContent).toMatch(/^\d+ × /)
    expect(Math.round(rect(part(item, 'amount')).right)).toBe(Math.round(rect(item).right))
    expect(getComputedStyle(part(item, 'amount')).textAlign).toBe('end')
    expect(getComputedStyle(part(item, 'amount')).fontVariantNumeric).toBe('tabular-nums')
    expect(getComputedStyle(part(item, 'meta')).fontSize).toBe('13px')
  }
  const [a, b] = items
  expect(rect(a!).bottom).toBeLessThanOrEqual(rect(b!).top)
  expect(getComputedStyle(b!).borderTopWidth).toBe('1px')
})

test('at 360 px the price sits under the title and the amount is on the title’s first line', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = line('Jamdani saree', 'Red, M', '1 × ৳1,450', '৳1,450')
  const item = document.querySelector('e-line-item')!
  const title = rect(part(item, 'title'))
  expect(rect(part(item, 'price')).top).toBeGreaterThan(title.bottom - 1)
  expect(rect(part(item, 'meta')).top).toBeGreaterThanOrEqual(title.bottom - 1)
  expect(rect(part(item, 'amount')).top).toBeLessThan(title.top + 24)
})

test('at 650 px, in a main column beside a side column, a line keeps its title readable', async () => {
  await page.viewport(650, 800)
  document.body.innerHTML = `<div style="width: 224px">${line('Cotton panjabi', 'Blue, L', '12 × ৳380', '৳4,560')}</div>`
  const item = document.querySelector('e-line-item')!
  expect(rect(part(item, 'title')).width).toBeGreaterThan(80)
  expect(rect(part(item, 'price')).top).toBeGreaterThan(rect(part(item, 'title')).bottom - 1)
  expect(Math.round(rect(part(item, 'amount')).right)).toBe(Math.round(rect(item).right))
  expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth)
})

test('a long Bangla title wraps beside the amount, which stays at the line’s edge', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = line('জামদানি শাড়ি, হাতে বোনা, লাল ও সোনালি পাড়', 'লাল, M', '১ × ৳১,৪৫০', '৳১,৪৫০', 'bn')
  const item = document.querySelector('e-line-item')!
  const title = part(item, 'title')
  const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight)
  expect(rect(title).height).toBeGreaterThan(1.6 * lineHeight)
  expect(rect(part(item, 'amount')).left).toBeGreaterThanOrEqual(rect(title).right)
  expect(Math.round(rect(part(item, 'amount')).right)).toBe(Math.round(rect(item).right))
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
})

test('upgrading the thumbnail moves nothing', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = line('Jamdani saree', 'Red, M', '1 × ৳1,450', '৳1,450')
  const all = [...document.querySelectorAll('e-line-item, e-line-item > *')]
  const before = all.map((el) => rect(el))
  defineThumbnail()
  for (const [i, el] of all.entries()) {
    const r = rect(el)
    for (const k of ['top', 'left', 'width', 'height'] as const)
      expect(Math.abs(r[k] - before[i]![k])).toBeLessThanOrEqual(1)
  }
})
