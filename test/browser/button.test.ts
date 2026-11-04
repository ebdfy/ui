import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

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
  expect(dark.backgroundColor).toBe('oklch(0.215 0.004 85)')
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

test('a disabled button is text-3 on surface-2, ignores clicks and is skipped by Tab, in every variant', async () => {
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    document.body.innerHTML = `<button id="before">Before</button><eb-button variant="${variant}" disabled>Save</eb-button><button id="after">After</button>`
    const host = document.querySelector('eb-button')!
    await host.updateComplete
    const inner = host.shadowRoot!.querySelector('button')!
    const { backgroundColor, color } = getComputedStyle(inner)
    expect(backgroundColor, variant).toBe('oklch(0.972 0.003 85)')
    expect(color, variant).toBe('oklch(0.54 0.008 85)')
    let clicks = 0
    host.addEventListener('click', () => clicks++)
    await userEvent.click(host, { force: true })
    host.click()
    expect(clicks, variant).toBe(0)
    document.querySelector<HTMLButtonElement>('#before')!.focus()
    await userEvent.tab()
    expect(document.activeElement?.id, variant).toBe('after')
  }
})

test('a loading button shows a 16 px spinner at its own width, says it is busy and ignores clicks', async () => {
  document.body.innerHTML = '<eb-button variant="primary">Save order</eb-button>'
  const host = document.querySelector('eb-button')!
  await host.updateComplete
  const before = host.getBoundingClientRect().width
  host.loading = true
  await host.updateComplete
  const inner = host.shadowRoot!.querySelector('button')!
  expect(Math.abs(host.getBoundingClientRect().width - before)).toBeLessThanOrEqual(1)
  expect(inner.getAttribute('aria-busy')).toBe('true')
  const spinner = host.shadowRoot!.querySelector('[part="spinner"]')!
  const box = spinner.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([16, 16])
  let clicks = 0
  host.addEventListener('click', () => clicks++)
  await userEvent.click(host)
  host.click()
  expect(clicks).toBe(0)
  host.loading = false
  await host.updateComplete
  expect(inner.hasAttribute('aria-busy')).toBe(false)
  expect(host.shadowRoot!.querySelector('[part="spinner"]')).toBeNull()
  await userEvent.click(host)
  expect(clicks).toBe(1)
})

test('a slotted icon sits 6 px before the label', async () => {
  document.body.innerHTML = '<eb-button><eb-icon slot="icon" name="plus"></eb-icon>Add order</eb-button>'
  const host = document.querySelector('eb-button')!
  await host.updateComplete
  const icon = host.querySelector('eb-icon')!.getBoundingClientRect()
  const label = host.shadowRoot!.querySelector('.label')!.getBoundingClientRect()
  expect([icon.width, icon.height]).toEqual([16, 16])
  expect(label.left - icon.right).toBe(6)
})

test('an icon-only button is a square of the control height, named by its label', async () => {
  try {
    await page.viewport(1280, 800)
    for (const [size, px] of [
      ['sm', 28],
      ['md', 36],
      ['lg', 44],
    ] as const) {
      document.body.innerHTML = `<eb-button icon-only size="${size}" label="More actions"><eb-icon slot="icon" name="more-horizontal"></eb-icon></eb-button>`
      const host = document.querySelector('eb-button')!
      await host.updateComplete
      const inner = host.shadowRoot!.querySelector('button')!
      const box = inner.getBoundingClientRect()
      expect([box.width, box.height], size).toEqual([px, px])
      const icon = host.querySelector('eb-icon')!.getBoundingClientRect()
      expect(icon.left - box.left, size).toBe((px - 16) / 2)
      expect(inner.getAttribute('aria-label')).toBe('More actions')
    }
  } finally {
    await page.viewport(360, 800)
  }
  await page.viewport(360, 800)
  const inner = await button(
    '<eb-button icon-only label="More"><eb-icon slot="icon" name="more-horizontal"></eb-icon></eb-button>',
  )
  const box = inner.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([44, 44])
  await expect.element(page.getByRole('button', { name: 'More' })).toBeInTheDocument()
})

// The lightness of an oklch() colour.
const lightness = (colour: string) => Number(colour.match(/oklch\(([\d.]+)/)![1])

// A variant's fill at rest and pressed.
const fills = async (variant: string) => ({
  rest: paint(await button(`<eb-button variant="${variant}">All</eb-button>`)).backgroundColor,
  on: paint(await button(`<eb-button variant="${variant}" pressed="true">All</eb-button>`)).backgroundColor,
})

test('pressed, every variant fills a step deeper than at rest, darker in light', async () => {
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    const light = await fills(variant)
    const dark = await inDark(() => fills(variant))
    expect(light.on, `${variant} in light`).not.toBe(light.rest)
    expect(dark.on, `${variant} in dark`).not.toBe(dark.rest)
  }
  for (const variant of ['primary', 'secondary', 'danger']) {
    const { rest, on } = await fills(variant)
    expect(lightness(on), variant).toBeLessThan(lightness(rest))
  }
})

test('a danger button has a hover fill at least 0.03 lightness off its rest, in both themes', async () => {
  for (const theme of ['light', 'dark'] as const) {
    const read = async () => {
      const inner = await button('<eb-button variant="danger">Delete</eb-button>')
      const rest = getComputedStyle(inner).backgroundColor
      await userEvent.hover(inner)
      const hover = getComputedStyle(inner).backgroundColor
      await userEvent.unhover(inner)
      return { rest, hover, ratio: contrast(hover, getComputedStyle(inner).color) }
    }
    const { rest, hover, ratio } = theme === 'dark' ? await inDark(read) : await read()
    expect(Math.abs(lightness(rest) - lightness(hover)), theme).toBeGreaterThanOrEqual(0.03)
    expect(ratio, theme).toBeGreaterThanOrEqual(4.5)
  }
})

test('a label that wraps keeps at least 6 px inset above and below', async () => {
  document.body.innerHTML =
    '<div style="width: 160px"><eb-button>অর্ডারটি কুরিয়ারে বুক করুন এবং লেবেল প্রিন্ট করুন</eb-button></div>'
  const host = document.querySelector('eb-button')!
  await host.updateComplete
  await document.fonts.ready
  const inner = host.shadowRoot!.querySelector('button')!.getBoundingClientRect()
  const label = host.shadowRoot!.querySelector('.label')!.getBoundingClientRect()
  expect(label.height).toBeGreaterThan(24)
  expect(label.top - inner.top).toBeGreaterThanOrEqual(6)
  expect(inner.bottom - label.bottom).toBeGreaterThanOrEqual(6)
})

test('a loading button keeps its words as its name, so a focused one still says what it is', async () => {
  document.body.innerHTML = '<eb-button variant="primary" loading>Save order</eb-button>'
  await document.querySelector('eb-button')!.updateComplete
  await expect.element(page.getByRole('button', { name: 'Save order' })).toBeInTheDocument()
})

test('a disabled button swallows a click before a listener the app added on the host', async () => {
  document.body.innerHTML = '<eb-button disabled>Save</eb-button>'
  const host = document.querySelector('eb-button')!
  await host.updateComplete
  let clicks = 0
  host.addEventListener('click', () => clicks++, { capture: true })
  host.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  expect(clicks).toBe(0)
})
