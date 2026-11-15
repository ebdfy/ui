import { expect, test } from 'vitest'
// e-page as a record page: a set width, a header with a back link, status, facts and previous/next,
// a 320 px side column, and on a phone cards that move out of their column.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineCard } from '../../src/v2/card.ts'
import { defineIcon } from '../../src/v2/icon.ts'
import { definePage } from '../../src/v2/page.ts'

function render(html: string): void {
  document.body.innerHTML = html
}

const rect = (el: Element) => el.getBoundingClientRect()
const $ = (selector: string) => document.querySelector(selector)!
const card = (heading: string) =>
  [...document.querySelectorAll('e-card')].find((c) => c.getAttribute('heading') === heading)!
const middle = (el: Element) => rect(el).top + rect(el).height / 2

async function at<T>(width: number, run: () => T | Promise<T>): Promise<T> {
  await page.viewport(width, 900)
  try {
    expect(window.innerWidth).toBe(width)
    return await run()
  } finally {
    await page.viewport(360, 800)
  }
}

const header = (heading: string, lang = 'en') => {
  const [back, previous, next] =
    lang === 'bn' ? ['সব অর্ডার', 'আগের অর্ডার', 'পরের অর্ডার'] : ['All orders', 'Previous order', 'Next order']
  return `<a slot="back" href="/orders" aria-label="${back}"><e-icon name="arrow-left"></e-icon></a>
  <e-badge slot="status" tone="new">New</e-badge><e-badge slot="status" tone="warn">Unpaid</e-badge>
  <div slot="pagination"><a href="/orders/1041" aria-label="${previous}"><e-icon name="chevron-left"></e-icon></a><a href="/orders/1043" aria-label="${next}"><e-icon name="chevron-right"></e-icon></a></div>
  <e-button slot="actions">Confirm</e-button>
  <e-text slot="facts">11:24 AM · Facebook · 2 items</e-text>`
}

const record = (attrs = '', heading = 'Order #1042', lang = 'en') => `<e-page heading="${heading}" ${attrs}>
  ${header(heading, lang)}
  <e-stack gap="4">
    <e-card heading="Items"><p style="height: 240px; margin: 0">Two items</p></e-card>
    <e-card heading="Payment">Paid</e-card>
    <e-card heading="Timeline" phone-order="last">Placed</e-card>
  </e-stack>
  <e-stack gap="4" slot="aside">
    <e-card heading="Customer" phone-order="first">Rahima</e-card>
    <e-card heading="Delivery">Sylhet</e-card>
    <e-card heading="Risk">Low</e-card>
    <e-card heading="Tags">VIP</e-card>
  </e-stack>
</e-page>`

// Runs first, so no define function has run yet and the page shows what v2.css draws alone. Both
// widths are recorded before the scripts run, and again after.
test('the scripts move no box of the record page by more than 1 px, at 360 and 1440 px', async () => {
  expect(customElements.get('e-page')).toBeUndefined()
  render(record('width="details"'))
  const tags = [...document.querySelectorAll('e-page, e-page *')]
  const boxes = () => tags.map((el) => [rect(el).left, rect(el).top, rect(el).width, rect(el).height])
  // The webfont swapping in would move the text, so the boxes are read once it has loaded.
  boxes()
  await document.fonts.ready
  const before = boxes()
  const wide = await at(1440, async () => {
    const plain = boxes()
    definePage()
    defineIcon()
    defineCard()
    await expect.poll(() => document.querySelectorAll('e-icon > svg').length).toBe(3)
    expect($('e-page > h1').textContent).toBe('Order #1042')
    return [plain, boxes()]
  })
  const moved = (width: number, from: number[][], to: number[][]) =>
    tags.flatMap((el, i) =>
      to[i]!.some((n, j) => Math.abs(n - from[i]![j]!) > 1) ? [`${width} ${el.tagName} ${from[i]} -> ${to[i]}`] : [],
    )
  expect([...moved(360, before, boxes()), ...moved(1440, wide[0]!, wide[1]!)]).toEqual([])
})

test('width="details" is 1040 px and width="form" 960 px, centred, and either fills a phone', async () => {
  await at(1440, () => {
    for (const [width, px] of [
      ['details', 1040],
      ['form', 960],
    ] as const) {
      render(
        `<div style="width: 1400px"><e-page heading="Order #1042" width="${width}"><e-card heading="Items">Body</e-card></e-page></div>`,
      )
      const box = rect($('e-page'))
      expect([width, box.width]).toEqual([width, px])
      expect(box.left - rect($('div')).left).toBe((1400 - px) / 2)
    }
  })
  await at(360, () => {
    for (const width of ['details', 'form']) {
      render(record(`width="${width}"`))
      expect(rect($('e-page')).width).toBe(document.body.clientWidth)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
    }
  })
})

test('at 1440 px the side column is 320 px wide and starts 20 px after the main column', async () => {
  await at(1440, () => {
    render(record())
    const main = $('e-page > e-stack:not([slot])')
    const aside = $('e-page > [slot="aside"]')
    expect(rect(aside).width).toBe(320)
    expect(rect(aside).left - rect(main).right).toBe(20)
    expect(rect(aside).right).toBe(rect($('e-page')).right)
  })
})

