import { afterEach, expect, test } from 'vitest'
// e-index-table: one card holding view tabs, a toolbar (search, filter chips, Add filter, sort), the
// table and the pager, drawn by v2.css alone. The script gives each chip its remove button in the room
// the CSS kept, and removing one tells the page which filter went.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineEmptyState } from '../../src/v2/empty-state.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineIcon } from '../../src/v2/icon.ts'
import { defineIndexTable, type EIndexTable } from '../../src/v2/index-table.ts'
import { definePagination } from '../../src/v2/pagination.ts'
import { defineSelect } from '../../src/v2/select.ts'
import { defineTable } from '../../src/v2/table.ts'
import { defineTabs } from '../../src/v2/tabs.ts'

// Each test starts at the project's 360 px, whatever width the one before it took.
afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const row = (n: number) =>
  `<e-row><span><a href="/orders/${n}">#${n}</a></span><span>Rahima Akter</span><span align="end">৳1,930</span></e-row>`

const orders = (lang = 'en') => `<div lang="${lang}" style="padding: 16px">
  <e-index-table label="Orders">
    <e-tabs label="Order views">
      <e-tab value="all" count="120" selected>All</e-tab>
      <e-tab value="new" count="12">New</e-tab>
    </e-tabs>
    <e-search-field label="Search orders" placeholder="Search orders"></e-search-field>
    <e-button>Add filter</e-button>
    <span slot="filter" name="date"><span>${lang === 'bn' ? 'তারিখ: গত ৩০ দিন' : 'Date: Last 30 days'}</span></span>
    <e-select label="Sort" hide-label><option value="newest" selected>Newest first</option><option value="oldest">Oldest first</option></e-select>
    <e-table label="Orders" style="--e-columns: 80px 1fr auto">
      <e-row head><span>Order</span><span>Customer</span><span align="end">Total</span></e-row>
      ${[1042, 1041, 1040].map(row).join('')}
    </e-table>
    <e-pagination label="1–10 of 120" has-next></e-pagination>
  </e-index-table>
</div>`

function mount(html: string): void {
  document.body.innerHTML = html
}

const define = () => {
  defineIcon()
  defineButton()
  defineFields()
  defineSelect()
  defineTabs()
  defineTable()
  definePagination()
  defineEmptyState()
  defineIndexTable()
}

const tags = () => [...document.querySelectorAll('*')].filter((tag) => tag.localName.startsWith('e-'))
const boxes = (found: Element[]) =>
  found.map((tag) => {
    const { x, y, width, height } = tag.getBoundingClientRect()
    return { tag: tag.localName, x, y, width, height }
  })

function moved(before: ReturnType<typeof boxes>, after: ReturnType<typeof boxes>): string[] {
  return before.flatMap((one, i) =>
    (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(one[key] - after[i]![key]) > 1)
      .map((key) => `${one.tag} ${key} ${one[key]} -> ${after[i]![key]}`),
  )
}

const top = (selector: string) => Math.round(document.querySelector(selector)!.getBoundingClientRect().top)
const middle = (selector: string) => {
  const { top, height } = document.querySelector(selector)!.getBoundingClientRect()
  return top + height / 2
}

// The tests above the first define() run before any test defines the tags, so they see the CSS alone.
test('before the script at 1280 px the tabs, then one toolbar line, then the table and the pager', async () => {
  await page.viewport(1280, 800)
  mount(orders())
  await document.fonts.ready
  const toolbar = ['e-search-field', '[slot="filter"]', 'e-button', 'e-select'].map(top)
  // One line: the controls are centred on it, the 32 px button beside the 36 px fields.
  const middles = ['e-search-field', '[slot="filter"]', 'e-button', 'e-select'].map(middle)
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThanOrEqual(1)
  expect(top('e-tabs')).toBeLessThan(toolbar[0]!)
  expect(top('e-table')).toBeGreaterThan(toolbar[0]!)
  expect(top('e-pagination')).toBeGreaterThan(top('e-table'))
  // The tabs and the table run edge to edge in the card.
  const card = document.querySelector('e-index-table')!.getBoundingClientRect()
  for (const part of ['e-tabs', 'e-table']) {
    const box = document.querySelector(part)!.getBoundingClientRect()
    expect([Math.round(box.left), Math.round(box.right)]).toEqual([
      Math.round(card.left + 1),
      Math.round(card.right - 1),
    ])
  }
  // The chip keeps room for its remove button.
  expect(getComputedStyle(document.querySelector('[slot="filter"]')!, '::after').width).toBe('28px')
})

// Behaviour 2: on a phone the search field and Add filter share one row, the search taking the rest of
// it, and the chips and the sort wrap under them.
test.for(['en', 'bn'] as const)(
  'before the script at 360 px in %s the search field and Add filter share a row and nothing scrolls sideways',
  async (lang) => {
    await page.viewport(360, 800)
    mount(orders(lang))
    await document.fonts.ready
    expect(middle('e-index-table > e-button')).toBeCloseTo(middle('e-search-field'), 0)
    const search = document.querySelector('e-search-field')!.getBoundingClientRect()
    const add = document.querySelector('e-index-table > e-button')!.getBoundingClientRect()
    const card = document.querySelector('e-index-table')!
    const style = getComputedStyle(card)
    const end =
      card.getBoundingClientRect().right -
      Number.parseFloat(style.borderRightWidth) -
      Number.parseFloat(style.paddingRight)
    expect(add.left).toBeGreaterThan(search.right)
    expect(Math.round(end - add.right)).toBe(0)
    expect(style.paddingRight).toBe('16px')
    expect(top('e-select')).toBeGreaterThan(top('e-search-field'))
    expect(document.documentElement.scrollWidth).toBe(360)
  },
)

