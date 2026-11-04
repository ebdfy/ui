import { expect, test } from 'vitest'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

const text = 'oklch(0.21 0.006 85)'
const none = 'rgba(0, 0, 0, 0)'

async function badge(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-badge')!
  await el.updateComplete
  return el
}

function dot(el: HTMLElement): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>('.dot')!
}

// A status is a dot and a word: the word in the text colour, the dot in the status colour.
const dots = {
  info: 'oklch(0.47 0.008 85)',
  success: 'oklch(0.58 0.14 150)',
  shipped: 'oklch(0.58 0.1 200)',
}

for (const [tone, colour] of Object.entries(dots)) {
  test(`a ${tone} badge is an 8 px dot in its colour beside words in the text colour`, async () => {
    const el = await badge(`<eb-badge tone="${tone}">Confirmed</eb-badge>`)
    const style = getComputedStyle(el)
    expect(style.backgroundColor).toBe(none)
    expect(style.color).toBe(text)
    expect(style.fontWeight).toBe('500')
    const box = dot(el).getBoundingClientRect()
    expect([box.width, box.height]).toEqual([8, 8])
    expect(getComputedStyle(dot(el)).borderRadius).toBe('50%')
    expect(getComputedStyle(dot(el)).backgroundColor).toBe(colour)
    expect(dot(el).getAttribute('aria-hidden')).toBe('true')
    expect(el.innerText).toBe('Confirmed')
  })
}

test('a badge with no tone is the neutral dot of Confirmed', async () => {
  const el = await badge('<eb-badge>Confirmed</eb-badge>')
  expect(getComputedStyle(dot(el)).backgroundColor).toBe(dots.info)
})

test('an attention badge, New, is a soft amber pill with an amber dot', async () => {
  const el = await badge('<eb-badge tone="attention">New</eb-badge>')
  const style = getComputedStyle(el)
  expect(style.backgroundColor).toBe('oklch(0.955 0.04 72)')
  expect(style.color).toBe('oklch(0.46 0.13 50)')
  expect(style.borderRadius).toBe('999px')
  expect(style.padding).toBe('2px 8px')
  expect(style.fontWeight).toBe('600')
  expect(getComputedStyle(dot(el)).backgroundColor).toBe('oklch(0.66 0.16 58)')
})

test('a critical badge, Returned, is a filled red pill of white words with no dot', async () => {
  const el = await badge('<eb-badge tone="critical">Returned</eb-badge>')
  const style = getComputedStyle(el)
  expect(style.backgroundColor).toBe('oklch(0.55 0.2 27)')
  expect(style.color).toBe('oklch(1 0 0)')
  expect(style.borderRadius).toBe('999px')
  expect(style.fontWeight).toBe('600')
  expect(dot(el).getBoundingClientRect().width).toBe(0)
})

test('in dark, the New pill and the words turn to the dark tokens', async () => {
  try {
    document.documentElement.dataset.theme = 'dark'
    const pill = await badge('<eb-badge tone="attention">New</eb-badge>')
    expect(getComputedStyle(pill).backgroundColor).toBe('oklch(0.31 0.06 60)')
    expect(getComputedStyle(pill).color).toBe('oklch(0.88 0.09 72)')
    const confirmed = await badge('<eb-badge tone="info">Confirmed</eb-badge>')
    expect(getComputedStyle(confirmed).color).toBe('oklch(0.955 0.003 85)')
  } finally {
    delete document.documentElement.dataset.theme
  }
})

test('a badge is 13/20 text on one line where its words fit', async () => {
  const el = await badge('<div style="width: 300px"><eb-badge tone="shipped">ডেলিভারির পথে</eb-badge></div>')
  const style = getComputedStyle(el)
  expect(style.fontSize).toBe('13px')
  expect(style.lineHeight).toBe('20px')
  expect(el.getBoundingClientRect().height).toBe(20)
})

