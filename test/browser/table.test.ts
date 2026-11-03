import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

type Lit = HTMLElement & { updateComplete: Promise<unknown> }

const orders = `
  <eb-column card="title">Order</eb-column>
  <eb-column card="title">Customer</eb-column>
  <eb-column card="end">Total</eb-column>
  <eb-column card="meta">Status</eb-column>
  <eb-row><span>#1042</span><span>রহিম উদ্দিন</span><span>৳১,২৫০</span><span><eb-badge tone="attention">নতুন</eb-badge></span></eb-row>
  <eb-row><span>#1041</span><span>সুমাইয়া আক্তার ঢাকা ক্যান্টনমেন্ট মিরপুর ডিওএইচএস</span><span>৳৮৬০</span><span><eb-courier-status status="OUT_FOR_DELIVERY"></eb-courier-status> <eb-badge tone="info">কনফার্মড</eb-badge></span></eb-row>
`

async function settle(): Promise<void> {
  for (const el of document.querySelectorAll<Lit>('eb-table, eb-row, eb-badge, eb-courier-status')) {
    await el.updateComplete
  }
}

async function show(width: number): Promise<HTMLElement> {
  await page.viewport(width, 800)
  document.body.innerHTML = `<eb-table label="Orders">${orders}</eb-table>`
  await settle()
  return document.querySelector('eb-table')!
}

const rows = () => [...document.querySelectorAll('eb-row')]
const row = (i: number) => rows()[i]!
const box = (el: Element) => el.getBoundingClientRect()
const scrollWidth = () => document.documentElement.scrollWidth

afterEach(async () => {
  await page.viewport(360, 800)
})

test('at 360 px each row is a card holding its cells, with no sideways scroll', async () => {
  const table = await show(360)
  expect(table.shadowRoot!.querySelector('[role="table"]')).toBeNull()
  expect(table.shadowRoot!.querySelector('[role="list"]')!.getAttribute('aria-label')).toBe('Orders')
  const first = row(0)
  const card = first.shadowRoot!.querySelector('[part="card"]')!
  expect(card.getAttribute('role')).toBe('listitem')
  expect(getComputedStyle(card).backgroundColor).toBe('oklch(1 0 0)')
  expect(getComputedStyle(card).borderRadius).toBe('12px')
  const cells = [...first.children]
  expect(cells).toHaveLength(4)
  for (const cell of cells) expect(box(cell).width).toBeGreaterThan(0)
  const [number, customer, total, status] = cells as [Element, Element, Element, Element]
  // The number and name lead the first line with the total at its end; the status sits under them.
  expect(box(customer).top).toBe(box(number).top)
  expect(box(total).right).toBeGreaterThan(box(customer).right)
  expect(box(status).top).toBeGreaterThanOrEqual(box(number).bottom)
  expect(scrollWidth()).toBeLessThanOrEqual(360)
})

test('at 1280 px the same rows are a table under the column headings', async () => {
  const table = await show(1280)
  const grid = table.shadowRoot!.querySelector('[role="table"]')!
  expect(grid.getAttribute('aria-label')).toBe('Orders')
  const headers = [...grid.querySelectorAll('[role="columnheader"]')]
  expect(headers.map((h) => (h.querySelector('slot') as HTMLSlotElement).assignedElements()[0]?.textContent)).toEqual([
    'Order',
    'Customer',
    'Total',
    'Status',
  ])
  for (const row of rows()) {
    expect(row.shadowRoot!.querySelector('[part="row"]')!.getAttribute('role')).toBe('row')
    const cells = [...row.shadowRoot!.querySelectorAll('[role="cell"]')]
    expect(cells.map((cell) => Math.round(box(cell).left))).toEqual(headers.map((h) => Math.round(box(h).left)))
  }
  expect(scrollWidth()).toBeLessThanOrEqual(1280)
})

