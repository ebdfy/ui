import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

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
  // The list is the surface, with its rounded edge; a row is a band of it.
  const list = table.shadowRoot!.querySelector('[role="list"]')!
  expect(getComputedStyle(list).backgroundColor).toBe('oklch(1 0 0)')
  expect(getComputedStyle(list).borderRadius).toBe('12px')
  expect(getComputedStyle(card).borderRadius).toBe('0px')
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

// Money in a column of its own, as the sample's Total: the amounts end on one edge in even digits.
async function showTotals(): Promise<HTMLElement> {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<eb-table label="Orders">
    <eb-column card="title">Order</eb-column>
    <eb-column card="title">Customer</eb-column>
    <eb-column card="end" align="end">Total</eb-column>
    <eb-row><span>#1042</span><span>Rahim Uddin</span><span>৳1,111</span></eb-row>
    <eb-row><span>#1041</span><span>Sumaiya Akter</span><span>৳8,888</span></eb-row>
    <eb-row><span>#1040</span><span>Md. Hasan</span><span>৳860</span></eb-row>
  </eb-table>`
  await settle()
  await document.fonts.ready
  return document.querySelector('eb-table')!
}

test('a column with align="end" ends its heading and every cell 12 px in from the right edge', async () => {
  const table = await showTotals()
  const headers = [...table.shadowRoot!.querySelectorAll('[role="columnheader"]')]
  const heading = table.querySelectorAll('eb-column')[2]!
  // The heading's words, measured as a range, since the column is a block as wide as its cell.
  const words = document.createRange()
  words.selectNodeContents(heading)
  const edge = Math.round(box(headers[2]!).right - 12)
  expect(Math.round(words.getBoundingClientRect().right)).toBe(edge)
  for (const r of rows()) expect(Math.round(box(r.children[2]!).right), r.textContent!).toBe(edge)
  // The other columns still start at their left edge.
  expect(Math.round(box(row(0).children[1]!).left)).toBe(Math.round(box(headers[1]!).left + 12))
})

test('every cell and heading draws tabular figures, so ৳1,111 and ৳8,888 are the same width', async () => {
  const table = await showTotals()
  for (const cell of [
    ...table.shadowRoot!.querySelectorAll('[role="columnheader"]'),
    ...rows().flatMap((r) => [...r.children]),
  ]) {
    expect(getComputedStyle(cell).fontVariantNumeric).toBe('tabular-nums')
  }
  expect(box(row(0).children[2]!).width).toBe(box(row(1).children[2]!).width)
})

// The sample's six columns, Area and Payment stepping aside as the table narrows.
const sixColumns = `
  <eb-column card="meta">Order</eb-column>
  <eb-column card="title">Customer</eb-column>
  <eb-column card="meta" priority="3">Area</eb-column>
  <eb-column card="status">Status</eb-column>
  <eb-column card="meta" priority="2">Payment</eb-column>
  <eb-column card="end" align="end">Total</eb-column>
  <eb-row>
    <span>#1041</span><span>Sumaiya Akter Chowdhury Rahman</span><span>Dhaka Cantonment, Mirpur DOHS</span>
    <span><eb-badge tone="info">Confirmed</eb-badge></span><span>bKash ৳1,250</span><span>৳1,250</span>
  </eb-row>`

// The same order in Bangla, whose words are wider and whose type sits on other metrics.
const sixColumnsBn = `
  <eb-column card="meta">অর্ডার</eb-column>
  <eb-column card="title">কাস্টমার</eb-column>
  <eb-column card="meta" priority="3">এলাকা</eb-column>
  <eb-column card="status">অবস্থা</eb-column>
  <eb-column card="meta" priority="2">পেমেন্ট</eb-column>
  <eb-column card="end" align="end">মোট</eb-column>
  <eb-row>
    <span>#1041</span><span>সুমাইয়া আক্তার চৌধুরী রহমান</span><span>ঢাকা ক্যান্টনমেন্ট, মিরপুর ডিওএইচএস</span>
    <span><eb-badge tone="info">কনফার্মড</eb-badge></span><span>বিকাশ ৳১,২৫০</span><span>৳১,২৫০</span>
  </eb-row>`

// The headings a table draws, in order.
const headings = (table: Element) =>
  [...table.querySelectorAll('eb-column')].filter((column) => column.assignedSlot).map((c) => c.textContent)

async function showSix(width: number, lang = 'en'): Promise<HTMLElement> {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<div style="width: ${width}px"><eb-table label="Orders" lang="${lang}">${lang === 'bn' ? sixColumnsBn : sixColumns}</eb-table></div>`
  await settle()
  await document.fonts.ready
  const table = document.querySelector('eb-table')!
  await expect.poll(() => headings(table).length > 0).toBe(true)
  return table
}