// Review 6.2: from 600 px the card pads 20 px, its toolbar controls are 32 px, the applied chip is a
// 32 px box at the toolbar's radius, and the pager sits in a surface-2 footer across the card's foot.
test('at 1440 px the toolbar controls and the chip are 32 px, and the pager is a surface-2 footer', async () => {
  await page.viewport(1440, 800)
  try {
    mount(orders())
    await document.fonts.ready
    const height = (selector: string) => Math.round(document.querySelector(selector)!.getBoundingClientRect().height)
    expect(['e-search-field', 'e-index-table > e-button', 'e-select', '[slot="filter"]'].map(height)).toEqual([
      32, 32, 32, 32,
    ])
    const chip = getComputedStyle(document.querySelector('[slot="filter"]')!)
    expect(chip.borderTopLeftRadius).toBe('8px')
    const card = document.querySelector('e-index-table')!
    expect(getComputedStyle(card).paddingLeft).toBe('20px')
    expect(Math.round(document.querySelector('e-search-field')!.getBoundingClientRect().left)).toBe(
      Math.round(card.getBoundingClientRect().left + 1 + 20),
    )
    const pager = document.querySelector('e-pagination')!
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--e-color-surface-2)'
    document.body.append(probe)
    expect(getComputedStyle(pager).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
    expect(getComputedStyle(pager).borderTopWidth).toBe('1px')
    // The footer runs edge to edge and closes the card.
    const box = pager.getBoundingClientRect()
    const outer = card.getBoundingClientRect()
    expect([Math.round(box.left), Math.round(box.right), Math.round(box.bottom)]).toEqual([
      Math.round(outer.left + 1),
      Math.round(outer.right - 1),
      Math.round(outer.bottom - 1),
    ])
  } finally {
    await page.viewport(360, 800)
  }
})

// Request 20's gaps, as review 6.2 draws them: with tabs and no toolbar the table starts under the tabs,
// with neither at the card's top edge, and a toolbar with no tabs keeps 12 px above it.
test.for([
  ['tabs and no toolbar', true, false],
  ['neither tabs nor toolbar', false, false],
  ['a toolbar and no tabs', false, true],
] as const)(
  'at 1440 px with %s the table or the toolbar starts where the boards draw it',
  async ([, tabs, toolbar]) => {
    await page.viewport(1440, 800)
    try {
      mount(`<e-index-table label="Orders">
      ${tabs ? '<e-tabs label="Views"><e-tab value="all" selected>All</e-tab></e-tabs>' : ''}
      ${toolbar ? '<e-search-field label="Search" placeholder="Search"></e-search-field>' : ''}
      <e-table label="Orders" style="--e-columns: 1fr 1fr"><e-row head><span>Order</span><span>Customer</span></e-row>${row(1042)}</e-table>
    </e-index-table>`)
      await document.fonts.ready
      const card = document.querySelector('e-index-table')!.getBoundingClientRect()
      const table = document.querySelector('e-table')!.getBoundingClientRect()
      if (toolbar) {
        const search = document.querySelector('e-search-field')!.getBoundingClientRect()
        expect(Math.round(search.top - card.top - 1)).toBe(12)
      } else if (tabs) {
        expect(Math.round(table.top)).toBe(Math.round(document.querySelector('e-tabs')!.getBoundingClientRect().bottom))
      } else {
        expect(Math.round(table.top)).toBe(Math.round(card.top + 1))
      }
    } finally {
      await page.viewport(360, 800)
    }
  },
)

test.for([
  [1280, 'en'],
  [1280, 'bn'],
  [360, 'en'],
  [360, 'bn'],
] as const)('at %i px in %s the script moves no e-* box by more than 1 px', async ([width, lang]) => {
  await page.viewport(width, 800)
  mount(orders(lang))
  await document.fonts.ready
  const found = tags()
  const before = boxes(found)
  define()
  await expect.poll(() => document.querySelector('[slot="filter"] > button')).not.toBeNull()
  await document.fonts.ready
  expect(moved(before, boxes(found))).toEqual([])
})

test('the card is a region named by its label, and the chip has a remove button named for it', async () => {
  define()
  mount(orders())
  await expect.element(page.getByRole('region', { name: 'Orders' })).toBeInTheDocument()
  await expect.element(page.getByRole('button', { name: 'Remove Date: Last 30 days' })).toBeInTheDocument()
})

test('in Bangla the remove button is named in Bangla, and it follows a switch of language', async () => {
  define()
  mount(orders('bn'))
  await expect.element(page.getByRole('button', { name: 'তারিখ: গত ৩০ দিন সরান' })).toBeInTheDocument()
  document.querySelector('div[lang]')!.setAttribute('lang', 'en')
  document.querySelector('[slot="filter"] > span')!.textContent = 'Date: Last 30 days'
  await expect.element(page.getByRole('button', { name: 'Remove Date: Last 30 days' })).toBeInTheDocument()
})

test('removing a chip takes it away, tells the page which filter, and puts focus in the search field', async () => {
  define()
  mount(orders())
  const removed: unknown[] = []
  document.addEventListener('e-filter-remove', (event) => removed.push((event as CustomEvent).detail), { once: true })
  await userEvent.click(page.getByRole('button', { name: 'Remove Date: Last 30 days' }))
  expect(removed).toEqual([{ name: 'date' }])
  expect(document.querySelector('[slot="filter"]')).toBeNull()
  expect(document.activeElement).toBe(document.querySelector('e-search-field > input'))
})

test('a chip the app adds later gets its button too', async () => {
  define()
  mount(orders())
  const chip = document.createElement('span')
  chip.slot = 'filter'
  chip.setAttribute('name', 'status')
  chip.innerHTML = '<span>Status: New</span>'
  document.querySelector('e-index-table > e-button')!.before(chip)
  await expect.element(page.getByRole('button', { name: 'Remove Status: New' })).toBeInTheDocument()
})