test('a column with grow="2" is twice as wide as a column without, and the rows line up under it', async () => {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<eb-table label="Orders" selectable>
    <eb-column>Order</eb-column>
    <eb-column grow="2">Customer</eb-column>
    <eb-column>Total</eb-column>
    <eb-row><span>#1042</span><span>রহিম উদ্দিন</span><span>৳১,২৫০</span></eb-row>
  </eb-table>`
  await settle()
  const table = document.querySelector('eb-table')!
  const headers = [...table.shadowRoot!.querySelectorAll('[role="columnheader"]:not(.check)')]
  const [order, customer, total] = headers.map((h) => box(h).width) as [number, number, number]
  expect(customer).toBeCloseTo(2 * order, 1)
  expect(total).toBeCloseTo(order, 1)
  const cells = [...row(0).shadowRoot!.querySelectorAll('[role="cell"]:not(.check)')]
  expect(cells.map((cell) => Math.round(box(cell).left))).toEqual(headers.map((h) => Math.round(box(h).left)))
})

test('the list is cards at 599 px and a table at 600 and 700 px, never scrolling sideways', async () => {
  for (const [width, role] of [
    [599, 'list'],
    [600, 'table'],
    [700, 'table'],
  ] as const) {
    const table = await show(width)
    expect(table.shadowRoot!.querySelector(`[role="${role}"]`), `${width}`).not.toBeNull()
    expect(scrollWidth(), `${width}`).toBeLessThanOrEqual(width)
  }
})

test('a table turns to cards when the screen narrows, and back', async () => {
  const table = await show(1280)
  await page.viewport(360, 800)
  await expect.poll(() => table.shadowRoot!.querySelector('[role="list"]')).not.toBeNull()
  await expect.poll(() => row(0).shadowRoot!.querySelector('[part="card"]')).not.toBeNull()
  await page.viewport(1280, 800)
  await expect.poll(() => row(0).shadowRoot!.querySelector('[part="row"]')).not.toBeNull()
})

test('a row added after the table draws takes its place', async () => {
  const table = await show(1280)
  table.insertAdjacentHTML(
    'beforeend',
    '<eb-row><span>#1040</span><span>করিম</span><span>৳২,৪৫০</span><span>-</span></eb-row>',
  )
  await expect.poll(() => row(2).shadowRoot?.querySelectorAll('[role="cell"]').length).toBe(4)
  expect(box(row(2)).top).toBeGreaterThan(box(row(1)).top)
})

test('a list shows each child as a card, 12 px apart', async () => {
  document.body.innerHTML = '<eb-list><div>One</div><div>Two</div></eb-list>'
  await (document.querySelector('eb-list') as Lit).updateComplete
  const [one, two] = [...document.querySelectorAll('eb-list > div')] as [Element, Element]
  expect(getComputedStyle(one).backgroundColor).toBe('oklch(1 0 0)')
  expect(getComputedStyle(one).borderRadius).toBe('12px')
  expect(box(two).top - box(one).bottom).toBe(12)
})

for (const width of [360, 1280]) {
  test(`at ${width} px a loading list shows 4 skeleton rows, and its top stays put when 4 rows arrive`, async () => {
    await page.viewport(width, 800)
    document.body.innerHTML = `<h1>Orders</h1><eb-table label="Orders" loading>
      <eb-column card="title">Order</eb-column><eb-column card="end">Total</eb-column>
    </eb-table>`
    const table = document.querySelector<Lit>('eb-table')!
    await table.updateComplete
    const skeletons = table.shadowRoot!.querySelectorAll('[part="skeleton"]')
    expect(skeletons).toHaveLength(4)
    for (const skeleton of skeletons) expect(box(skeleton).height).toBeGreaterThan(0)
    expect(table.getAttribute('aria-busy')).toBe('true')
    const top = box(table).top

    const four = [1, 2, 3, 4].map((n) => `<eb-row><span>#104${n}</span><span>৳${n}০০</span></eb-row>`).join('')
    table.insertAdjacentHTML('beforeend', four)
    table.removeAttribute('loading')
    await table.updateComplete
    await settle()
    expect(table.shadowRoot!.querySelectorAll('[part="skeleton"]')).toHaveLength(0)
    expect(table.hasAttribute('aria-busy')).toBe(false)
    for (const r of rows()) expect(box(r).height).toBeGreaterThan(0)
    expect(box(table).top).toBe(top)
  })
}