test.for([
  [1280, ['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total']],
  [900, ['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total']],
  [899, ['Order', 'Customer', 'Status', 'Payment', 'Total']],
  [720, ['Order', 'Customer', 'Status', 'Payment', 'Total']],
  [719, ['Order', 'Customer', 'Status', 'Total']],
  [600, ['Order', 'Customer', 'Status', 'Total']],
] as const)('a %i px table shows %j, its rows the same cells', async ([width, shown]) => {
  const table = await showSix(width)
  await expect.poll(() => headings(table)).toEqual(shown)
  const cells = [...row(0).children].filter((cell) => cell.assignedSlot).map((cell) => cell.textContent)
  const all = [
    '#1041',
    'Sumaiya Akter Chowdhury Rahman',
    'Dhaka Cantonment, Mirpur DOHS',
    'Confirmed',
    'bKash ৳1,250',
    '৳1,250',
  ]
  const names = ['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total']
  expect(cells).toEqual(all.filter((_, i) => shown.includes(names[i] as never)))
  // The header and the row share the tracks, so each cell sits under its heading.
  const lefts = [...table.shadowRoot!.querySelectorAll('[role="columnheader"]')].map((h) => Math.round(box(h).left))
  const cellLefts = [...row(0).shadowRoot!.querySelectorAll('[role="cell"]')].map((c) => Math.round(box(c).left))
  expect(cellLefts).toEqual(lefts)
})

test('a table that widens past 900 px brings its columns back', async () => {
  const table = await showSix(600)
  await expect.poll(() => headings(table)).toHaveLength(4)
  table.parentElement!.style.width = '1000px'
  await expect.poll(() => headings(table)).toHaveLength(6)
})

for (const lang of ['en', 'bn']) {
  test.for([600, 800, 1044, 1280])(
    `in ${lang} a %i px table keeps every cell and heading on one line`,
    async (width) => {
      const table = await showSix(width, lang)
      const lines = (el: Element) => {
        const range = document.createRange()
        range.selectNodeContents(el)
        return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
      }
      const shown = [...row(0).children, ...table.querySelectorAll('eb-column')].filter((el) => el.assignedSlot)
      expect(shown.filter((el) => lines(el.querySelector('eb-badge') ?? el) > 1).map((el) => el.textContent)).toEqual(
        [],
      )
      expect(box(row(0)).height).toBe(44)
      // A status badge sits whole on its line.
      expect(box(row(0).querySelector('eb-badge')!).height).toBeLessThanOrEqual(24)
    },
  )
}

test('a cell too long for its column ends in an ellipsis and carries its full text as a title', async () => {
  await showSix(600)
  const cells = [...row(0).shadowRoot!.querySelectorAll<HTMLElement>('[role="cell"]')]
  const name = cells[1]!
  const style = getComputedStyle(name)
  expect([style.whiteSpace, style.textOverflow, style.overflow]).toEqual(['nowrap', 'ellipsis', 'hidden'])
  expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
  await expect.poll(() => name.title).toBe('Sumaiya Akter Chowdhury Rahman')
  // A cell that fits has no title to repeat it.
  expect(cells[0]!.title).toBe('')
})

test('a cell that stops fitting when the table narrows gains its title, and loses it when it fits again', async () => {
  // Six columns of a 2400 px table give the name room for all its words.
  const table = await showSix(2400)
  const name = () => row(0).shadowRoot!.querySelectorAll<HTMLElement>('[role="cell"]')[1]!
  await expect.poll(() => name().title).toBe('')
  table.parentElement!.style.width = '600px'
  await expect.poll(() => name().title).toBe('Sumaiya Akter Chowdhury Rahman')
  table.parentElement!.style.width = '2400px'
  await expect.poll(() => name().title).toBe('')
})

