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
import { defineIndexTable } from '../../src/v2/index-table.ts'
import { definePagination } from '../../src/v2/pagination.ts'
import { defineSelect } from '../../src/v2/select.ts'
import { defineTable } from '../../src/v2/table.ts'
import { defineTabs } from '../../src/v2/tabs.ts'

afterEach(() => {
  document.body.replaceChildren()
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
    <span slot="filter" name="date"><span>${lang === 'bn' ? 'তারিখ: গত ৩০ দিন' : 'Date: Last 30 days'}</span></span>
    <e-button>Add filter</e-button>
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

// The tests above the first define() run before any test defines the tags, so they see the CSS alone.
test('before the script at 1280 px the tabs, then one toolbar line, then the table and the pager', async () => {
  await page.viewport(1280, 800)
  mount(orders())
  await document.fonts.ready
  const toolbar = ['e-search-field', '[slot="filter"]', 'e-button', 'e-select'].map(top)
  // One line: the controls are 36 px tall and centred on it.
  expect(Math.max(...toolbar) - Math.min(...toolbar)).toBeLessThanOrEqual(1)
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

test('before the script at 360 px the search field takes its own line and nothing scrolls sideways', async () => {
  await page.viewport(360, 800)
  mount(orders())
  await document.fonts.ready
  expect(top('[slot="filter"]')).toBeGreaterThan(top('e-search-field'))
  const search = document.querySelector('e-search-field')!.getBoundingClientRect()
  const card = document.querySelector('e-index-table')!.getBoundingClientRect()
  expect(Math.round(search.width)).toBe(Math.round(card.width - 2 - 24))
  expect(document.documentElement.scrollWidth).toBe(360)
})

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

test('the header checkbox reads mixed with some rows ticked, ticked with all, and ticks or clears them all', async () => {
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

test('an e-list draws each child as a card in one column', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = '<e-list><div>Rahima Akter</div><div>Tanvir Hasan</div></e-list>'
  const [one, two] = [...document.querySelectorAll('e-list > div')].map((card) => card.getBoundingClientRect())
  expect(one!.left).toBe(two!.left)
  expect(two!.top).toBeGreaterThanOrEqual(one!.bottom + 8)
  expect(getComputedStyle(document.querySelector('e-list > div')!).borderTopLeftRadius).toBe('10px')
})

test('a new label, as a switch of language sets, renames the region', async () => {
  define()
  mount(orders())
  document.querySelector('e-index-table')!.setAttribute('label', 'অর্ডার')
  await expect.element(page.getByRole('region', { name: 'অর্ডার' })).toBeInTheDocument()
})
