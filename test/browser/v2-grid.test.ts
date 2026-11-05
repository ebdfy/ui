// e-divider, e-grid and e-bottom-bar: layout parts drawn by v2.css alone.
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'

const rect = (el: Element) => el.getBoundingClientRect()

test('e-divider is a 1 px line across its row', () => {
  document.body.innerHTML = '<div style="width: 300px"><e-divider></e-divider></div>'
  const line = document.querySelector('e-divider')!
  expect([rect(line).width, rect(line).height]).toEqual([300, 1])
  expect(getComputedStyle(line).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
})

test('e-grid lays its children in equal columns from 600 px, and in one column below', async () => {
  const grid =
    '<e-grid columns="3"><div>a</div><div>b</div><div>c</div></e-grid><e-grid><div>d</div><div>e</div></e-grid>'
  await page.viewport(1000, 800)
  try {
    document.body.innerHTML = grid
    const [a, b, c] = [...document.querySelectorAll('e-grid:first-child > div')].map(rect)
    expect(a!.top).toBe(c!.top)
    expect(a!.width).toBeCloseTo(b!.width, 1)
    expect(b!.left - a!.right).toBeCloseTo(16, 1)
    const [d, e] = [...document.querySelectorAll('e-grid:last-child > div')].map(rect)
    expect(d!.top).toBe(e!.top)
  } finally {
    await page.viewport(360, 800)
  }
  document.body.innerHTML = grid
  const [a, b] = [...document.querySelectorAll('e-grid:first-child > div')].map(rect)
  expect(b!.top - a!.bottom).toBe(16)
  expect(a!.width).toBe(rect(document.querySelector('e-grid')!).width)
})

test('e-bottom-bar sticks to the bottom of the frame, its buttons at the end, filling the row on a phone', async () => {
  document.body.innerHTML = `<div style="height: 2000px">Long page</div><e-bottom-bar><button>Cancel</button><button>Save</button></e-bottom-bar>`
  const bar = document.querySelector('e-bottom-bar')!
  expect(getComputedStyle(bar).position).toBe('sticky')
  expect(Math.round(rect(bar).bottom)).toBe(window.innerHeight)
  const [cancel, save] = [...bar.querySelectorAll('button')].map(rect)
  expect(cancel!.width).toBe(save!.width)
  expect(save!.right).toBeGreaterThan(rect(bar).right - 20)
  await page.viewport(1000, 800)
  try {
    const [, wideSave] = [...bar.querySelectorAll('button')].map(rect)
    expect(wideSave!.width).toBeLessThan(200)
    expect(wideSave!.right).toBeGreaterThan(rect(bar).right - 20)
  } finally {
    await page.viewport(360, 800)
  }
})