const selectable = (lang = 'en') => {
  const bn = lang === 'bn'
  const pick = (n: number) =>
    `<e-row><span><e-checkbox label="${bn ? `#${n} নির্বাচন করুন` : `Select #${n}`}" hide-label></e-checkbox></span><span><a href="/orders/${n}">#${n}</a></span><span align="end">৳1,930</span></e-row>`
  return `<div lang="${lang}" style="padding: 16px">
  <e-index-table label="Orders">
    <e-search-field label="Search orders" placeholder="Search orders"></e-search-field>
    <e-select label="Sort" hide-label><option value="newest" selected>Newest first</option></e-select>
    <div slot="bulk"><e-button>Confirm</e-button><e-button>Book courier</e-button><e-button>Print labels</e-button></div>
    <e-table label="Orders" style="--e-columns: 44px 1fr auto">
      <e-row head><span><e-checkbox label="Select all shown orders" hide-label></e-checkbox></span><span>Order</span><span align="end">Total</span></e-row>
      ${[1042, 1041, 1040, 1039].map(pick).join('')}
    </e-table>
  </e-index-table>
</div>`
}

const tick = (name: string) => userEvent.click(page.getByRole('checkbox', { name }))

test('before the script the bulk bar is hidden and the toolbar shows', async () => {
  await page.viewport(1280, 800)
  document.body.innerHTML = selectable()
  expect(getComputedStyle(document.querySelector('[slot="bulk"]')!).display).toBe('none')
  expect(getComputedStyle(document.querySelector('e-search-field')!).display).not.toBe('none')
})

test('ticking two rows shows "2 selected" and the actions where the search field was', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable()
  const search = document.querySelector('e-search-field')!.getBoundingClientRect()
  await tick('Select #1042')
  await tick('Select #1041')
  await expect.element(page.getByRole('status')).toHaveTextContent('2 selected')
  expect(getComputedStyle(document.querySelector('e-search-field')!).display).toBe('none')
  expect(getComputedStyle(document.querySelector('e-select')!).display).toBe('none')
  const bulk = document.querySelector('[slot="bulk"]')!.getBoundingClientRect()
  expect(Math.abs(bulk.top - search.top)).toBeLessThanOrEqual(1)
  for (const name of ['Confirm', 'Book courier', 'Print labels'])
    await expect.element(page.getByRole('button', { name })).toBeVisible()
  expect([...document.querySelectorAll('e-row[selected]')].map((row) => row.querySelector('a')!.textContent)).toEqual([
    '#1042',
    '#1041',
  ])
})

// From 600 px the row checkboxes always show; on a phone they wait for select mode, tested below.
test('the header checkbox reads mixed with some rows ticked, ticked with all, and ticks or clears them all', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable()
  const all = page.getByRole('checkbox', { name: 'Select all shown orders' })
  await tick('Select #1042')
  await tick('Select #1040')
  await expect.element(all).toHaveAttribute('aria-checked', 'mixed')
  await userEvent.click(all)
  await expect.element(page.getByRole('status')).toHaveTextContent('4 selected')
  await expect.element(all).not.toHaveAttribute('aria-checked')
  expect(document.querySelectorAll('e-row[selected]').length).toBe(4)
  await userEvent.click(all)
  expect(document.querySelectorAll('e-row[selected]').length).toBe(0)
  expect(document.querySelector('e-index-table')!.hasAttribute('selecting')).toBe(false)
})

test('unticking both rows brings back the search field', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable()
  await tick('Select #1042')
  await tick('Select #1041')
  await tick('Select #1042')
  await expect.element(page.getByRole('status')).toHaveTextContent('1 selected')
  await tick('Select #1041')
  expect(getComputedStyle(document.querySelector('e-search-field')!).display).not.toBe('none')
  expect(getComputedStyle(document.querySelector('[slot="bulk"]')!).display).toBe('none')
})

test('new rows from the app clear the selection, and the page hears each change of count', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable()
  const counts: number[] = []
  document.addEventListener('e-selection-change', (event) => counts.push((event as CustomEvent).detail.count))
  await tick('Select #1042')
  await tick('Select #1041')
  const table = document.querySelector('e-table')!
  for (const row of table.querySelectorAll('e-row:not([head])')) row.remove()
  await expect.poll(() => document.querySelector('e-index-table')!.hasAttribute('selecting')).toBe(false)
  expect(counts).toEqual([1, 2, 0])
})

test('in Bangla the count reads ২টি নির্বাচিত, and it follows a switch of language', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable('bn')
  await tick('#1042 নির্বাচন করুন')
  await tick('#1041 নির্বাচন করুন')
  await expect.element(page.getByRole('status')).toHaveTextContent('২টি নির্বাচিত')
  const root = document.documentElement
  const was = root.lang
  try {
    document.querySelector('div[lang]')!.removeAttribute('lang')
    root.lang = 'en'
    await expect.element(page.getByRole('status')).toHaveTextContent('2 selected')
  } finally {
    root.lang = was
  }
})

const searchable = `<e-index-table label="Orders">
  <e-search-field label="Search orders" placeholder="Search orders"></e-search-field>
  <e-table label="Orders" style="--e-columns: 1fr auto">
    <e-row head><span>Order</span><span align="end">Total</span></e-row>
    ${[1042, 1041].map((n) => `<e-row><span><a href="/orders/${n}">#${n}</a></span><span align="end">৳1,930</span></e-row>`).join('')}
  </e-table>
  <e-empty-state heading="No orders match"><p>Try another word.</p><e-button slot="action">Clear search</e-button></e-empty-state>
  <e-pagination label="1–2 of 2"></e-pagination>
