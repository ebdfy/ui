import { expect, test } from 'vitest'
// The v2 layout tags: e-page, e-card, e-stack, e-heading and e-text draw from v2.css alone, and the
// script adds native headings without moving anything.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineCard } from '../../src/v2/card.ts'
import { definePage } from '../../src/v2/page.ts'
import { defineText } from '../../src/v2/text.ts'
import { inDark } from './colour.ts'

const bangla = 'অর্ডারের তালিকা এবং গ্রাহকের তথ্য দেখুন, পরিবর্তন করুন এবং সংরক্ষণ করুন, সবকিছু এক জায়গায়'

function render(html: string): void {
  document.body.innerHTML = html
}

const ordersPage = `<e-page heading="Orders"><button slot="actions">Save</button><e-card heading="Items">Body</e-card></e-page>`

function box(el: Element): number[] {
  const r = el.getBoundingClientRect()
  return [r.left, r.top, r.width, r.height]
}

test('without the script the page header shows the heading at 22 px with the actions at the right', () => {
  render(ordersPage)
  const el = document.querySelector('e-page')!
  const actions = document.querySelector('button')!
  const before = getComputedStyle(el, '::before')
  expect([before.content, before.fontSize, before.fontWeight]).toEqual(['"Orders"', '22px', '700'])
  const a = actions.getBoundingClientRect()
  const p = el.getBoundingClientRect()
  expect(a.right).toBeCloseTo(p.right, 0)
  expect(a.top).toBeLessThan(p.top + 40)
  const card = document.querySelector('e-card')!
  expect(getComputedStyle(card, '::before').content).toBe('"Items"')
  for (const tag of el.querySelectorAll('e-card, e-page')) {
    expect(getComputedStyle(tag).display).not.toBe('inline')
    expect(tag.getBoundingClientRect().height).toBeGreaterThan(0)
  }
})

// A page whose own script fills it stays hidden until then, so the browser never paints it empty.
test('a hidden page shows nothing', () => {
  render(`<e-page hidden heading="Orders"><e-card heading="Items">Body</e-card></e-page>`)
  expect(getComputedStyle(document.querySelector('e-page')!).display).toBe('none')
})

test('the script builds one h1 and one h2 and nothing moves by more than 1 px', async () => {
  render(ordersPage)
  const els = ['e-page', 'button', 'e-card'].map((s) => document.querySelector(s)!)
  const before = els.map(box)
  definePage()
  defineCard()
  await expect.element(page.getByRole('heading', { name: 'Orders', level: 1 })).toBeVisible()
  await expect.element(page.getByRole('heading', { name: 'Items', level: 2 })).toBeVisible()
  expect(document.querySelectorAll('h1').length).toBe(1)
  expect(document.querySelectorAll('h2').length).toBe(1)
  els.forEach((el, i) => {
    box(el).forEach((n, j) => expect(Math.abs(n - before[i]![j]!)).toBeLessThanOrEqual(1))
  })
  const h1 = document.querySelector('h1')!
  const p = els[0]!.getBoundingClientRect()
  const h = h1.getBoundingClientRect()
  expect([h.left, h.top, getComputedStyle(h1).fontSize]).toEqual([p.left, p.top, '22px'])
  expect(getComputedStyle(els[0]!, '::before').content).not.toBe('"Orders"')
  definePage()
  expect(document.querySelectorAll('h1').length).toBe(1)
})

// Order #1042 as the sample lays it out: each column one e-stack, the side column marked slot="aside",
// with a button in each card so the tab order can be read.
const orderPage = `<e-page heading="Order #1042"><e-button slot="actions">Confirm</e-button>
  <e-stack gap="4">
    <e-card heading="Items"><button>Items</button><p style="height: 240px; margin: 0">Two items</p></e-card>
    <e-card heading="Payment"><button>Payment</button></e-card>
  </e-stack>
  <e-stack gap="4" slot="aside">
    <e-card heading="Customer"><button>Customer</button></e-card>
    <e-card heading="Delivery"><button>Delivery</button></e-card>
    <e-card heading="Risk"><button>Risk</button></e-card>
    <e-card heading="Tags"><button>Tags</button></e-card>
  </e-stack>
</e-page>`

const card = (heading: string) =>
  [...document.querySelectorAll('e-card')].find((c) => c.getAttribute('heading') === heading)!
const rect = (el: Element) => el.getBoundingClientRect()

async function at<T>(width: number, run: () => T | Promise<T>): Promise<T> {
  await page.viewport(width, 900)
  try {
    return await run()
  } finally {
    await page.viewport(360, 800)
  }
}

test('at 1440 px the side column is 344 px wide, 16 px right of the order, and its cards keep their own spacing', async () => {
  await at(1440, () => {
    render(orderPage)
    const aside = document.querySelector('[slot="aside"]')!
    expect(rect(aside).width).toBe(344)
    expect(rect(card('Customer')).left - rect(card('Items')).right).toBe(16)
    expect(rect(card('Customer')).top).toBe(rect(card('Items')).top)
    // The tall Items card does not push Delivery down: the columns share no rows.
    expect(rect(card('Delivery')).top - rect(card('Customer')).bottom).toBe(16)
    expect(rect(card('Payment')).top - rect(card('Items')).bottom).toBe(16)
    expect(rect(document.querySelector('e-page > e-button')!).right).toBe(rect(aside).right)
  })
})

