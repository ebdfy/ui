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
  expect([heading.content, heading.fontWeight, heading.fontSize]).toEqual(['"No orders match"', '600', '15px'])
  const text = tag.querySelector('p')!
  const action = tag.querySelector('e-button')!
  expect(box(text).y).toBeGreaterThan(box(tag).y + 20)
  expect(box(action).y).toBeGreaterThan(box(text).y)
  expect(getComputedStyle(text).color).toBe(
    getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg2').trim(),
  )
})

test('the script moves nothing in English or Bangla', () => {
  const holder = mount(english + bangla)
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