</e-index-table>`

const shown = (selector: string) => getComputedStyle(document.querySelector(selector)!).display !== 'none'

test('before the script, a table with rows hides the empty state and shows the pager', () => {
  document.body.innerHTML = searchable
  expect([shown('e-empty-state'), shown('e-table'), shown('e-pagination')]).toEqual([false, true, true])
})

test('with no rows the empty state shows in the table’s place and the pager hides; rows bring them back', async () => {
  define()
  document.body.innerHTML = searchable
  const table = document.querySelector('e-table')!
  const rows = [...table.querySelectorAll('e-row:not([head])')]
  for (const row of rows) row.remove()
  await expect.element(page.getByRole('heading', { name: 'No orders match' })).toBeVisible()
  expect([shown('e-empty-state'), shown('e-table'), shown('e-pagination')]).toEqual([true, false, false])
  await expect.element(page.getByRole('button', { name: 'Clear search' })).toBeVisible()
  table.append(...rows)
  await expect
    .poll(() => [shown('e-empty-state'), shown('e-table'), shown('e-pagination')])
    .toEqual([false, true, true])
})

const cards = `<e-index-table label="Orders">
  <e-table label="Orders" style="--e-columns: 44px 80px 1fr auto auto">
    <e-row head><span><e-checkbox label="Select all" hide-label></e-checkbox></span><span>Order</span><span>Customer</span><span>Channel</span><span align="end">Total</span></e-row>
    <e-row><span><e-checkbox label="Select #1042" hide-label></e-checkbox></span><span card="title"><a href="#1042">#1042</a></span><span card="body">Rahima Akter</span><span>Facebook</span><span align="end" card="end">৳1,930</span></e-row>
  </e-table>
</e-index-table>`

test.for([
  [599, 'grid'],
  [600, 'contents'],
] as const)('at %i px a row is drawn as %s, by the CSS alone', async ([width, display]) => {
  await page.viewport(width, 800)
  document.body.innerHTML = cards
  const row = document.querySelector('e-row:not([head])')!
  expect(getComputedStyle(row).display).toBe(display)
  // A card leaves out the head row and the cells it does not place, such as the channel.
  expect(document.querySelector('e-row[head] > span')!.checkVisibility()).toBe(width >= 600)
  expect(row.children[3]!.checkVisibility()).toBe(width >= 600)
  if (width < 600) {
    // The order's link covers the card.
    const cover = getComputedStyle(row.querySelector('a')!, '::after')
    expect([cover.position, cover.content]).toEqual(['absolute', '""'])
  }
})

// The Orders phone board: flat rows edge to edge, the number and the amount on line 1 at 15/600, the
// name and the status on line 2, payment and time on line 3, and no checkbox until select mode.
const flat = (lang = 'en') => {
  const bn = lang === 'bn'
  const one = (n: number) => `<e-row>
    <span><e-checkbox label="Select #${n}" hide-label></e-checkbox></span>
    <span card="title"><a href="#${n}">#${n}</a></span>
    <span card="aside">${bn ? 'আজ ১১:২৪' : 'Today 11:24'}</span>
    <span card="body">${bn ? 'রহিমা আক্তার' : 'Rahima Akter'}</span>
    <span>Facebook</span>
    <span card="meta">${bn ? 'ক্যাশ অন ডেলিভারি' : 'Cash on delivery'}</span>
    <span card="status"><e-badge tone="new">${bn ? 'নতুন' : 'New'}</e-badge></span>
    <span align="end" card="end">${bn ? '৳১,৯৩০' : '৳1,930'}</span>
  </e-row>`
  return `<div lang="${lang}" style="padding: 16px">
  <e-index-table label="Orders">
    <e-search-field label="Search orders" placeholder="Search orders"></e-search-field>
    <e-button>Add filter</e-button>
    <div slot="bulk"><e-button>Confirm</e-button></div>
    <e-table label="Orders" style="--e-columns: 44px 80px 80px 1fr 1fr 1fr auto auto">
      <e-row head><span><e-checkbox label="Select all shown orders" hide-label></e-checkbox></span><span>Order</span><span>Date</span><span>Customer</span><span>Channel</span><span>Payment</span><span>Status</span><span align="end">Total</span></e-row>
      ${[1042, 1041, 1040].map(one).join('')}
    </e-table>
    <e-pagination label="1–3 of 3"></e-pagination>
  </e-index-table>