// A row that opens an order: its order number is a link, and the whole row answers the pointer.
async function showLinked(width = 1280): Promise<HTMLElement> {
  await page.viewport(width, 800)
  document.body.innerHTML = `<eb-table label="Orders" selectable>
    <eb-column card="meta">Order</eb-column>
    <eb-column card="title">Customer</eb-column>
    <eb-column card="end" align="end">Total</eb-column>
    <eb-row href="#order-1042"><span>#1042</span><span>Rahim Uddin</span><span>৳1,250</span></eb-row>
    <eb-row open><span>#1039</span><span>Md. Hasan</span><span>৳1,800</span></eb-row>
    <eb-row><span>#1041</span><span>Sumaiya Akter</span><span>৳860</span></eb-row>
  </eb-table>`
  await settle()
  return document.querySelector('eb-table')!
}

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme} hovering a row with href or open paints surface-2 with a pointer; a plain row stays`, async () => {
    await showLinked()
    const run = async () => {
      const surface2 = getComputedStyle(document.documentElement).getPropertyValue('--eb-color-surface-2').trim()
      const found = []
      for (const r of rows()) {
        await userEvent.hover(r.children[1]!)
        const style = getComputedStyle(part(r))
        found.push({ background: style.backgroundColor === surface2, cursor: style.cursor })
      }
      await userEvent.unhover(rows()[2]!)
      return found
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(found).toEqual([
      { background: true, cursor: 'pointer' },
      { background: true, cursor: 'pointer' },
      { background: false, cursor: 'auto' },
    ])
  })
}

test('a row with href makes its first cell a link to it, which Tab reaches and Enter follows', async () => {
  await showLinked()
  const link = row(0).shadowRoot!.querySelector('a')!
  expect(link.getAttribute('href')).toBe('#order-1042')
  expect(link.textContent!.trim() === '' && link.querySelector('slot')!.assignedElements()[0]!.textContent).toBe(
    '#1042',
  )
  expect(row(1).shadowRoot!.querySelector('a')).toBeNull()
  link.focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => location.hash).toBe('#order-1042')
  history.replaceState(null, '', location.pathname + location.search)
})

test('a click anywhere on a row with href follows it, but a click on its checkbox only selects', async () => {
  await showLinked()
  await userEvent.click(row(0).children[1]!)
  await expect.poll(() => location.hash).toBe('#order-1042')
  history.replaceState(null, '', location.pathname + location.search)
  await userEvent.click(row(0).shadowRoot!.querySelector('eb-checkbox')!)
  expect(row(0).selected).toBe(true)
  expect(location.hash).toBe('')
})

test('at 360 px a card with href links its title and follows a tap', async () => {
  await showLinked(360)
  const link = row(0).shadowRoot!.querySelector('a')!
  expect(link.getAttribute('href')).toBe('#order-1042')
  await userEvent.click(row(0).children[2]!)
  await expect.poll(() => location.hash).toBe('#order-1042')
  history.replaceState(null, '', location.pathname + location.search)
})

// A phone's orders: one surface, the rows split by dividers, each two lines however long its words.
const longPhoneOrders = `
  <eb-column card="meta">Order</eb-column>
  <eb-column card="title">Customer</eb-column>
  <eb-column card="meta">Area</eb-column>
  <eb-column card="status">Status</eb-column>
  <eb-column card="meta">Payment</eb-column>
  <eb-column card="end">Total</eb-column>
  <eb-row>
    <span>#1041</span><span>সুমাইয়া আক্তার চৌধুরী রহমান সিদ্দিকা খানম তালুকদার</span><span>ঢাকা ক্যান্টনমেন্ট, মিরপুর ডিওএইচএস</span>
    <span><eb-badge tone="info">কনফার্মড</eb-badge></span><span>বিকাশ ৳১,২৫০</span><span>৳১,২৫০</span>
  </eb-row>
  <eb-row>
    <span>#1040</span><span>রহিম উদ্দিন</span><span>সাভার</span>
    <span><eb-badge tone="attention">নতুন</eb-badge></span><span>COD</span><span>৳৮৬০</span>
  </eb-row>
  <eb-row>
    <span>#1039</span><span>মো. হাসান</span><span>মিরপুর</span>
    <span><eb-badge tone="critical">ফেরত এসেছে</eb-badge></span><span>COD</span><span>৳১,৮০০</span>
  </eb-row>`

async function showPhoneList(): Promise<HTMLElement> {
  await page.viewport(360, 800)
  document.body.innerHTML = `<eb-table label="অর্ডার" lang="bn">${longPhoneOrders}</eb-table>`
  await settle()
  await document.fonts.ready
  return document.querySelector('eb-table')!
}

const cardOf = (r: Element) => r.shadowRoot!.querySelector<HTMLElement>('[part="card"]')!

test('below 600 px the rows are one list on one surface, split by 1 px dividers rather than gaps', async () => {
  const table = await showPhoneList()
  const list = table.shadowRoot!.querySelector('[role="list"]')!
  const style = getComputedStyle(list)
  expect([style.backgroundColor, style.borderRadius]).toEqual(['oklch(1 0 0)', '12px'])
  const cards = rows().map(cardOf)
  for (const card of cards) expect(getComputedStyle(card).borderRadius).toBe('0px')
  for (let i = 1; i < cards.length; i += 1) {
    expect(box(cards[i]!).top).toBe(box(cards[i - 1]!).bottom)
    expect(getComputedStyle(cards[i]!).borderTopWidth).toBe('1px')
  }
  // The first row's divider sits under the list's own edge, not drawn inside it.
  expect(Math.round(box(cards[0]!).top) + 1).toBeLessThanOrEqual(Math.round(box(list).top) + 1)
  expect(scrollWidth()).toBeLessThanOrEqual(360)
})

test('at 360 px in Bangla a long meta line ends in an ellipsis and the status stays at its end', async () => {
  await showPhoneList()
  const heights = rows().map((r) => box(cardOf(r)).height)
  // Every row is two lines, however long its words.
  expect(heights).toEqual([heights[0], heights[0], heights[0]])
  const r = row(0)
  const card = cardOf(r)
  const facts = r.shadowRoot!.querySelector<HTMLElement>('.facts')!
  const style = getComputedStyle(facts)
  expect([style.whiteSpace, style.textOverflow, style.overflow]).toEqual(['nowrap', 'ellipsis', 'hidden'])
  expect(facts.scrollWidth).toBeGreaterThan(facts.clientWidth)
  const [number, , area, status] = [...r.children] as Element[]
  const inside = box(card)
  expect(Math.round(box(status!).right)).toBe(Math.round(inside.right - 16))
  // The status shares the meta line: its middle is within that line's box.
  const middle = (box(status!).top + box(status!).bottom) / 2
  expect(middle).toBeGreaterThan(box(number!).top)
  expect(middle).toBeLessThan(box(number!).bottom)
  // The facts end before the status, never under it.
  expect(box(facts).right).toBeLessThanOrEqual(box(status!).left)
  expect(box(area!).top).toBe(box(number!).top)
})

test('at 360 px in Bangla a long name ends in an ellipsis beside the amount, on one line', async () => {
  await showPhoneList()
  const [, name, , , , total] = [...row(0).children] as HTMLElement[]
  const style = getComputedStyle(name!)
  expect([style.whiteSpace, style.textOverflow, style.overflow]).toEqual(['nowrap', 'ellipsis', 'hidden'])
  expect(name!.scrollWidth).toBeGreaterThan(name!.clientWidth)
  expect(box(total!).left).toBeGreaterThanOrEqual(box(name!).right)
  // Its first line is as tall as the short name's beside it.
  expect(box(name!).height).toBe(box(row(1).children[1]!).height)
})

for (const theme of ['light', 'dark'] as const) {
  test(`in ${theme} a row's link takes Tab with the 2 px focus ring`, async () => {
    const run = async () => {
      await showLinked()
      document.body.insertAdjacentHTML('afterbegin', '<button id="before">Before</button>')
      document.querySelector<HTMLElement>('#before')!.focus()
      // The header's checkbox, the row's checkbox, then the row's link.
      for (let i = 0; i < 3; i += 1) await userEvent.keyboard('{Tab}')
      const link = row(0).shadowRoot!.activeElement as HTMLElement
      const style = getComputedStyle(link)
      return {
        focus: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-focus').trim(),
        tag: link?.localName,
        ring: [style.outlineWidth, style.outlineStyle, style.outlineOffset, style.outlineColor],
      }
    }
    const found = theme === 'dark' ? await inDark(run) : await run()
    expect(found.tag).toBe('a')
    expect(found.ring).toEqual(['2px', 'solid', '2px', found.focus])
  })
}

