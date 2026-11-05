// e-icon reserves its box in CSS, and the script fills it from one sprite fetched once. The tests run
// in order on one module, as a page does: the first to define e-icon fetches the sprite.
import { afterEach, expect, test, vi } from 'vitest'

import '../../src/v2.css'
import { defineIcon } from '../../src/v2/icon.ts'

const box = (el: Element) => {
  const { width, height } = el.getBoundingClientRect()
  return [width, height]
}

afterEach(() => {
  vi.restoreAllMocks()
})

test('before the script, e-icon reserves 16 x 16 px, or 20 x 20 px with size 20', () => {
  document.body.innerHTML =
    '<p>Ship <e-icon name="truck"></e-icon> now <e-icon name="truck" size="20"></e-icon> later</p>'
  const [small, large] = document.querySelectorAll('e-icon')
  expect(box(small!)).toEqual([16, 16])
  expect(box(large!)).toEqual([20, 20])
  expect(getComputedStyle(small!).display).not.toBe('inline')
})

test('ten icons, icons added later and three defines fetch icons.svg once', async () => {
  document.body.innerHTML = '<e-icon name="truck"></e-icon>'.repeat(10)
  const fetched = vi.spyOn(globalThis, 'fetch')
  defineIcon()
  defineIcon()
  await expect.poll(() => document.querySelectorAll('e-icon svg').length).toBe(10)
  document.body.insertAdjacentHTML('beforeend', '<e-icon name="search"></e-icon>')
  defineIcon()
  await expect.poll(() => document.querySelectorAll('e-icon svg').length).toBe(11)
  const sprites = fetched.mock.calls.filter(([url]) => String(url).includes('icons.svg'))
  expect(sprites).toHaveLength(1)
})

test('the truck draws as an svg using #e-icon-truck inside the same box, after the body was replaced', async () => {
  // Replacing the body took the sprite's symbols with it; drawing puts them back.
  document.body.innerHTML = '<p>Ship <e-icon name="truck"></e-icon> now</p>'
  const icon = document.querySelector('e-icon')!
  const before = box(icon)
  await expect.poll(() => icon.querySelectorAll('svg').length).toBe(1)
  const svg = icon.querySelector('svg')!
  expect(svg.getAttribute('aria-hidden')).toBe('true')
  expect(svg.querySelector('use')!.getAttribute('href')).toBe('#e-icon-truck')
  expect(document.querySelector('symbol#e-icon-truck')).not.toBeNull()
  const drawn = svg.querySelector('use')!.getBoundingClientRect()
  expect(drawn.width).toBeGreaterThan(8)
  expect(drawn.height).toBeGreaterThan(8)
  const after = box(icon)
  expect(Math.abs(after[0]! - before[0]!)).toBeLessThanOrEqual(1)
  expect(Math.abs(after[1]! - before[1]!)).toBeLessThanOrEqual(1)
})

test('an unknown name draws nothing, throws nothing and keeps the box', async () => {
  document.body.innerHTML = '<e-icon name="truck"></e-icon><e-icon name="no-such-icon" size="20"></e-icon>'
  const [known, unknown] = document.querySelectorAll('e-icon')
  await expect.poll(() => known!.querySelectorAll('svg').length).toBe(1)
  expect(unknown!.querySelectorAll('svg')).toHaveLength(0)
  expect(box(unknown!)).toEqual([20, 20])
})
