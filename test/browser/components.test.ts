import { expect, test } from 'vitest'

import '../../src/v1.ts'

const copy = {
  bn: { heading: 'অর্ডার', card: 'ক্ষুদ্র ব্যবসায়ীদের স্বয়ংক্রিয় কুরিয়ার বুকিং', button: 'অর্ডার যোগ করুন' },
  en: { heading: 'Orders', card: 'Automatic courier booking for small businesses', button: 'Add order' },
}

async function render(html: string): Promise<void> {
  document.body.innerHTML = html
  for (const el of document.querySelectorAll('eb-page, eb-card, eb-button')) {
    await (el as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete
  }
  await document.fonts.ready
}

for (const lang of ['bn', 'en'] as const) {
  test(`a page with a card and a button fits 360 px in ${lang}, with a 44 px button`, async () => {
    document.documentElement.lang = lang
    const t = copy[lang]
    await render(`<eb-page heading="${t.heading}">
      <eb-card heading="${t.heading}"><p>${t.card}</p><eb-button variant="primary">${t.button}</eb-button></eb-card>
    </eb-page>`)
    expect(window.innerWidth).toBe(360)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
    const button = document.querySelector('eb-button')!.getBoundingClientRect()
    expect(button.height).toBeGreaterThanOrEqual(44)
    expect(button.width).toBeGreaterThanOrEqual(44)
  })
}

test('the button label is never clipped, conjuncts and vowel signs included', async () => {
  document.documentElement.lang = 'bn'
  await render('<eb-button>ঊর্ধ্বমুখী কৃষ্ণচূড়া</eb-button>')
  const el = document.querySelector('eb-button')!
  const box = el.shadowRoot!.querySelector('button')!.getBoundingClientRect()
  const range = document.createRange()
  range.selectNodeContents(el)
  const text = range.getBoundingClientRect()
  expect(text.top).toBeGreaterThanOrEqual(box.top)
  expect(text.bottom).toBeLessThanOrEqual(box.bottom)
})

test('a label that wraps to two lines grows the button instead of being cut', async () => {
  document.documentElement.lang = 'bn'
  await render('<div style="width: 160px"><eb-button>ঊর্ধ্বমুখী কৃষ্ণচূড়া শ্রীমঙ্গলের চা</eb-button></div>')
  const el = document.querySelector('eb-button')!
  const box = el.shadowRoot!.querySelector('button')!.getBoundingClientRect()
  const range = document.createRange()
  range.selectNodeContents(el)
  const lines = range.getClientRects()
  expect(new Set([...lines].map((line) => line.top)).size).toBeGreaterThan(1)
  const text = range.getBoundingClientRect()
  expect(text.top).toBeGreaterThanOrEqual(box.top)
  expect(text.bottom).toBeLessThanOrEqual(box.bottom)
})

test('the page ground fills the screen under short content', async () => {
  await render('<eb-page><eb-card>One order</eb-card></eb-page>')
  expect(document.querySelector('eb-page')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(window.innerHeight)
})

test('a long label wraps inside a 360 px page instead of overflowing it', async () => {
  await render(`<eb-page><eb-button>${'অর্ডার যোগ করুন '.repeat(8)}</eb-button></eb-page>`)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
})

test('a card has a 12 px radius, 16 px padding, the surface colour, a divider ring and shadow level 1', async () => {
  await render('<eb-card>Body</eb-card>')
  const card = getComputedStyle(document.querySelector('eb-card')!)
  expect(card.borderRadius).toBe('12px')
  expect(card.padding).toBe('16px')
  expect(card.backgroundColor).toBe('oklch(1 0 0)')
  expect(card.boxShadow).toBe('oklch(0.925 0.004 85) 0px 0px 0px 1px inset, oklch(0.2 0.01 85 / 0.06) 0px 1px 2px 0px')
})

test('in dark, the page and the card turn dark with the text', async () => {
  try {
    document.documentElement.dataset.theme = 'dark'
    await render('<eb-page heading="Orders"><eb-card heading="Customer">Body</eb-card></eb-page>')
    const page = getComputedStyle(document.querySelector('eb-page')!)
    const card = getComputedStyle(document.querySelector('eb-card')!)
    expect(page.backgroundColor).toBe('oklch(0.16 0.004 85)')
    expect(page.color).toBe('oklch(0.955 0.003 85)')
    expect(card.backgroundColor).toBe('oklch(0.215 0.004 85)')
    expect(card.color).toBe('oklch(0.955 0.003 85)')
    // A card lifts off the page by its lightness and a faint top highlight, since a shadow barely
    // shows on near-black.
    const lightness = (colour: string) => Number.parseFloat(colour.slice('oklch('.length))
    expect(lightness(card.backgroundColor) - lightness(page.backgroundColor)).toBeGreaterThanOrEqual(0.05)
    expect(card.boxShadow).toBe(
      'oklch(0.285 0.005 85) 0px 0px 0px 1px inset, oklch(1 0 0 / 0.04) 0px 1px 0px 0px inset, oklch(0 0 0 / 0.5) 0px 1px 2px 0px',
    )
  } finally {
    delete document.documentElement.dataset.theme
  }
})

test('a card heading is 17/24 at weight 600', async () => {
  await render('<eb-card heading="Customer">Body</eb-card>')
  const style = getComputedStyle(document.querySelector('eb-card')!.shadowRoot!.querySelector('h2')!)
  expect(style.fontSize).toBe('17px')
  expect(style.lineHeight).toBe('24px')
  expect(style.fontWeight).toBe('600')
})

test('the page draws on the Ink ground with the page title at 22/32, weight 650', async () => {
  await render('<eb-page heading="Orders">Body</eb-page>')
  const page = document.querySelector('eb-page')!
  expect(getComputedStyle(page).backgroundColor).toBe('oklch(0.985 0.002 85)')
  const heading = page.shadowRoot!.querySelector('h1')!
  expect(heading.textContent).toBe('Orders')
  expect(getComputedStyle(heading).fontSize).toBe('22px')
  expect(getComputedStyle(heading).lineHeight).toBe('32px')
  expect(getComputedStyle(heading).fontWeight).toBe('650')
})

test("an app's own button rule leaves eb-button in its own colours", async () => {
  const style = document.createElement('style')
  style.textContent = 'button { background: red !important; color: black !important }'
  document.head.append(style)
  await render('<eb-button variant="primary">Add order</eb-button>')
  const inner = getComputedStyle(document.querySelector('eb-button')!.shadowRoot!.querySelector('button')!)
  expect(inner.backgroundColor).toBe('oklch(0.21 0.006 85)')
  style.remove()
})

test('a dark region inside a light page turns its text, links, field edges and error tokens dark', async () => {
  await render(`<div data-theme="dark"><eb-heading>Orders</eb-heading><eb-text>One</eb-text>
    <eb-link href="#">Track</eb-link><eb-text-field label="Name"></eb-text-field></div>`)
  const region = document.querySelector('[data-theme]')!
  const shadow = (tag: string) => document.querySelector(tag)!.shadowRoot!
  expect(getComputedStyle(shadow('eb-heading').querySelector('h2')!).color).toBe('oklch(0.955 0.003 85)')
  expect(getComputedStyle(document.querySelector('eb-text')!).color).toBe('oklch(0.955 0.003 85)')
  expect(getComputedStyle(shadow('eb-link').querySelector('a')!).color).toBe('oklch(0.955 0.003 85)')
  expect(getComputedStyle(shadow('eb-text-field').querySelector('input')!).boxShadow).toBe(
    'oklch(0.52 0.006 85) 0px 0px 0px 1px inset',
  )
  expect(getComputedStyle(region).getPropertyValue('--eb-color-critical-surface').trim()).toBe('oklch(0.29 0.07 25)')
  expect(getComputedStyle(region).colorScheme).toBe('dark')
})
