import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

const five = `
  <eb-tab value="all" count="6">All</eb-tab>
  <eb-tab value="new" count="2">New</eb-tab>
  <eb-tab value="confirmed" count="1">Confirmed</eb-tab>
  <eb-tab value="courier" count="1">With courier</eb-tab>
  <eb-tab value="returned" count="1">Returned</eb-tab>`

async function mount(lang: 'bn' | 'en' = 'en', value = 'all') {
  document.body.innerHTML = `<div lang="${lang}"><button id="before">Before</button><eb-tabs label="Orders by status" value="${value}">${five}</eb-tabs></div>`
  const tabs = document.querySelector('eb-tabs')!
  await tabs.updateComplete
  const items = [...document.querySelectorAll('eb-tab')]
  await Promise.all(items.map((tab) => tab.updateComplete))
  return { tabs, items }
}

// Records each eb-change the tabs fire, as the value it carries.
function listen(tabs: Element): string[] {
  const heard: string[] = []
  tabs.addEventListener('eb-change', (event) => heard.push((event as CustomEvent<{ value: string }>).detail.value))
  return heard
}

// What a token resolves to on the page, so a test compares computed colours with computed colours.
function token(name: string): string {
  const probe = document.body.appendChild(document.createElement('i'))
  probe.style.color = `var(${name})`
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

const countOf = (tab: Element) => tab.shadowRoot!.querySelector('.count')!

test('the host is a tablist named by its label, with a tab per eb-tab and one selected', async () => {
  await mount()
  await expect.element(page.getByRole('tablist', { name: 'Orders by status' })).toBeVisible()
  const tabs = page.getByRole('tab').elements()
  expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false'])
  expect(tabs.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
  expect(tabs[0]!.hasAttribute('selected')).toBe(true)
  expect(tabs[1]!.hasAttribute('selected')).toBe(false)
})

test('the selected tab is text with a 2 px text underline, the others quieter, the count quietest, in light and dark', async () => {
  const look = async () => {
    const { items } = await mount()
    const [selected, other] = items.map((tab) => getComputedStyle(tab)) as [CSSStyleDeclaration, CSSStyleDeclaration]
    return {
      selected: selected.color,
      underline: [selected.borderBottomWidth, selected.borderBottomStyle, selected.borderBottomColor],
      other: other.color,
      count: getComputedStyle(countOf(items[0]!)).color,
      numbers: getComputedStyle(countOf(items[0]!)).fontVariantNumeric,
      expected: {
        text: token('--eb-color-text'),
        text2: token('--eb-color-text-2'),
        text3: token('--eb-color-text-3'),
      },
    }
  }
  for (const mode of [await look(), await inDark(look)]) {
    expect(mode.selected).toBe(mode.expected.text)
    expect(mode.underline).toEqual(['2px', 'solid', mode.expected.text])
    expect(mode.other).toBe(mode.expected.text2)
    expect(mode.count).toBe(mode.expected.text3)
    expect(mode.numbers).toBe('tabular-nums')
  }
})

test('the unselected tab turns to text on hover', async () => {
  const { items } = await mount()
  await userEvent.hover(items[1]!)
  expect(getComputedStyle(items[1]!).color).toBe(token('--eb-color-text'))
})

test('the arrow keys move focus and wrap, Home and End jump, and none of them select', async () => {
  const { tabs, items } = await mount()
  const heard = listen(tabs)
  items[4]!.focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(items[0])
  await userEvent.keyboard('{ArrowLeft}')
  expect(document.activeElement).toBe(items[4])
  await userEvent.keyboard('{Home}')
  expect(document.activeElement).toBe(items[0])
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(items[4])
  expect(heard).toEqual([])
  expect(tabs.value).toBe('all')
})

test.for(['{Enter}', ' '])('pressing %j on the focused tab selects it and fires one eb-change', async (key) => {
  const { tabs, items } = await mount()
  const heard = listen(tabs)
  items[2]!.focus()
  await userEvent.keyboard(key)
  expect(heard).toEqual(['confirmed'])
  expect(tabs.value).toBe('confirmed')
  expect(items.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false', 'false'])
  expect(items.map((tab) => tab.getAttribute('tabindex'))).toEqual(['-1', '-1', '0', '-1', '-1'])
})

test('a click selects and fires one eb-change that bubbles and is composed', async () => {
  const { tabs, items } = await mount()
  const events: CustomEvent[] = []
  document.body.addEventListener('eb-change', (event) => events.push(event as CustomEvent))
  await userEvent.click(items[1]!)
  expect(events.map((event) => event.detail)).toEqual([{ value: 'new' }])
  expect([events[0]!.bubbles, events[0]!.composed]).toEqual([true, true])
  expect(tabs.value).toBe('new')
  expect(tabs.getAttribute('value')).toBe('new')
})

test('selecting the selected tab fires nothing, and neither does setting value from code', async () => {
  const { tabs, items } = await mount()
  const heard = listen(tabs)
  await userEvent.click(items[0]!)
  items[0]!.focus()
  await userEvent.keyboard('{Enter}')
  tabs.value = 'returned'
  await tabs.updateComplete
  await Promise.all(items.map((tab) => tab.updateComplete))
  expect(heard).toEqual([])
  expect(items.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'false', 'true'])
})

test.for([
  [1280, 36],
  [360, 44],
] as const)('at %i px wide each tab is %i px tall', async ([width, height]) => {
  await page.viewport(width, 800)
  const { items } = await mount()
  for (const tab of items) expect(tab.getBoundingClientRect().height).toBe(height)
  await page.viewport(360, 800)
})

test('in Bangla the count reads in Bangla digits and no tab clips', async () => {
  await document.fonts.ready
  const { items } = await mount('bn')
  expect(countOf(items[0]!).textContent!.trim()).toBe('৬')
  for (const tab of items) expect(tab.scrollHeight).toBeLessThanOrEqual(tab.clientHeight)
})

test('a tab without a count shows none', async () => {
  document.body.innerHTML = '<eb-tabs label="Filter" value="a"><eb-tab value="a">A</eb-tab></eb-tabs>'
  const tab = document.querySelector('eb-tab')!
  await tab.updateComplete
  expect(tab.shadowRoot!.querySelector('.count')).toBeNull()
})

test('on a 360 px phone five tabs scroll inside the row, not the page, and the first ring is not clipped', async () => {
  await page.viewport(360, 800)
  const { tabs, items } = await mount()
  await document.fonts.ready
  const row = tabs.shadowRoot!.querySelector('.row')!
  expect(getComputedStyle(row).overflowX).toBe('auto')
  expect(row.scrollWidth).toBeGreaterThan(row.clientWidth)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  expect(tabs.getBoundingClientRect().right).toBeLessThanOrEqual(360)
  // The scroll box leaves room for a ring: 2 px wide at a 2 px offset.
  const box = row.getBoundingClientRect()
  const first = items[0]!.getBoundingClientRect()
  expect(first.left - 4).toBeGreaterThanOrEqual(box.left)
  expect(first.top - 4).toBeGreaterThanOrEqual(box.top)
  expect(first.bottom + 4).toBeLessThanOrEqual(box.bottom)
  document.querySelector<HTMLElement>('#before')!.focus()
  await userEvent.keyboard('{Tab}')
  expect(document.activeElement).toBe(items[0])
  const ring = getComputedStyle(items[0]!)
  expect([ring.outlineWidth, ring.outlineStyle, ring.outlineOffset]).toEqual(['2px', 'solid', '2px'])
})

test('a 1 px divider rule runs under the row of tabs', async () => {
  const { tabs } = await mount()
  const style = getComputedStyle(tabs)
  expect([style.borderBottomWidth, style.borderBottomStyle, style.borderBottomColor]).toEqual([
    '1px',
    'solid',
    token('--eb-color-divider'),
  ])
})

// Tabs whose value names none of them still take Tab: the first tab is the row's stop.
test.for(['', 'gone'])('tabs with value "%s" select none and keep the first tab in the Tab order', async (value) => {
  const { items } = await mount('en', value)
  await Promise.all(items.map((tab) => tab.updateComplete))
  expect(items.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'false', 'false', 'false'])
  expect(items.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1'])
  document.querySelector<HTMLElement>('#before')!.focus()
  await userEvent.keyboard('{Tab}')
  expect(document.activeElement).toBe(items[0])
})

test('tabs without a value of their own are never selected by tabs without one', async () => {
  document.body.innerHTML = `<eb-tabs label="Status"><eb-tab>All</eb-tab><eb-tab>New</eb-tab></eb-tabs>`
  const items = [...document.querySelectorAll('eb-tab')]
  await document.querySelector('eb-tabs')!.updateComplete
  await Promise.all(items.map((tab) => tab.updateComplete))
  expect(items.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false'])
  expect(items.map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1'])
})