test('a click in the checkbox cell beside the checkbox, or one that ends a drag over words, opens nothing', async () => {
  await showLinked()
  const check = row(0).shadowRoot!.querySelector<HTMLElement>('[role="cell"].check')!
  const at = check.getBoundingClientRect()
  await userEvent.click(check, { position: { x: 2, y: at.height / 2 } })
  const name = row(0).children[1]!
  getSelection()!.selectAllChildren(name)
  name.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))
  getSelection()!.removeAllRanges()
  expect(location.hash).toBe('')
})

// A phone's merchant selects orders too: a selectable table's cards lead with a checkbox.
async function showSelectableCards(lang = 'en'): Promise<HTMLElement & { selected: Element[] }> {
  await page.viewport(360, 800)
  document.body.innerHTML = `<div lang="${lang}"><eb-table label="Orders" selectable>
    <eb-column card="meta">Order</eb-column>
    <eb-column card="title">Customer</eb-column>
    <eb-column card="status">Status</eb-column>
    <eb-column card="end" align="end">Total</eb-column>
    <eb-row><span>#1042</span><span>Rahim Uddin</span><span><eb-badge tone="attention">New</eb-badge></span><span>৳1,250</span></eb-row>
    <eb-row><span>#1041</span><span>Sumaiya Akter</span><span><eb-badge tone="info">Confirmed</eb-badge></span><span>৳860</span></eb-row>
    <eb-row><span>#1040</span><span>Karim Sheikh</span><span><eb-badge tone="shipped">With courier</eb-badge></span><span>৳990</span></eb-row>
  </eb-table></div>`
  await settle()
  for (const checkbox of document.querySelectorAll<Lit>('eb-checkbox')) await checkbox.updateComplete
  return document.querySelector('eb-table')!
}