// Ink's rows: 44 px, or 40 px when dense, under a 36 px header on surface-2.
async function showRows(attributes: string, rowsHtml: string): Promise<HTMLElement> {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<eb-table label="Orders" ${attributes}>
    <eb-column card="title">Order</eb-column>
    <eb-column card="title">Customer</eb-column>
    <eb-column card="meta">Status</eb-column>
    ${rowsHtml}
  </eb-table>`
  await settle()
  return document.querySelector('eb-table')!
}

const ordersRows = `
  <eb-row><span>#1042</span><span>Rahim Uddin</span><span><eb-badge tone="attention">New</eb-badge></span></eb-row>
  <eb-row open><span>#1039</span><span>Md. Hasan</span><span><eb-badge tone="critical">Returned</eb-badge></span></eb-row>
  <eb-row selected><span>#1041</span><span>Sumaiya Akter</span><span><eb-badge tone="info">Confirmed</eb-badge></span></eb-row>
`

const part = (el: Element) => el.shadowRoot!.querySelector<HTMLElement>('[part="row"]')!

test('at 1280 px a row holding a status pill is 44 px, and the header row 36 px of 13 px text-2 on surface-2', async () => {
  const table = await showRows('', ordersRows)
  for (const r of rows()) expect(box(r).height, r.textContent!).toBe(44)
  const head = table.shadowRoot!.querySelector('.head')!
  expect(box(head).height).toBe(36)
  expect(getComputedStyle(head).backgroundColor).toBe('oklch(0.972 0.003 85)')
  const header = getComputedStyle(table.shadowRoot!.querySelector('[role="columnheader"]')!)
  expect([header.fontSize, header.fontWeight, header.color]).toEqual(['13px', '500', 'oklch(0.47 0.008 85)'])
})

test('a compact table has 40 px rows', async () => {
  await showRows('density="compact"', ordersRows)
  for (const r of rows()) expect(box(r).height, r.textContent!).toBe(40)
})

const openAndSelected = async () => {
  await showRows('', ordersRows)
  const root = getComputedStyle(document.documentElement)
  return {
    accent: root.getPropertyValue('--eb-color-accent').trim(),
    surface2: root.getPropertyValue('--eb-color-surface-2').trim(),
    rows: rows().map((r) => {
      const bar = getComputedStyle(part(r), '::before')
      return {
        background: getComputedStyle(part(r)).backgroundColor,
        bar: bar.content === 'none' ? null : { width: bar.width, colour: bar.backgroundColor, left: bar.left },
        height: box(r).height,
      }
    }),
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme} the open row alone has a 2 px accent bar on its leading edge, over surface-2`, async () => {
    const found = theme === 'dark' ? await inDark(openAndSelected) : await openAndSelected()
    const [plain, open, selected] = found.rows as [
      (typeof found.rows)[0],
      (typeof found.rows)[0],
      (typeof found.rows)[0],
    ]
    expect(open.bar).toEqual({ width: '2px', colour: found.accent, left: '0px' })
    expect(open.background).toBe(found.surface2)
    expect(plain.bar).toBeNull()
    expect(selected.bar).toBeNull()
  })
}

test('a selected row is tinted accent-soft, unlike the open row and unlike a Confirmed status', async () => {
  await showRows('', ordersRows)
  const [open, selected] = [row(1), row(2)]
  expect(getComputedStyle(part(selected)).backgroundColor).toBe('oklch(0.96 0.022 268)')
  expect(getComputedStyle(part(open)).backgroundColor).not.toBe(getComputedStyle(part(selected)).backgroundColor)
  const confirmedDot = selected.querySelector('eb-badge')!.shadowRoot!.querySelector('.dot')!
  expect(getComputedStyle(confirmedDot).backgroundColor).toBe('oklch(0.47 0.008 85)')
})

