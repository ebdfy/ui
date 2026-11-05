import { afterEach, expect, test } from 'vitest'
// e-tabs and e-tab: CSS draws the row, the selected underline and the counts before the script, which
// then adds roles, keyboard and the e-tab-change event without moving anything.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineTabs } from '../../src/v2/tabs.ts'

afterEach(() => {
  document.body.replaceChildren()
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function near(before: ReturnType<typeof box>, after: ReturnType<typeof box>): string[] {
  return (Object.keys(before) as (keyof typeof before)[])
    .filter((key) => Math.abs(before[key] - after[key]) > 1)
    .map((key) => `${key} ${before[key]} -> ${after[key]}`)
}

const three = `<e-tabs label="Order views">
  <e-tab value="all" count="120" selected>All</e-tab>
  <e-tab value="new" count="12">New</e-tab>
  <e-tab value="confirmed" count="18">Confirmed</e-tab>
  <e-button aria-label="Add view">+</e-button>
</e-tabs>`

const bangla = `<div lang="bn"><e-tabs label="অর্ডারের তালিকা">
  <e-tab value="all" count="১২০" selected>সব</e-tab>
  <e-tab value="new" count="১২">নতুন</e-tab>
</e-tabs></div>`

const six = `<e-tabs label="Order views">
  <e-tab value="all" count="120" selected>All</e-tab>
  <e-tab value="new" count="12">New</e-tab>
  <e-tab value="confirmed" count="18">Confirmed</e-tab>
  <e-tab value="courier" count="54">With courier</e-tab>
  <e-tab value="delivered" count="30">Delivered</e-tab>
  <e-tab value="returned" count="6">Returned</e-tab>
</e-tabs>`

// The tests above the first defineTabs() run before any test defines the tags, so they see the CSS alone.
test('before the script the tabs sit in a row, the selected one underlined, with the count after New', async () => {
  await page.viewport(800, 600)
  const holder = mount(three)
  const [all, fresh] = holder.querySelectorAll('e-tab')
  const primary = getComputedStyle(document.documentElement).getPropertyValue('--e-color-primary').trim()
  const fg = getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg').trim()
  const fg2 = getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg2').trim()

  expect(box(all!).y).toBe(box(fresh!).y)
  expect(box(fresh!).x).toBeGreaterThanOrEqual(box(all!).x + box(all!).width)
  expect(box(all!).height).toBe(36)
  expect(getComputedStyle(fresh!, '::after').content).toBe('"12"')
  expect([
    getComputedStyle(all!).borderBottomWidth,
    getComputedStyle(all!).borderBottomColor,
    getComputedStyle(all!).color,
  ]).toEqual(['2px', primary, fg])
  expect([getComputedStyle(fresh!).borderBottomColor, getComputedStyle(fresh!).color]).toEqual([
    'rgba(0, 0, 0, 0)',
    fg2,
  ])
})

test('below 600 px each tab is 44 px tall, and six tabs scroll inside e-tabs at 360 px', async () => {
  await page.viewport(360, 800)
  const tabs = mount(six).querySelector('e-tabs')!
  for (const tab of tabs.querySelectorAll('e-tab')) expect(box(tab).height).toBe(44)
  expect(getComputedStyle(tabs).overflowX).toBe('auto')
  expect(tabs.scrollWidth).toBeGreaterThan(tabs.clientWidth)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('the script moves nothing in English or Bangla', async () => {
  await page.viewport(800, 600)
  const holder = mount(three + bangla)
  const parts = [...holder.querySelectorAll('e-tabs, e-tab, e-button')]
  const before = parts.map(box)
  defineTabs()
  expect(parts.map((part, index) => near(before[index]!, box(part)))).toEqual(parts.map(() => []))
})

test('a tab is named with its count and a click selects it and tells the page', async () => {
  const holder = mount(three)
  const heard: unknown[] = []
  document.addEventListener('e-tab-change', (event) => heard.push((event as CustomEvent).detail))
  const list = holder.querySelector('e-tabs')!
  expect([list.getAttribute('role'), list.getAttribute('aria-label')]).toEqual(['tablist', 'Order views'])

  await expect.element(page.getByRole('tab', { name: 'New 12' })).toBeVisible()
  await page.getByRole('tab', { name: 'New 12' }).click()
  const [all, fresh] = holder.querySelectorAll('e-tab')
  expect([fresh!.getAttribute('aria-selected'), all!.getAttribute('aria-selected')]).toEqual(['true', 'false'])
  expect([fresh!.getAttribute('tabindex'), all!.getAttribute('tabindex')]).toEqual(['0', '-1'])
  expect(all!.hasAttribute('selected')).toBe(false)
  expect(heard).toEqual([{ value: 'new' }])
})

test('arrow keys, Home and End move focus and select', async () => {
  const holder = mount(six)
  const tabs = [...holder.querySelectorAll('e-tab')]
  const heard: string[] = []
  holder.addEventListener('e-tab-change', (event) => heard.push((event as CustomEvent).detail.value))
  ;(tabs[0] as HTMLElement).focus()

  await userEvent.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(tabs[1])
  expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
  await userEvent.keyboard('{End}')
  expect(document.activeElement).toBe(tabs[5])
  expect(tabs[5]!.getAttribute('aria-selected')).toBe('true')
  await userEvent.keyboard('{Home}')
  expect(document.activeElement).toBe(tabs[0])
  expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
  expect(heard).toEqual(['new', 'returned', 'all'])
})

test('the Enter key selects a focused tab', async () => {
  const holder = mount(three)
  const confirmed = holder.querySelectorAll('e-tab')[2] as HTMLElement
  confirmed.focus()
  await userEvent.keyboard('{Enter}')
  expect(confirmed.getAttribute('aria-selected')).toBe('true')
})

test('the app selecting another tab, or changing a count, updates the roles and the name', async () => {
  const holder = mount(three)
  const [all, fresh] = holder.querySelectorAll('e-tab')
  fresh!.setAttribute('selected', '')
  expect([all!.getAttribute('aria-selected'), fresh!.getAttribute('aria-selected')]).toEqual(['false', 'true'])
  expect([all!.getAttribute('tabindex'), fresh!.getAttribute('tabindex')]).toEqual(['-1', '0'])

  fresh!.setAttribute('count', '১৩')
  expect(fresh!.getAttribute('aria-label')).toBe('New ১৩')
  fresh!.firstChild!.textContent = 'নতুন'
  await expect.element(page.getByRole('tab', { name: 'নতুন ১৩' })).toBeVisible()
})

test('with no tab selected the first is the one Tab reaches', () => {
  defineTabs()
  mount('<e-tabs label="Views"><e-tab value="a">A</e-tab><e-tab value="b">B</e-tab></e-tabs>')
  expect([...document.querySelectorAll('e-tab')].map((tab) => tab.getAttribute('tabindex'))).toEqual(['0', '-1'])
})
