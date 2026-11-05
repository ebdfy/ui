import { afterEach, expect, test } from 'vitest'
// e-courier-status: a courier's word for a parcel as a status tag. CSS draws the words before the
// script, which writes them as text in the same place.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineCourierStatus } from '../../src/v2/courier-status.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('lang')
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

const tags = [
  '<e-courier-status status="with-courier"></e-courier-status>',
  '<e-courier-status status="IN_TRANSIT"></e-courier-status>',
  '<e-courier-status status="delivered"></e-courier-status>',
  '<e-courier-status status="partly-delivered"></e-courier-status>',
  '<e-courier-status status="no-such-word"></e-courier-status>',
  '<e-courier-status></e-courier-status>',
  '<span lang="bn"><e-courier-status status="with-courier"></e-courier-status></span>',
  '<span lang="bn"><e-courier-status status="ATTEMPT_FAILED"></e-courier-status></span>',
  '<span lang="bn"><e-courier-status status="EXCEPTION"></e-courier-status></span>',
]

// The tests until the one that defines e-courier-status see the CSS alone.
test('before the script the tag draws its words in the page language', () => {
  const holder = mount(tags.join(' '))
  expect(
    [...holder.querySelectorAll('e-courier-status')].map((tag) => getComputedStyle(tag, '::before').content),
  ).toEqual([
    '"With courier"',
    '"With courier"',
    '"Delivered"',
    '"Partly delivered"',
    '"Unknown"',
    '"Unknown"',
    '"কুরিয়ারে"',
    '"ডেলিভারি হয়নি"',
    '"সমস্যা"',
  ])
})

test('the script writes the words as text without moving any tag, nothing wider than a 360 px page', async () => {
  const holder = mount(tags.join(' '))
  const all = [...holder.querySelectorAll('e-courier-status')]
  await document.fonts.ready
  const before = all.map(box)
  defineCourierStatus()
  expect(all.map((tag) => tag.textContent)).toEqual([
    'With courier',
    'With courier',
    'Delivered',
    'Partly delivered',
    'Unknown',
    'Unknown',
    'কুরিয়ারে',
    'ডেলিভারি হয়নি',
    'সমস্যা',
  ])
  expect(all.flatMap((tag, index) => near(before[index]!, box(tag)))).toEqual([])
  expect(all.map((tag) => getComputedStyle(tag, '::before').content)).toEqual(all.map(() => 'none'))
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('status="with-courier" and status="IN_TRANSIT" both read With courier, and কুরিয়ারে in Bangla', () => {
  defineCourierStatus()
  mount(tags[0]! + tags[1]! + tags[6]!)
  expect(page.getByText('With courier').elements()).toHaveLength(2)
  expect(page.getByText('কুরিয়ারে').elements()).toHaveLength(1)
})

test('delivered is green as e-badge tone="delivered" is, with-courier teal, and partly-delivered amber', () => {
  defineCourierStatus()
  const holder = mount(
    tags[0]! +
      tags[2]! +
      tags[3]! +
      '<e-badge tone="delivered">Delivered</e-badge><e-badge tone="courier">On its way</e-badge><e-badge tone="new">New</e-badge>',
  )
  const look = (element: Element) => {
    const style = getComputedStyle(element)
    return [style.color, style.backgroundColor, style.fontSize, style.lineHeight, style.paddingLeft, style.borderRadius]
  }
  const [courier, delivered, partly] = [...holder.querySelectorAll('e-courier-status')]
  const [green, teal, amber] = [...holder.querySelectorAll('e-badge')]
  expect(look(delivered!)).toEqual(look(green!))
  expect(look(courier!)).toEqual(look(teal!))
  expect(look(partly!)).toEqual(look(amber!))
  expect(box(delivered!).height).toBe(box(green!).height)
})

test('a new status, or the page switching to Bangla, rewrites the words', () => {
  defineCourierStatus()
  const tag = mount(tags[0]!).firstElementChild!
  tag.setAttribute('status', 'returned')
  expect(tag.textContent).toBe('Returned')
  document.documentElement.lang = 'bn'
  return expect.poll(() => tag.textContent).toBe('ফেরত এসেছে')
})
