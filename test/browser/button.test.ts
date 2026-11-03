import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

async function button(html: string): Promise<HTMLButtonElement> {
  document.body.innerHTML = html
  const el = document.querySelector('eb-button')!
  await el.updateComplete
  return el.shadowRoot!.querySelector('button')!
}

// A snapshot of the colours, since a computed style is live and the theme changes back.
function paint(el: Element) {
  const { backgroundColor, color, boxShadow } = getComputedStyle(el)
  return { backgroundColor, color, boxShadow }
}

test('a primary button is near-black ink with light text, and near-white with dark text in dark', async () => {
  const inner = paint(await button('<eb-button variant="primary">Add order</eb-button>'))
  expect(inner.backgroundColor).toBe('oklch(0.21 0.006 85)')
  expect(inner.color).toBe('oklch(0.99 0 0)')
  const dark = await inDark(async () => paint(await button('<eb-button variant="primary">Add order</eb-button>')))
  expect(dark.backgroundColor).toBe('oklch(0.955 0.003 85)')
  expect(dark.color).toBe('oklch(0.17 0.004 85)')
})

test('a secondary button sits on the surface with an edge ring, and is the default', async () => {
  const inner = getComputedStyle(await button('<eb-button>Cancel</eb-button>'))
  expect(inner.backgroundColor).toBe('oklch(1 0 0)')
  expect(inner.color).toBe('oklch(0.21 0.006 85)')
  expect(inner.boxShadow).toContain('oklch(0.87 0.005 85) 0px 0px 0px 1px inset')
  const dark = await inDark(async () => paint(await button('<eb-button>Cancel</eb-button>')))
  expect(dark.backgroundColor).toBe('oklch(0.2 0.004 85)')
  expect(dark.color).toBe('oklch(0.955 0.003 85)')
})

test('a ghost button has no fill and quieter text', async () => {
  const inner = getComputedStyle(await button('<eb-button variant="ghost">More</eb-button>'))
  expect(inner.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(inner.color).toBe('oklch(0.47 0.008 85)')
  expect(inner.boxShadow).toBe('none')
})

test('a danger button is the danger fill with white text at 5.38:1, in both themes', async () => {
  for (const read of [
    async () => paint(await button('<eb-button variant="danger">Delete</eb-button>')),
    () => inDark(async () => paint(await button('<eb-button variant="danger">Delete</eb-button>'))),
  ]) {
    const inner = await read()
    expect(inner.backgroundColor).toBe('oklch(0.55 0.2 27)')
    expect(inner.color).toBe('oklch(1 0 0)')
    expect(contrast(inner.backgroundColor, inner.color)).toBeCloseTo(5.38, 1)
  }
})

test('on a desktop the sizes are 28, 36 and 44 px tall, 36 by default', async () => {
  try {
    await page.viewport(1280, 800)
    for (const [size, height] of [
      ['sm', 28],
      ['md', 36],
      ['lg', 44],
      ['', 36],
    ] as const) {
      const inner = await button(`<eb-button ${size ? `size="${size}"` : ''}>Save</eb-button>`)
      expect(inner.getBoundingClientRect().height, size).toBe(height)
    }
  } finally {
    await page.viewport(360, 800)
  }
})

test('on a phone every size is at least a 44 px tap target', async () => {
  for (const size of ['sm', 'md', 'lg']) {
    const inner = await button(`<eb-button size="${size}">Save</eb-button>`)
    expect(inner.getBoundingClientRect().height, size).toBeGreaterThanOrEqual(44)
  }
})

test('a button label is weight 500, on the type scale', async () => {
  const inner = getComputedStyle(await button('<eb-button>Save</eb-button>'))
  expect(inner.fontWeight).toBe('500')
  expect(inner.fontSize).toBe('15px')
  expect(inner.lineHeight).toBe('24px')
})

test('a full-width button fills the width its host is given, as in a row of equal actions', async () => {
  const inner = await button(`<div style="display: flex; width: 320px; gap: 12px">
    <eb-button full-width style="flex: 1">Ask for advance</eb-button><eb-button full-width style="flex: 1" variant="primary">Confirm order</eb-button>
  </div>`)
  const hosts = [...document.querySelectorAll('eb-button')].map((el) => el.getBoundingClientRect().width)
  expect(hosts).toEqual([154, 154])
  expect(inner.getBoundingClientRect().width).toBe(154)
})

test('a button without full-width stays as wide as its label, even in a stretched column', async () => {
  const inner = await button(
    '<div style="display: flex; flex-direction: column; width: 400px"><eb-button>Save</eb-button></div>',
  )
  expect(document.querySelector('eb-button')!.getBoundingClientRect().width).toBe(400)
  expect(inner.getBoundingClientRect().width).toBeLessThan(100)
})

test('a toggle button says whether it is pressed, and a plain one says nothing', async () => {
  const on = await button('<eb-button pressed="true">All 6</eb-button>')
  expect(on.getAttribute('aria-pressed')).toBe('true')
  const host = document.querySelector('eb-button')!
  host.setAttribute('pressed', 'false')
  await host.updateComplete
  expect(on.getAttribute('aria-pressed')).toBe('false')
  const plain = await button('<eb-button>Print</eb-button>')
  expect(plain.hasAttribute('aria-pressed')).toBe(false)
})