test('at 360 px a selectable table leads each card with a checkbox named for its order, a 44 px target', async () => {
  await showSelectableCards()
  for (const [i, number] of ['#1042', '#1041', '#1040'].entries()) {
    const checkbox = row(i).shadowRoot!.querySelector('eb-checkbox')!
    expect(checkbox.getAttribute('label')).toBe(`Select ${number}`)
    const card = box(cardOf(row(i)))
    const at = box(checkbox)
    expect(Math.round(at.left)).toBe(Math.round(card.left + 16))
    // It leads the card, before the name.
    expect(at.right).toBeLessThanOrEqual(box(row(i).children[1]!).left)
  }
  expect(scrollWidth()).toBeLessThanOrEqual(360)
})

test('at 360 px ticking two cards selects them, tints them and fires eb-selection for each', async () => {
  const table = await showSelectableCards()
  let heard = 0
  table.addEventListener('eb-selection', () => (heard += 1))
  for (const i of [0, 2]) await userEvent.click(row(i).shadowRoot!.querySelector('eb-checkbox')!)
  expect(table.selected).toEqual([row(0), row(2)])
  expect(heard).toBe(2)
  const soft = getComputedStyle(document.documentElement).getPropertyValue('--eb-color-accent-soft').trim()
  expect(getComputedStyle(cardOf(row(0))).backgroundColor).toBe(soft)
  expect(getComputedStyle(cardOf(row(1))).backgroundColor).not.toBe(soft)
})

test('at 360 px in Bangla a card checkbox is named #1042 নির্বাচন', async () => {
  await showSelectableCards('bn')
  expect(row(0).shadowRoot!.querySelector('eb-checkbox')!.getAttribute('label')).toBe('#1042 নির্বাচন')
})