</div>`
}

test.for(['en', 'bn'] as const)(
  'at 360 px in %s the rows are flat and edge to edge, three lines each, with no checkbox',
  async (lang) => {
    await page.viewport(360, 800)
    define()
    defineCheckbox()
    mount(flat(lang))
    await expect.poll(() => document.querySelector('e-row:not([head]) e-checkbox > input')).not.toBeNull()
    await document.fonts.ready
    const row = document.querySelector('e-row:not([head])')!
    const at = (card: string) => row.querySelector(`[card="${card}"]`)!.getBoundingClientRect()
    const [title, end, body, status, meta, aside] = ['title', 'end', 'body', 'status', 'meta', 'aside'].map(at)
    // Line 1: the number, and the amount at the end; line 2: name and status; line 3: payment and time.
    expect(Math.abs(title!.top - end!.top)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(middle('e-row:not([head]) [card="body"]') - middle('e-row:not([head]) [card="status"]')),
    ).toBeLessThanOrEqual(2)
    expect(Math.abs(meta!.top - aside!.top)).toBeLessThanOrEqual(2)
    expect(body!.top).toBeGreaterThanOrEqual(title!.bottom - 1)
    expect(meta!.top).toBeGreaterThanOrEqual(Math.max(body!.bottom, status!.bottom) - 1)
    const box = row.getBoundingClientRect()
    for (const right of [end!, status!, aside!]) expect(Math.round(box.right - 16 - right.right)).toBe(0)
    for (const left of [title!, body!, meta!]) expect(Math.round(left.left - box.left - 16)).toBe(0)
    for (const card of ['title', 'end']) {
      const style = getComputedStyle(row.querySelector(`[card="${card}"]`)!)
      expect([style.fontSize, style.fontWeight]).toEqual(['15px', '600'])
    }
    expect(getComputedStyle(row.querySelector('[card="body"]')!).fontSize).toBe('14px')
    // Flat: a line under each row and nothing else, and the rows span the card edge to edge.
    const style = getComputedStyle(row)
    expect([style.borderTopWidth, style.borderLeftWidth, style.borderBottomWidth, style.borderTopLeftRadius]).toEqual([
      '0px',
      '0px',
      '1px',
      '0px',
    ])
    expect([style.paddingTop, style.paddingLeft]).toEqual(['12px', '16px'])
    const card = document.querySelector('e-index-table')!.getBoundingClientRect()
    expect([Math.round(box.left), Math.round(box.right)]).toEqual([
      Math.round(card.left + 1),
      Math.round(card.right - 1),
    ])
    const next = document.querySelectorAll('e-row:not([head])')[1]!.getBoundingClientRect()
    expect(Math.round(next.top)).toBe(Math.round(box.bottom))
    // No checkbox shows outside select mode: not the head's, the three rows' or the built select-all.
    expect([...document.querySelectorAll('e-checkbox')].map((one) => one.checkVisibility())).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
    expect(document.documentElement.scrollWidth).toBe(360)
  },
)

// The Admin Orders list board: in the 608 px the Admin frame leaves of a 780 px phone window, under the
// six view tabs and a toolbar of search and Add filter, five orders show whole.
const fold = (lang: 'en' | 'bn') => {
  const bn = lang === 'bn'
  const tabs = (
    bn
      ? ['সব', 'নতুন', 'কনফার্মড', 'কুরিয়ারে', 'ডেলিভারি হয়েছে', 'ফেরত এসেছে']
      : ['All', 'New', 'Confirmed', 'With courier', 'Delivered', 'Returned']
  )
    .map((name, i) => `<e-tab value="${i}" count="12"${i ? '' : ' selected'}>${name}</e-tab>`)
    .join('')
  // Rows with checkboxes and a bulk bar, as the sample's: the kit's Select joins the search's line.
  const one = (n: number) => `<e-row>
    <span><e-checkbox label="Select #${n}" hide-label></e-checkbox></span>
    <span card="title"><a href="#${n}">#${n}</a></span>
    <span card="aside">${bn ? 'আজ ১০:৪৮' : 'Today 10:48'}</span>
    <span card="body">${bn ? 'সুমাইয়া ইসলাম' : 'Sumaiya Islam'}</span>
    <span>Instagram</span>
    <span card="meta">${bn ? 'বিকাশ · পরিশোধিত' : 'bKash · Paid'}</span>
    <span card="status"><e-badge tone="delivered">${bn ? 'ডেলিভারি হয়েছে' : 'Delivered'}</e-badge></span>
    <span align="end">2 items</span>
    <span align="end" card="end">${bn ? '৳১২,৫০০' : '৳12,500'}</span>
  </e-row>`
  return `<div lang="${lang}" style="padding: 16px">
  <e-index-table label="Orders">
    <e-tabs label="Order views">${tabs}<e-button tone="plain" aria-label="Add view"><e-icon name="plus"></e-icon></e-button></e-tabs>
    <e-search-field label="Search orders" placeholder="${bn ? 'অর্ডার খুঁজুন' : 'Search orders'}"></e-search-field>
    <e-button><e-icon name="filter"></e-icon>${bn ? 'ফিল্টার যোগ করুন' : 'Add filter'}</e-button>
    <div slot="bulk"><e-button>${bn ? 'কনফার্ম করুন' : 'Confirm'}</e-button></div>
    <e-table label="Orders">
      <e-row head><span><e-checkbox label="Select all shown orders" hide-label></e-checkbox></span><span>Order</span><span>Date</span><span>Customer</span><span>Channel</span><span>Payment</span><span>Status</span><span>Items</span><span>Total</span></e-row>
      ${[1042, 1041, 1040, 1039, 1038, 1037, 1036, 1035, 1034, 1033].map(one).join('')}
    </e-table>
    <e-pagination label="1–10 of 120" has-next></e-pagination>
  </e-index-table>
</div>`
}

test.for(['en', 'bn'] as const)(
  'at 360 x 608 in %s five rows show whole under the tabs and the toolbar, Select on the search line',
  async (lang) => {
    await page.viewport(360, 608)
    const margin = document.body.style.margin
    try {
      document.body.style.margin = '0'
      define()
      defineCheckbox()
      mount(fold(lang))
      await expect.poll(() => document.querySelector('e-index-table > [data-select] > button')).not.toBeNull()
      await document.fonts.ready
      expect(Math.round(document.querySelector('e-index-table')!.getBoundingClientRect().top)).toBe(16)
      // Select is a 44 px icon button on the search's line, so it adds no line of its own.
      const select = document.querySelector('[data-select]')!.getBoundingClientRect()
      const search = document.querySelector('e-search-field')!.getBoundingClientRect()
      expect(Math.abs(select.top - search.top)).toBeLessThanOrEqual(1)
      expect(Math.round(select.width)).toBe(44)
      // Add filter shows its icon alone, a 44 px square, and still names itself.
      const add = document.querySelector('e-index-table > e-button:not([data-select])')!
      expect(Math.round(add.getBoundingClientRect().width)).toBe(44)
      expect(add.querySelector('button')!.textContent).toBe(lang === 'bn' ? 'ফিল্টার যোগ করুন' : 'Add filter')
      expect(search.width).toBeGreaterThanOrEqual(150)
      const fifth = document.querySelectorAll('e-row:not([head])')[4]!.getBoundingClientRect()
      expect(fifth.bottom).toBeLessThanOrEqual(608)
    } finally {
      document.body.style.margin = margin
      await page.viewport(360, 800)
    }
  },
)

// Request 19: an Inventory row's four quantities sit on a fourth line, in one row of four, each value
// under its label, with no boxes. From 600 px the table shows them in its own columns.
const stock = (lang = 'en') => {
  const bn = lang === 'bn'
  const labels = bn ? ['হাতে আছে', 'বুক করা', 'পাওয়া যাবে', 'আসছে'] : ['On hand', 'Committed', 'Available', 'Incoming']
  const values = bn ? ['২৪', '৬', '১৮', '৪০'] : ['24', '6', '18', '40']
  const figures = labels.map((label, i) => `<div><dt>${label}</dt><dd>${values[i]}</dd></div>`).join('')
  return `<div lang="${lang}" style="padding: 16px">
  <e-index-table label="Inventory">
    <e-table label="Inventory" style="--e-columns: 1fr auto">
      <e-row head><span>Product</span><span align="end">Price</span></e-row>
      <e-row>
        <span card="title"><a href="#tee">${bn ? 'সুতির টি-শার্ট' : 'Cotton tee'}</a></span>
        <span card="body">${bn ? 'কালো, এম' : 'Black, M'}</span>
        <span align="end" card="end">৳650</span>
        <span card="figures"><dl>${figures}</dl></span>
      </e-row>
    </e-table>
  </e-index-table>
