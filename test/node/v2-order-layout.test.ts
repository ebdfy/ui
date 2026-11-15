// The sample app's v2 order page: items and payment in the order's column, the customer, delivery,
// risk and tags in a side column that stacks under it on a phone, each card's actions in its header.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function order(width: number, lang: 'en' | 'bn' = 'en') {
  const { page, errors } = await pages.open('', width)
  await page.goto(`${pages.sampleApp}/orders/1042?lang=${lang}`)
  await page.locator('#tags-card > h2').waitFor()
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

const boxes = (page: Page) =>
  page.evaluate(() => {
    const out: Record<string, { left: number; right: number; top: number; bottom: number; width: number }> = {}
    for (const card of document.querySelectorAll('e-card')) {
      const r = card.getBoundingClientRect()
      out[card.id] = { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }
    }
    return out
  })

const headings = (page: Page) => page.locator('e-card > h2').allTextContents()

test('at 1440 px the items, payment and timeline sit left, and the customer, delivery, risk and tags in a 320 px column', async () => {
  const { page, errors } = await order(1440)
  expect(await headings(page)).toEqual(['Items', 'Payment', 'Timeline', 'Customer', 'Delivery', 'Risk', 'Tags'])
  const at = await boxes(page)
  expect(at['customer-card']!.left - at['items-card']!.right).toBe(20)
  expect(at['customer-card']!.width).toBe(320)
  // The side column starts level with the order's column.
  const main = await page.locator('e-page > e-stack:not([slot])').boundingBox()
  expect(at['customer-card']!.top).toBe(main!.y)
  expect(at['items-card']!.top).toBe(main!.y)
  expect(at['payment-card']!.top).toBeGreaterThan(at['items-card']!.bottom)
  expect(at['payment-card']!.left).toBe(at['items-card']!.left)
  expect(at['timeline-card']!.top - at['payment-card']!.bottom).toBe(16)
  for (const [above, below] of [
    ['customer-card', 'delivery-card'],
    ['delivery-card', 'risk-card'],
    ['risk-card', 'tags-card'],
  ] as const) {
    expect(at[below]!.top - at[above]!.bottom).toBe(16)
    expect(at[below]!.left).toBe(at['customer-card']!.left)
  }
  expect(errors).toEqual([])
})

test("at 1440 px the Items card's Edit sits on its heading's line, at its right end", async () => {
  const { page } = await order(1440)
  const card = page.locator('#items-card')
  const [heading, edit, box] = await Promise.all([
    card.locator('> h2').boundingBox(),
    card.getByRole('button', { name: 'Edit' }).boundingBox(),
    card.boundingBox(),
  ])
  expect(Math.abs(edit!.y + edit!.height / 2 - (heading!.y + heading!.height / 2))).toBeLessThanOrEqual(1)
  // At the card's right padding edge: 20 px of padding inside a 1 px border.
  expect(Math.abs(box!.x + box!.width - (edit!.x + edit!.width) - 21)).toBeLessThanOrEqual(1)
})

test('at 360 px the customer comes first, the rest of the side column under the payment, and the delivery card folds its third action into More', async () => {
  const { page, errors } = await order(360)
  const at = await boxes(page)
  expect(at['items-card']!.top - at['customer-card']!.bottom).toBe(16)
  expect(at['delivery-card']!.top - at['payment-card']!.bottom).toBe(16)
  expect(at['customer-card']!.left).toBe(at['items-card']!.left)
  const delivery = page.locator('#delivery-card')
  const shown = await delivery
    .getByRole('button')
    .evaluateAll((buttons) => buttons.filter((b) => b.checkVisibility()).map((b) => b.textContent))
  expect(shown).toEqual(['Book', 'Print', 'More'])
  // Track, folded into More, is still the page's own button: its click reaches the page's listener.
  await page.evaluate(() => {
    const track = document.querySelectorAll('#delivery-card > e-button[slot="actions"]')[2]!
    track.addEventListener('click', () => document.body.setAttribute('data-tracked', ''))
  })
  await delivery.getByRole('button', { name: 'More' }).click()
  await delivery.getByRole('menuitem', { name: 'Track' }).click()
  expect(await page.evaluate(() => document.body.hasAttribute('data-tracked'))).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  expect(errors).toEqual([])
})

test('in Bangla every card reads Bangla, the folded action too', async () => {
  const { page, errors } = await order(360, 'bn')
  expect(await headings(page)).toEqual(['পণ্য', 'পেমেন্ট', 'টাইমলাইন', 'গ্রাহক', 'ডেলিভারি', 'ঝুঁকি', 'ট্যাগ'])
  const delivery = page.locator('#delivery-card')
  await delivery.getByRole('button', { name: 'আরও' }).click()
  expect(await delivery.getByRole('menuitem').allTextContents()).toEqual(['ট্র্যাক'])
  expect(errors).toEqual([])
})

// Each card's heading stays one line beside its actions, whole words only, in the side column too.
test.for([
  [1440, 'en'],
  [1440, 'bn'],
  [360, 'en'],
  [360, 'bn'],
] as const)('at %i px in %s every card heading is one line beside its actions', async ([width, lang]) => {
  const { page } = await order(width, lang)
  const squeezed = await page.evaluate(() =>
    [...document.querySelectorAll('e-card > h2')]
      .filter((h2) => {
        const range = document.createRange()
        range.selectNodeContents(h2)
        return range.getClientRects().length > 1 || h2.getBoundingClientRect().height > 28
      })
      .map((h2) => h2.textContent),
  )
  expect(squeezed).toEqual([])
  const wider = await page.evaluate(() =>
    [...document.querySelectorAll('e-card')]
      .filter((card) => card.scrollWidth > card.clientWidth)
      .map((card) => card.id),
  )
  expect(wider).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
})

test('at 360 px the arrow back to all orders is a 44 px target', async () => {
  const { page } = await order(360)
  const back = await page.getByRole('link', { name: 'All orders' }).boundingBox()
  expect(back!.height).toBeGreaterThanOrEqual(44)
})