test('at 600 px the side column still sits beside the order, and at 599 px below the Payment card', async () => {
  await at(600, () => {
    render(orderPage)
    expect(rect(card('Customer')).left).toBeGreaterThan(rect(card('Items')).right)
    expect(rect(card('Customer')).top).toBe(rect(card('Items')).top)
  })
  await at(599, () => {
    render(orderPage)
    expect(rect(card('Customer')).top).toBeGreaterThan(rect(card('Payment')).bottom)
    expect(rect(card('Customer')).left).toBe(rect(card('Items')).left)
    expect(rect(card('Customer')).width).toBe(rect(card('Items')).width)
  })
})

test('without page actions the side column starts beside the order, not in the heading row', async () => {
  await at(1440, () => {
    render(orderPage.replace('<e-button slot="actions">Confirm</e-button>', ''))
    expect(rect(card('Customer')).top).toBe(rect(card('Items')).top)
    expect(rect(card('Customer')).top).toBeGreaterThan(rect(document.querySelector('e-page')!).top + 40)
  })
})

test('the tab order runs through the order before the side column at every width', async () => {
  for (const width of [360, 599, 600, 1440]) {
    await at(width, async () => {
      render(orderPage.replace('<e-button slot="actions">Confirm</e-button>', ''))
      const order: string[] = []
      for (let i = 0; i < 6; i++) {
        await userEvent.tab()
        order.push(document.activeElement!.textContent!)
      }
      expect([width, ...order]).toEqual([width, 'Items', 'Payment', 'Customer', 'Delivery', 'Risk', 'Tags'])
    })
  }
})

test('the script moves nothing in a page with a side column', async () => {
  await at(1440, () => {
    render(orderPage)
    const before = [...document.querySelectorAll('e-card, e-stack')].map(box)
    definePage()
    defineCard()
    const after = [...document.querySelectorAll('e-card, e-stack')].map(box)
    expect(
      after
        .flat()
        .map((n, i) => Math.abs(n - before.flat()[i]!))
        .filter((moved) => moved > 1),
    ).toEqual([])
  })
})

test('e-heading gets a heading role and e-text is drawn by css', () => {
  render('<e-heading level="3">Title</e-heading><e-text tone="subdued" size="meta">Note</e-text>')
  defineText()
  const heading = document.querySelector('e-heading')!
  expect([heading.getAttribute('role'), heading.getAttribute('aria-level')]).toEqual(['heading', '3'])
  const text = getComputedStyle(document.querySelector('e-text')!)
  expect([text.fontSize, text.display]).toEqual(['13px', 'block'])
})

test('e-stack gap="3" lays children 12 px apart in a column, and direction="row" in a row', () => {
  render('<e-stack gap="3"><i>a</i><i>b</i></e-stack><e-stack gap="3" direction="row"><i>c</i><i>d</i></e-stack>')
  const [column, row] = [...document.querySelectorAll('e-stack')]
  const [a, b] = [...column!.children].map((c) => c.getBoundingClientRect())
  expect(b!.top - a!.bottom).toBe(12)
  expect(b!.left).toBe(a!.left)
  const [c, d] = [...row!.children].map((x) => x.getBoundingClientRect())
  expect(d!.left - c!.right).toBe(12)
  expect(d!.top).toBe(c!.top)
})

test('a long Bangla heading and card text stay inside 360 px', () => {
  render(`<e-page heading="${bangla}"><e-card heading="${bangla}">${bangla}</e-card></e-page>`)
  definePage()
  defineCard()
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  for (const el of document.querySelectorAll('e-page, e-card, h1, h2')) {
    expect(el.getBoundingClientRect().right).toBeLessThanOrEqual(360)
  }
})

test('in dark the card sits on the surface colour with the foreground heading', async () => {
  render(ordersPage)
  definePage()
  defineCard()
  const probe = (name: string) => {
    const p = document.createElement('div')
    p.style.color = `var(--e-color-${name})`
    document.body.append(p)
    const c = getComputedStyle(p).color
    p.remove()
    return c
  }
  const seen = await inDark(async () => {
    const card = document.querySelector('e-card')!
    return [
      getComputedStyle(card).backgroundColor,
      getComputedStyle(card.querySelector('h2')!).color,
      probe('surface'),
      probe('fg'),
    ]
  })
  expect(seen[0]).toBe(seen[2])
  expect(seen[1]).toBe(seen[3])
})

test('a page, card and heading added after the script ran are built too', async () => {
  definePage()
  defineCard()
  defineText()
  render('')
  document.body.insertAdjacentHTML(
    'beforeend',
    '<e-page heading="Later"><e-card heading="Late card"><e-heading level="3">Late heading</e-heading></e-card></e-page>',
  )
  await expect.element(page.getByRole('heading', { name: 'Later', level: 1 })).toBeInTheDocument()
  await expect.element(page.getByRole('heading', { name: 'Late card', level: 2 })).toBeInTheDocument()
  await expect.element(page.getByRole('heading', { name: 'Late heading', level: 3 })).toBeInTheDocument()
  expect(document.querySelectorAll('e-page > h1')).toHaveLength(1)
})

test('at 1440 px a page with no aside gives its content the full width, and an aside takes a column', async () => {
  await page.viewport(1440, 900)
  try {
    render(ordersPage)
    const wide = document.querySelector('e-page')!.getBoundingClientRect()
    expect(document.querySelector('e-card')!.getBoundingClientRect().right).toBeCloseTo(wide.right, 0)
    render(
      `<e-page heading="Order"><e-card heading="Items">Body</e-card><e-card slot="aside" heading="Customer">Rahima</e-card></e-page>`,
    )
    const [main, aside] = document.querySelectorAll('e-card')
    expect(main!.getBoundingClientRect().right).toBeLessThan(aside!.getBoundingClientRect().left)
  } finally {
    await page.viewport(360, 800)
  }
})