</div>`
}

test.for(['en', 'bn'] as const)(
  'at 360 px in %s a figures cell is a fourth line of four quantities, each value under its label',
  async (lang) => {
    await page.viewport(360, 800)
    mount(stock(lang))
    await document.fonts.ready
    const row = document.querySelector('e-row:not([head])')!.getBoundingClientRect()
    const body = document.querySelector('[card="body"]')!.getBoundingClientRect()
    const cell = document.querySelector('[card="figures"]')!.getBoundingClientRect()
    expect(cell.top).toBeGreaterThanOrEqual(body.bottom)
    expect([Math.round(cell.left - row.left), Math.round(row.right - cell.right)]).toEqual([16, 16])
    const pairs = [...document.querySelectorAll('[card="figures"] dl > div')]
    expect(pairs.length).toBe(4)
    const boxes = pairs.map((pair) => pair.getBoundingClientRect())
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1)
    for (let i = 1; i < 4; i++) expect(boxes[i]!.left).toBeGreaterThanOrEqual(boxes[i - 1]!.right)
    for (const pair of pairs) {
      const label = pair.querySelector('dt')!.getBoundingClientRect()
      const value = pair.querySelector('dd')!.getBoundingClientRect()
      expect(value.top).toBeGreaterThanOrEqual(label.bottom - 1)
      expect(Math.round(value.left)).toBe(Math.round(label.left))
      const style = getComputedStyle(pair)
      expect([style.borderTopWidth, style.paddingTop, style.backgroundColor]).toEqual([
        '0px',
        '0px',
        'rgba(0, 0, 0, 0)',
      ])
    }
    const dt = getComputedStyle(document.querySelector('[card="figures"] dt')!)
    const dd = getComputedStyle(document.querySelector('[card="figures"] dd')!)
    // Bangla's meta line is 20 px, as the kit's type sets it for every Bangla label.
    expect([dt.fontSize, dt.lineHeight, dd.fontWeight, dd.fontVariantNumeric, dd.marginLeft]).toEqual([
      '13px',
      lang === 'bn' ? '20px' : '18px',
      '550',
      'tabular-nums',
      '0px',
    ])
    expect(document.documentElement.scrollWidth).toBe(360)
  },
)

test('at 600 px a figures cell is hidden, the table showing those numbers in its own columns', async () => {
  await page.viewport(600, 800)
  try {
    mount(stock())
    expect(document.querySelector('[card="figures"]')!.checkVisibility()).toBe(false)
    expect(document.querySelector('[card="title"]')!.checkVisibility()).toBe(true)
  } finally {
    await page.viewport(360, 800)
  }
})

// A row with no figures cell has no fourth line, so it adds no gap under its third.
test('at 360 px a row without figures ends 12 px under its third line', async () => {
  await page.viewport(360, 800)
  mount(flat())
  await document.fonts.ready
  const row = document.querySelector('e-row:not([head])')!
  const last = Math.max(
    ...['meta', 'aside'].map((card) => row.querySelector(`[card="${card}"]`)!.getBoundingClientRect().bottom),
  )
  expect(Math.round(row.getBoundingClientRect().bottom - 1 - last)).toBe(12)
})

// Select mode: on a phone no checkbox shows until a Select button, which the kit builds, or a long
// press starts it. Then every row shows its checkbox, and the bulk bar offers select-all and Done.
const rowBoxes = () => [...document.querySelectorAll<HTMLElement>('e-row:not([head]) e-checkbox')]
const shownBoxes = () => rowBoxes().map((box) => box.checkVisibility())
const checked = () => rowBoxes().map((box) => (box.querySelector('input') as HTMLInputElement).checked)

async function phoneList(lang = 'en') {
  await page.viewport(360, 800)
  define()
  defineCheckbox()
  mount(flat(lang))
  await expect.poll(() => document.querySelector('e-row:not([head]) e-checkbox > input')).not.toBeNull()
  return document.querySelector<EIndexTable>('e-index-table')!
}

test('at 360 px Select shows every row checkbox, a select-all and Done in the bulk bar', async () => {
  const index = await phoneList()
  expect(shownBoxes()).toEqual([false, false, false])
  const inRow = () =>
    document.querySelector('e-row:not([head]) [card="title"]')!.getBoundingClientRect().top -
    document.querySelector('e-row:not([head])')!.getBoundingClientRect().top
  const title = inRow()
  await userEvent.click(page.getByRole('button', { name: 'Select', exact: true }))
  expect(index.hasAttribute('select-mode')).toBe(true)
  expect(index.selectMode).toBe(true)
  expect(shownBoxes()).toEqual([true, true, true])
  await expect.element(page.getByRole('checkbox', { name: 'Select all', exact: true })).toBeVisible()
  await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible()
  expect(document.querySelector('e-search-field')!.checkVisibility()).toBe(false)
  // The checkbox stands at the row's start; the number keeps its first line, beside the amount.
  const row = document.querySelector('e-row:not([head])')!
  const box = row.querySelector('e-checkbox')!.getBoundingClientRect()
  const moved = row.querySelector('[card="title"]')!.getBoundingClientRect()
  const end = row.querySelector('[card="end"]')!.getBoundingClientRect()
  expect(box.right).toBeLessThanOrEqual(moved.left)
  expect(Math.round(inRow())).toBe(Math.round(title))
  expect(Math.abs(moved.top - end.top)).toBeLessThanOrEqual(1)
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('at 360 px in select mode ticking two shows "2 selected", and select-all ticks, mixes and clears', async () => {
  await phoneList()
  await userEvent.click(page.getByRole('button', { name: 'Select', exact: true }))
  await tick('Select #1042')
  await tick('Select #1041')
  await expect.element(page.getByRole('status')).toHaveTextContent('2 selected')
  const all = page.getByRole('checkbox', { name: 'Select all', exact: true })
  await expect.element(all).toHaveAttribute('aria-checked', 'mixed')
  await userEvent.click(all)
  expect(checked()).toEqual([true, true, true])
  await expect.element(page.getByRole('status')).toHaveTextContent('3 selected')
  await userEvent.click(all)
  expect(checked()).toEqual([false, false, false])
  // Still in select mode with none ticked: the bar stays, the toolbar stays hidden.
  expect(document.querySelector('[slot="bulk"]')!.checkVisibility()).toBe(true)
  expect(document.querySelector('e-search-field')!.checkVisibility()).toBe(false)
})

test('at 360 px Done unticks every row, hides the checkboxes and tells the page the count is 0', async () => {
  const index = await phoneList()
  const counts: number[] = []
  index.addEventListener('e-selection-change', (event) => counts.push((event as CustomEvent).detail.count))
  await userEvent.click(page.getByRole('button', { name: 'Select', exact: true }))
  await tick('Select #1042')
  await tick('Select #1040')
  await userEvent.click(page.getByRole('button', { name: 'Done' }))
  expect(index.hasAttribute('select-mode')).toBe(false)
  expect(checked()).toEqual([false, false, false])
  expect(shownBoxes()).toEqual([false, false, false])
  expect(document.querySelectorAll('e-row[selected]').length).toBe(0)
  expect(index.hasAttribute('selecting')).toBe(false)
  expect(counts).toEqual([1, 2, 0])
  expect(document.querySelector('[slot="bulk"]')!.checkVisibility()).toBe(false)
  expect(document.querySelector('e-search-field')!.checkVisibility()).toBe(true)
})

test('removing select-mode, as an app may, leaves select mode the same way', async () => {
  const index = await phoneList()
  index.selectMode = true
  await tick('Select #1041')
  index.removeAttribute('select-mode')
  expect(checked()).toEqual([false, false, false])
  expect(shownBoxes()).toEqual([false, false, false])
})

test('in select mode new rows from the app clear the selection and show their checkboxes', async () => {
  const index = await phoneList()
  index.selectMode = true
  await tick('Select #1042')
  const table = document.querySelector('e-table')!
  const fresh = document.querySelector('e-row:not([head])')!.cloneNode(true) as Element
  for (const row of table.querySelectorAll('e-row:not([head])')) row.remove()
  table.append(fresh)
  await expect.poll(() => index.hasAttribute('selecting')).toBe(false)
  expect(shownBoxes()).toEqual([true])
})

// A long press, held 500 ms without moving, starts select mode and ticks that row, and does not open it.
const press = (target: Element, moveBy = 0) => {
  const { left, top } = target.getBoundingClientRect()
  const at = { clientX: left + 4, clientY: top + 4, bubbles: true, pointerId: 1, isPrimary: true }
  target.dispatchEvent(new PointerEvent('pointerdown', at))
  if (moveBy) target.dispatchEvent(new PointerEvent('pointermove', { ...at, clientX: at.clientX + moveBy }))
  return new Promise<void>((done) => {
    setTimeout(() => {
      target.dispatchEvent(new PointerEvent('pointerup', at))
      done()
    }, 600)
  })
}

test('at 360 px a long press on a row starts select mode, ticks that row and does not open it', async () => {
  const index = await phoneList()
  const link = document.querySelectorAll('e-row:not([head]) a')[1]!
  await press(link)
  expect(index.hasAttribute('select-mode')).toBe(true)
  expect(checked()).toEqual([false, true, false])
  const click = new MouseEvent('click', { bubbles: true, cancelable: true })
  link.dispatchEvent(click)
  expect(click.defaultPrevented).toBe(true)
  expect(checked()).toEqual([false, true, false])
  // The list is in select mode now, so the next tap on that row ticks it off rather than opening it.
  const next = new MouseEvent('click', { bubbles: true, cancelable: true })
  link.dispatchEvent(next)
  expect(next.defaultPrevented).toBe(true)
  expect(checked()).toEqual([false, false, false])
})

test('at 360 px in select mode a tap on a row ticks it and does not open the order', async () => {
  await phoneList()
  await userEvent.click(page.getByRole('button', { name: 'Select', exact: true }))
  const opened: string[] = []
  const done = new AbortController()
  document.addEventListener(
    'click',
    (event) => {
      if (!event.defaultPrevented && (event.target as Element).closest('a')) opened.push('opened')
      event.preventDefault()
    },
    { signal: done.signal },
  )
  await userEvent.click(page.getByRole('link', { name: '#1041' }))
  expect(checked()).toEqual([false, true, false])
  await expect.element(page.getByRole('status')).toHaveTextContent('1 selected')
  await userEvent.click(page.getByRole('link', { name: '#1041' }))
  expect(checked()).toEqual([false, false, false])
  done.abort()
  expect(opened).toEqual([])
})

// A phone turned on its side is wider than 600 px: rows ticked there are a selection to leave once it
// turns back, so ticking any row puts the list in select mode.
test('rows ticked at 780 px stay leavable at 360 px: Done shows and clears them', async () => {
  try {
    await page.viewport(780, 360)
    define()
    defineCheckbox()
    mount(flat())
    await expect.poll(() => document.querySelector('e-row:not([head]) e-checkbox > input')).not.toBeNull()
    await tick('Select #1042')
    await tick('Select #1041')
    await page.viewport(360, 780)
    expect(shownBoxes()).toEqual([true, true, true])
    await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible()
    await userEvent.click(page.getByRole('button', { name: 'Done' }))
    expect(checked()).toEqual([false, false, false])
    expect(shownBoxes()).toEqual([false, false, false])
  } finally {
    await page.viewport(360, 800)
  }
})

// The CSS keeps Select's room only where the script will build it: for rows with checkboxes, not for
// a head checkbox over a list a filter emptied.
test('at 360 px a list with no rows keeps no room for a Select that never comes', async () => {
  await page.viewport(360, 800)
  define()
  defineCheckbox()
  document.body.innerHTML = selectable().replaceAll(/<e-row>.*?<\/e-row>/g, '')
  await expect.poll(() => document.querySelector('e-row[head] e-checkbox > input')).not.toBeNull()
  expect(document.querySelector('[data-select]')).toBeNull()
  expect(getComputedStyle(document.querySelector('e-search-field')!).marginInlineEnd).toBe('0px')
})

test('without a bulk bar there is no Select and no long press, as nothing could leave select mode', async () => {
  await page.viewport(360, 800)
  define()
  defineCheckbox()
  mount(cards)
  await expect.poll(() => document.querySelector('e-row:not([head]) e-checkbox > input')).not.toBeNull()
  const index = document.querySelector('e-index-table')!
  await press(index.querySelector('e-row:not([head]) a')!)
  expect(index.hasAttribute('select-mode')).toBe(false)
  expect(index.querySelector('[data-select]')).toBeNull()
})

test('at 360 px a press that moves 20 px is a scroll, not a long press', async () => {
  const index = await phoneList()
  await press(document.querySelector('e-row:not([head]) a')!, 20)
  expect(index.hasAttribute('select-mode')).toBe(false)
  expect(checked()).toEqual([false, false, false])
})

test('at 1280 px the row checkboxes show as before, and Select, select-all and Done stay hidden', async () => {
  await page.viewport(1280, 800)
  define()
  defineCheckbox()
  mount(flat())
  await expect.poll(() => document.querySelector('e-index-table > e-button[data-select]')).not.toBeNull()
  expect(shownBoxes()).toEqual([true, true, true])
  for (const built of [
    'e-index-table > e-button[data-select]',
    '[slot="bulk"] > [data-select-all]',
    '[slot="bulk"] > [data-done]',
  ])
    expect(document.querySelector(built)!.checkVisibility()).toBe(false)
})

test('in Bangla the built words read Bangla, and they follow a switch of language', async () => {
  await phoneList('bn')
  await expect.element(page.getByRole('button', { name: 'নির্বাচন করুন', exact: true })).toBeVisible()
  await userEvent.click(page.getByRole('button', { name: 'নির্বাচন করুন', exact: true }))
  await expect.element(page.getByRole('checkbox', { name: 'সব নির্বাচন করুন' })).toBeVisible()
  await expect.element(page.getByRole('button', { name: 'শেষ' })).toBeVisible()
  const root = document.documentElement
  const was = root.lang
  try {
    document.querySelector('div[lang]')!.removeAttribute('lang')
    root.lang = 'en'
    await expect.element(page.getByRole('button', { name: 'Done' })).toBeVisible()
    await expect.element(page.getByRole('checkbox', { name: 'Select all', exact: true })).toBeVisible()
  } finally {
    root.lang = was
  }
})

test('an e-list draws flat rows in one column, split by a hairline', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = '<e-list><div>Rahima Akter</div><div>Tanvir Hasan</div><div>Nusrat Jahan</div></e-list>'
  const rows = [...document.querySelectorAll('e-list > div')]
  const [one, two] = rows.map((row) => row.getBoundingClientRect())
  expect(one!.left).toBe(two!.left)
  expect(two!.top).toBe(one!.bottom)
  const [first, second, third] = rows.map((row) => getComputedStyle(row))
  for (const style of [first!, second!, third!]) {
    expect([style.borderLeftWidth, style.borderRightWidth, style.borderBottomWidth]).toEqual(['0px', '0px', '0px'])
    expect(style.borderTopLeftRadius).toBe('0px')
  }
  // The line is between rows, so the first has none above it.
  expect(first!.borderTopWidth).toBe('0px')
  const probe = document.createElement('i')
  probe.style.color = 'var(--e-color-line)'
  document.body.append(probe)
  for (const style of [second!, third!]) {
    expect(style.borderTopWidth).toBe('1px')
    expect(style.borderTopColor).toBe(getComputedStyle(probe).color)
  }
})

test('a new label, as a switch of language sets, renames the region', async () => {
  define()
  mount(orders())
  document.querySelector('e-index-table')!.setAttribute('label', 'অর্ডার')
  await expect.element(page.getByRole('region', { name: 'অর্ডার' })).toBeInTheDocument()
})

// The generic row hover and selected tints are e-table's; the index table keeps its own row look.
test('a hovered row in the index table: on a phone the cells stay clear, at 1280 a ticked row stays accent-soft', async () => {
  const ticked = () => {
    mount(orders())
    const row = document.querySelectorAll('e-row:not([head])')[0]!
    row.setAttribute('selected', '')
    return row as HTMLElement
  }
  const backs = (row: Element) => [...row.children].map((cell) => getComputedStyle(cell).backgroundColor)
  try {
    await page.viewport(360, 800)
    let row = ticked()
    await page.elementLocator(row).hover()
    expect(backs(row)).toEqual(backs(row).map(() => 'rgba(0, 0, 0, 0)'))
    await page.viewport(1280, 800)
    row = ticked()
    const p = document.createElement('div')
    p.style.backgroundColor = 'var(--e-color-accent-soft)'
    document.body.append(p)
    const soft = getComputedStyle(p).backgroundColor
    p.remove()
    expect(backs(row)).toEqual(backs(row).map(() => soft))
    await page.elementLocator(row).hover()
    expect(backs(row)).toEqual(backs(row).map(() => soft))
  } finally {
    await page.viewport(360, 800)
  }
})