// Selection: a checkbox leads each row and the header, and the header's tells all, none or some.
async function showSelectable(lang = 'en'): Promise<HTMLElement & { selected: Element[] }> {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<div lang="${lang}"><eb-table label="Orders" selectable>
    <eb-column card="title">Order</eb-column>
    <eb-column card="title">Customer</eb-column>
    <eb-column card="meta">Status</eb-column>
    <eb-row><span>#1042</span><span>Rahim Uddin</span><span><eb-badge tone="attention">New</eb-badge></span></eb-row>
    <eb-row><span>#1041</span><span>Sumaiya Akter</span><span><eb-badge tone="info">Confirmed</eb-badge></span></eb-row>
    <eb-row><span>#1040</span><span>Karim Sheikh</span><span><eb-badge tone="shipped">With courier</eb-badge></span></eb-row>
  </eb-table></div>`
  await settle()
  for (const checkbox of document.querySelectorAll<Lit>('eb-checkbox')) await checkbox.updateComplete
  return document.querySelector('eb-table')!
}

const tick = (name: string) => page.getByRole('checkbox', { name, exact: true }).click()
const all = () => document.querySelector('eb-table')!.shadowRoot!.querySelector('eb-checkbox')!
const flags = (el: { checked: boolean; indeterminate: boolean }) => ({ checked: el.checked, mixed: el.indeterminate })

test('a selectable table names a checkbox for each row and one for all, in a 40 px leading column', async () => {
  await showSelectable()
  for (const name of ['Select all', 'Select #1042', 'Select #1041', 'Select #1040']) {
    await expect.element(page.getByRole('checkbox', { name, exact: true })).toBeVisible()
  }
  const head = document.querySelector('eb-table')!.shadowRoot!
  const headers = [...head.querySelectorAll('[role="columnheader"]')]
  expect(Math.round(box(headers[0]!).width)).toBe(40)
  for (const r of rows()) {
    const cells = [...r.shadowRoot!.querySelectorAll('[role="cell"]')]
    expect(cells.map((cell) => Math.round(box(cell).left))).toEqual(headers.map((h) => Math.round(box(h).left)))
  }
})

test('ticking 2 of 3 rows selects them, makes the header mixed, and fires eb-selection for each', async () => {
  const table = await showSelectable()
  const heard: Event[] = []
  document.body.addEventListener('eb-selection', (event) => heard.push(event))
  await tick('Select #1042')
  await tick('Select #1040')
  await expect.poll(() => flags(all())).toEqual({ checked: false, mixed: true })
  expect(rows().map((r) => r.hasAttribute('selected'))).toEqual([true, false, true])
  expect(table.selected).toEqual([row(0), row(2)])
  await expect
    .element(page.getByRole('checkbox', { name: 'Select all', exact: true }))
    .toHaveAttribute('aria-checked', 'mixed')
  expect(heard).toHaveLength(2)
  expect(heard.every((event) => event.bubbles && event.composed)).toBe(true)
})

test('the header checkbox selects every row from some or none, and clears them from all', async () => {
  const table = await showSelectable()
  await tick('Select #1041')
  await tick('Select all')
  await expect.poll(() => table.selected.length).toBe(3)
  expect(flags(all())).toEqual({ checked: true, mixed: false })
  await tick('Select all')
  await expect.poll(() => table.selected.length).toBe(0)
  expect(flags(all())).toEqual({ checked: false, mixed: false })
  expect(rows().map((r) => r.hasAttribute('selected'))).toEqual([false, false, false])
})

test('a row the app deselects clears its checkbox and the header follows', async () => {
  const table = await showSelectable()
  await tick('Select all')
  await expect.poll(() => table.selected.length).toBe(3)
  ;(row(1) as HTMLElement & { selected: boolean }).selected = false
  await expect.poll(() => flags(all())).toEqual({ checked: false, mixed: true })
  const own = row(1).shadowRoot!.querySelector('eb-checkbox')!
  expect(own.checked).toBe(false)
})

test('in Bangla the checkboxes are named সব নির্বাচন and #1042 নির্বাচন', async () => {
  await showSelectable('bn')
  await expect.element(page.getByRole('checkbox', { name: 'সব নির্বাচন', exact: true })).toBeVisible()
  await expect.element(page.getByRole('checkbox', { name: '#1042 নির্বাচন', exact: true })).toBeVisible()
})

test('a table without selectable has no checkboxes', async () => {
  await showRows('', ordersRows)
  expect(document.querySelector('eb-table')!.shadowRoot!.querySelector('eb-checkbox')).toBeNull()
  for (const r of rows()) expect(r.shadowRoot!.querySelector('eb-checkbox')).toBeNull()
})

// A phone's order card: the name and the amount, then the order number, area and payment joined by
// dots with the status at the line's end, and a note such as a risk banner under it all.
const phoneOrders = `
  <eb-column card="meta">Order</eb-column>
  <eb-column card="title">Customer</eb-column>
  <eb-column card="meta">Area</eb-column>
  <eb-column card="status">Status</eb-column>
  <eb-column card="meta">Payment</eb-column>
  <eb-column card="end">Total</eb-column>
  <eb-row>
    <span>#1039</span><span>মো. হাসান</span><span>সাভার</span>
    <span><eb-badge tone="attention">নতুন</eb-badge></span><span>COD</span><span>৳১,৮০০</span>
    <eb-banner card="note" tone="danger">৫টি অর্ডারের ৩টি ফেরত এসেছে</eb-banner>
  </eb-row>`

async function showPhoneOrders(width: number): Promise<HTMLElement> {
  await page.viewport(width, 800)
  document.body.innerHTML = `<eb-table label="অর্ডার" lang="bn">${phoneOrders}</eb-table>`
  await settle()
  await (document.querySelector('eb-banner') as Lit).updateComplete
  return document.querySelector('eb-row')!
}

test('at 360 px a card leads with the name and amount, then number, area and payment joined by dots, the status at the end', async () => {
  const card = await showPhoneOrders(360)
  const [number, name, area, status, payment, total] = [...card.children] as Element[]
  const inside = box(card.shadowRoot!.querySelector('[part="card"]')!)
  // The two share a baseline; Bangla words and the taka sign come from fonts of different heights.
  expect(box(total!).top).toBeLessThan(box(name!).bottom)
  expect(box(total!).bottom).toBeGreaterThan(box(name!).top)
  expect(Math.round(box(total!).right)).toBe(Math.round(inside.right - 16))
  const line = [number!, area!, payment!].map(box)
  expect(line.every((b) => b.top === line[0]!.top && b.top >= box(name!).bottom)).toBe(true)
  expect(line[0]!.right).toBeLessThan(line[1]!.left)
  expect(line[1]!.right).toBeLessThan(line[2]!.left)
  const dots = [...card.shadowRoot!.querySelectorAll('.meta [aria-hidden="true"]')].map((dot) =>
    dot.textContent!.trim(),
  )
  expect(dots).toEqual(['·', '·'])
  expect(Math.round(box(status!).right)).toBe(Math.round(inside.right - 16))
  expect(box(status!).bottom).toBeGreaterThan(line[0]!.top)
  expect(box(status!).top).toBeLessThan(line[0]!.bottom)
  expect(scrollWidth()).toBeLessThanOrEqual(360)
})

test('at 360 px a note sits under the card lines across its width; at 1280 px it is not a cell and not drawn', async () => {
  let card = await showPhoneOrders(360)
  const note = card.querySelector('eb-banner')!
  const inside = box(card.shadowRoot!.querySelector('[part="card"]')!)
  expect(box(note).top).toBeGreaterThan(box(card.querySelector('span')!).bottom)
  expect(Math.round(box(note).width)).toBe(Math.round(inside.width - 32))
  card = await showPhoneOrders(1280)
  expect(card.shadowRoot!.querySelectorAll('[role="cell"]')).toHaveLength(6)
  expect(card.querySelector('eb-banner')!.assignedSlot).toBeNull()
  expect(box(card.querySelector('eb-banner')!).height).toBe(0)
})

test('a selectable table keeps its header row at 36 px', async () => {
  const table = await showSelectable()
  expect(box(table.shadowRoot!.querySelector('.head')!).height).toBe(36)
})

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme} a selected row is tinted accent-soft even when it is also the open row, and keeps the bar`, async () => {
    const run = async () => {
      await showRows('', `<eb-row open selected><span>#1039</span><span>Md. Hasan</span><span>-</span></eb-row>`)
      const root = getComputedStyle(document.documentElement)
      const r = part(row(0))
      return {
        soft: root.getPropertyValue('--eb-color-accent-soft').trim(),
        background: getComputedStyle(r).backgroundColor,
        bar: getComputedStyle(r, '::before').width,
      }
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(found.background).toBe(found.soft)
    expect(found.bar).toBe('2px')
  })
}