test('the back link is a 32 px square left of the heading, on its line, and a 44 px target on a phone', async () => {
  await at(1440, () => {
    render(record())
    definePage()
    const back = $('[slot="back"]')
    const h1 = $('e-page > h1')
    expect([rect(back).width, rect(back).height]).toEqual([32, 32])
    expect(rect(back).right).toBeLessThanOrEqual(rect(h1).left)
    expect(Math.abs(middle(back) - middle(h1))).toBeLessThanOrEqual(2)
    expect(back.getAttribute('href')).toBe('/orders')
    expect(getComputedStyle(back).textDecorationLine).toBe('none')
  })
  expect(window.innerWidth).toBe(360)
  render(record())
  const back = $('[slot="back"]')
  expect(rect(back).height).toBeGreaterThanOrEqual(44)
  expect(Math.abs(middle(back) - middle($('e-page > h1')))).toBeLessThanOrEqual(2)
})

test('the status badges sit on the heading line after it, and the facts line starts under the heading', async () => {
  await at(1440, () => {
    render(record())
    const h1 = $('e-page > h1')
    const [first, second] = document.querySelectorAll('[slot="status"]')
    for (const badge of [first!, second!]) {
      expect(rect(badge).left).toBeGreaterThanOrEqual(rect(h1).right)
      expect(Math.abs(middle(badge) - middle(h1))).toBeLessThanOrEqual(2)
    }
    expect(rect(first!).left - rect(h1).right).toBe(8)
    const facts = $('[slot="facts"]')
    expect(rect(facts).top).toBeGreaterThanOrEqual(rect(h1).bottom)
    expect(rect(facts).left).toBe(rect(h1).left)
    expect([getComputedStyle(facts).fontSize]).toEqual(['13px'])
  })
})

test('previous and next touch as one control at the end of the header row, before the actions', async () => {
  await at(1440, () => {
    render(record())
    const [previous, next] = document.querySelectorAll('[slot="pagination"] > a')
    const actions = $('e-page > [slot="actions"]')
    expect([rect(previous!).width, rect(previous!).height]).toEqual([32, 32])
    expect(Math.abs(rect(next!).left - rect(previous!).right)).toBeLessThanOrEqual(1)
    expect(rect(next!).right).toBeLessThanOrEqual(rect(actions).left)
    expect(rect(actions).left - rect(next!).right).toBeLessThanOrEqual(12)
    expect(rect(actions).right).toBe(rect($('e-page')).right)
    expect(Math.abs(middle(next!) - middle($('e-page > h1')))).toBeLessThanOrEqual(2)
  })
})

test('on a phone the cards marked phone-order leave their column, 16 px apart, and at 1440 px they stay', async () => {
  render(record())
  expect(window.innerWidth).toBe(360)
  const order = ['Customer', 'Items', 'Payment', 'Delivery', 'Risk', 'Tags', 'Timeline'].map(card)
  for (let i = 1; i < order.length; i++) {
    expect(rect(order[i]!).top - rect(order[i - 1]!).bottom).toBe(16)
    expect(rect(order[i]!).left).toBe(rect(order[0]!).left)
  }
  expect(rect(card('Customer')).top).toBeGreaterThan(rect($('[slot="facts"]')).bottom)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  await at(1440, () => {
    render(record())
    expect(rect(card('Timeline')).top - rect(card('Payment')).bottom).toBe(16)
    expect(rect(card('Timeline')).left).toBe(rect(card('Items')).left)
    expect(rect(card('Customer')).top).toBe(rect($('[slot="aside"]')).top)
    expect(rect(card('Customer')).top).toBe(rect(card('Items')).top)
  })
})

test('a page with no header starts its content at its top, with the side column beside it', async () => {
  await at(1440, () => {
    render(
      `<e-page><e-card heading="Items">Body</e-card><e-card slot="aside" heading="Customer">Rahima</e-card></e-page>`,
    )
    expect(rect(card('Items')).top).toBe(rect($('e-page')).top)
    expect(rect(card('Customer')).top).toBe(rect(card('Items')).top)
  })
})

test('a long Bangla heading wraps inside the record header at 360 px', () => {
  const long = 'অর্ডার #1042, রহিমা খাতুন, সিলেট সদর, বাড়ি ১২, রাস্তা ৪, আম্বরখানা, পূর্ব দিকের গলি'
  expect(window.innerWidth).toBe(360)
  render(`<div lang="bn">${record('width="details"', long, 'bn')}</div>`)
  definePage()
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  for (const el of document.querySelectorAll('e-page, e-page > *, e-badge, [slot="pagination"] > a')) {
    expect(rect(el).right).toBeLessThanOrEqual(360)
  }
  const h1 = $('e-page > h1')
  expect(getComputedStyle(h1).overflowWrap).toBe('anywhere')
  // The status wraps under the heading, starting where it starts.
  const status = $('[slot="status"]')
  expect(rect(status).top).toBeGreaterThanOrEqual(rect(h1).bottom)
  expect(rect(status).left).toBe(rect(h1).left)
})
