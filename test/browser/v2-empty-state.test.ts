import { afterEach, expect, test } from 'vitest'
// e-empty-state: CSS draws the heading as ::before, then the text and the action; the script puts a
// real h2 in the same place without moving anything.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineEmptyState } from '../../src/v2/empty-state.ts'

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

const english = `<e-empty-state heading="No orders match">
  <p>Try another word or clear the search.</p>
  <e-button slot="action">Clear search</e-button>
</e-empty-state>`

const bangla = `<div lang="bn"><e-empty-state heading="কোনো অর্ডার মেলেনি">
  <p>অন্য শব্দ লিখুন বা খোঁজা মুছুন।</p>
  <e-button slot="action">খোঁজা মুছুন</e-button>
</e-empty-state></div>`

// The tests above the first defineEmptyState() run before any test defines the tag, so they see the CSS alone.
test('before the script the heading is the ::before, above the text and the action', () => {
  const tag = mount(english).querySelector('e-empty-state')!
  const heading = getComputedStyle(tag, '::before')
  expect([heading.content, heading.fontWeight, heading.fontSize]).toEqual(['"No orders match"', '600', '16px'])
  const text = tag.querySelector('p')!
  const action = tag.querySelector('e-button')!
  expect(box(text).y).toBeGreaterThan(box(tag).y + 20)
  expect(box(action).y).toBeGreaterThan(box(text).y)
  expect(getComputedStyle(text).color).toBe(
    getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg2').trim(),
  )
})

const withIcon = `<e-empty-state icon="cloud-off" heading="Orders did not load">
  <p>Check the connection and try again.</p>
  <e-button slot="action">Try again</e-button>
</e-empty-state>`

test('the script moves nothing in English or Bangla', () => {
  const holder = mount(english + bangla + withIcon)
  const parts = [...holder.querySelectorAll('e-empty-state, p, e-button')]
  const before = parts.map(box)
  defineEmptyState()
  expect(parts.map((part, index) => near(before[index]!, box(part)))).toEqual(parts.map(() => []))
})

test('after the script the heading is a real h2 and a new heading attribute renames it', async () => {
  const tag = mount(english).querySelector('e-empty-state')!
  await expect.element(page.getByRole('heading', { name: 'No orders match' })).toBeVisible()
  expect(getComputedStyle(tag, '::before').content).toBe('none')
  tag.setAttribute('heading', 'কোনো অর্ডার নেই')
  await expect.element(page.getByRole('heading', { name: 'কোনো অর্ডার নেই' })).toBeVisible()
  expect(tag.querySelectorAll('h2')).toHaveLength(1)
})

test('hidden hides it', () => {
  const tag = mount(english).querySelector('e-empty-state')!
  tag.setAttribute('hidden', '')
  expect(getComputedStyle(tag).display).toBe('none')
})

test('an icon sits 40 px square above a 16 px title, in the place the CSS kept for it', async () => {
  const tag = mount(withIcon).querySelector('e-empty-state')!
  await expect.element(page.getByRole('heading', { name: 'Orders did not load' })).toBeVisible()
  const icon = tag.querySelector(':scope > e-icon')!
  expect(icon.getAttribute('name')).toBe('cloud-off')
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  const heading = tag.querySelector('h2')!
  expect([box(icon).width, box(icon).height]).toEqual([40, 40])
  expect(box(icon).y + 40).toBeLessThanOrEqual(box(heading).y)
  expect(Math.abs(box(icon).x + 20 - (box(tag).x + box(tag).width / 2))).toBeLessThanOrEqual(1)
  expect(getComputedStyle(heading).fontSize).toBe('16px')
  expect(getComputedStyle(icon).color).toBe(
    getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg3').trim(),
  )
  // The icon belongs to the tag: a second connect builds no second one.
  tag.remove()
  document.body.append(tag)
  expect(tag.querySelectorAll(':scope > e-icon')).toHaveLength(1)
})
