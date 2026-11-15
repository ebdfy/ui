// e-todo: a row of counts that are links, drawn by v2.css alone. One row of equal tiles from 600 px,
// two columns on a phone, each tile a 44 px tap target.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const todo = `<div style="max-width: 1000px"><e-todo label="To do">
  <a href="/orders"><strong>12</strong> To confirm</a>
  <a href="/orders"><strong>18</strong> To ship</a>
  <a href="/orders"><strong>54</strong> With courier</a>
  <a href="/orders"><strong>6</strong> Returns</a>
  <a href="/orders"><strong>3</strong> Drafts</a>
</e-todo></div>`

const tiles = () => [...document.querySelectorAll('e-todo > a')].map((tile) => tile.getBoundingClientRect())

test('at 1280 px five tiles share one row with equal widths', async () => {
  await page.viewport(1280, 800)
  document.body.innerHTML = todo
  const boxes = tiles()
  expect(boxes.length).toBe(5)
  expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1)
  for (const box of boxes) expect(Math.abs(box.width - boxes[0]!.width)).toBeLessThanOrEqual(1)
  expect(Math.round(boxes[0]!.width)).toBeGreaterThan(150)
})

test('each tile is a link whose count is 26 px at 650 weight, above its words in the quiet colour', () => {
  document.body.innerHTML = todo
  const tile = document.querySelector('e-todo > a')!
  const count = tile.querySelector('strong')!
  const style = getComputedStyle(count)
  expect(style.fontSize).toBe('26px')
  expect(style.fontWeight).toBe('650')
  expect(style.fontVariantNumeric).toBe('tabular-nums')
  expect(style.display).toBe('block')
  expect(getComputedStyle(tile).fontSize).toBe('13px')
  expect(getComputedStyle(tile).color).not.toBe(style.color)
})

test('at 360 px the tiles wrap two by two, are 44 px tall and nothing scrolls sideways', () => {
  document.body.innerHTML = todo
  const boxes = tiles()
  expect(Math.round(boxes[0]!.top)).toBe(Math.round(boxes[1]!.top))
  expect(boxes[2]!.top).toBeGreaterThan(boxes[0]!.bottom - 1)
  for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('a tile tints on hover and shows the focus ring from the keyboard', async () => {
  document.body.innerHTML = todo
  const tile = document.querySelector<HTMLElement>('e-todo > a')!
  const rest = getComputedStyle(tile).backgroundColor
  await page.elementLocator(tile).hover()
  expect(getComputedStyle(tile).backgroundColor).not.toBe(rest)
  await userEvent.tab()
  expect(document.activeElement).toBe(tile)
  expect(getComputedStyle(tile).outlineStyle).toBe('solid')
})