// A status is one line however narrow its place: a table keeps it inside its column by letting
// low-priority columns step aside, never by breaking the words.
for (const [tone, words] of [
  ['shipped', 'With courier'],
  ['critical', 'ফেরত এসেছে'],
  ['attention', 'With courier'],
] as const) {
  test(`a ${tone} badge in a column too narrow for "${words}" keeps its words on one line`, async () => {
    const el = await badge(`<div style="width: 64px"><eb-badge tone="${tone}">${words}</eb-badge></div>`)
    const range = document.createRange()
    range.selectNodeContents(el)
    expect(new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size).toBe(1)
    expect(el.getBoundingClientRect().height).toBeLessThanOrEqual(24)
  })
}

// The status words have to read on their own: a busy seller scans the word, not the colour.
async function paint(lang: string, html: string) {
  const el = await badge(`<div lang="${lang}">${html}</div>`)
  const { backgroundColor, color } = getComputedStyle(el)
  return { backgroundColor, color, dot: getComputedStyle(dot(el)).backgroundColor, text: el.innerText }
}

for (const theme of ['light', 'dark'] as const) {
  for (const [lang, words] of [
    ['en', { new: 'New', returned: 'Returned', confirmed: 'Confirmed' }],
    ['bn', { new: 'নতুন', returned: 'ফেরত এসেছে', confirmed: 'কনফার্মড' }],
  ] as const) {
    test(`in ${theme}, in ${lang}, New reads 4.5:1 on its pill, Returned white at 5.38:1 and Confirmed a text-2 dot`, async () => {
      const run = async () => ({
        page: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-bg').trim(),
        textTwo: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-text-2').trim(),
        new: await paint(lang, `<eb-badge tone="attention">${words.new}</eb-badge>`),
        returned: await paint(lang, `<eb-badge tone="critical">${words.returned}</eb-badge>`),
        confirmed: await paint(lang, `<eb-badge tone="info">${words.confirmed}</eb-badge>`),
      })
      const found = theme === 'dark' ? await inDark(run) : await run()
      expect(contrast(found.new.color, found.new.backgroundColor)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(found.returned.color, found.returned.backgroundColor)).toBeCloseTo(5.38, 1)
      expect(found.confirmed.backgroundColor).toBe(none)
      expect(found.confirmed.dot).toBe(found.textTwo)
      expect(contrast(found.confirmed.color, found.page)).toBeGreaterThanOrEqual(4.5)
      expect([found.new.text, found.returned.text, found.confirmed.text]).toEqual([
        words.new,
        words.returned,
        words.confirmed,
      ])
    })
  }
}

// One tone list for every component, and an order's status by name; the 1.0.0 tone names above
// stay as aliases until 2.0, so each new name draws exactly what its old name draws.
function look(el: HTMLElement) {
  const { backgroundColor, color, borderRadius, padding, fontWeight } = getComputedStyle(el)
  const dotBox = dot(el).getBoundingClientRect()
  return {
    backgroundColor,
    color,
    borderRadius,
    padding,
    fontWeight,
    dot: getComputedStyle(dot(el)).backgroundColor,
    dotWidth: dotBox.width,
  }
}

const sameAs = [
  ['tone="neutral"', 'tone="info"'],
  ['tone="warning"', 'tone="attention"'],
  ['tone="danger"', 'tone="critical"'],
  ['status="new"', 'tone="attention"'],
  ['status="confirmed"', 'tone="info"'],
  ['status="shipped"', 'tone="shipped"'],
  ['status="paid"', 'tone="success"'],
  ['status="returned"', 'tone="critical"'],
] as const

for (const theme of ['light', 'dark'] as const) {
  test.for(sameAs)(`in ${theme}, a badge with %s draws as one with %s`, async ([name, old]) => {
    const run = async () => ({
      now: look(await badge(`<eb-badge ${name}>Word</eb-badge>`)),
      before: look(await badge(`<eb-badge ${old}>Word</eb-badge>`)),
    })
    const { now, before } = theme === 'dark' ? await inDark(run) : await run()
    expect(now).toEqual(before)
  })
}

test('a badge with no tone keeps the 1.0.0 default, info', async () => {
  const el = await badge('<eb-badge>Confirmed</eb-badge>')
  expect(el.getAttribute('tone')).toBe('info')
})

test('a status decides the look over a tone set beside it', async () => {
  const paid = look(await badge('<eb-badge status="paid">Paid</eb-badge>'))
  expect(look(await badge('<eb-badge tone="danger" status="paid">Paid</eb-badge>'))).toEqual(paid)
})
