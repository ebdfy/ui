// e-summary: label and value rows, such as an order's payment, drawn by v2.css alone. Each row's value
// sits at its end, the total row is heavier, and e-due says what is still owed in a tone.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { contrast, inDark } from './colour.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const payment = (lang = 'en') =>
  lang === 'bn'
    ? `<e-summary lang="bn">
        <e-summary-row><span>সাবটোটাল</span><span>২টি পণ্য</span><span>৳১,৮১০</span></e-summary-row>
        <e-summary-row><span>ডেলিভারি চার্জ, কালিয়াকৈর, গাজীপুর থেকে ঢাকার বাইরে স্টেডফাস্ট কুরিয়ারে পাঠানো</span><span>৳১২০</span></e-summary-row>
        <e-summary-row total><span>মোট</span><span>৳১,৯৩০</span></e-summary-row>
        <e-due tone="warning">ডেলিভারিতে ৳১,৯৩০ নিতে হবে</e-due>
      </e-summary>`
    : `<e-summary>
        <e-summary-row><span>Subtotal</span><span>2 items</span><span>৳1,810</span></e-summary-row>
        <e-summary-row><span>Delivery</span><span>৳120</span></e-summary-row>
        <e-summary-row total><span>Total</span><span>৳1,930</span></e-summary-row>
        <e-due tone="warning">To collect ৳1,930 on delivery</e-due>
      </e-summary>`

const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()

test('at 1280 px each value sits at the row’s end, level with its label', async () => {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<div style="width: 600px">${payment()}</div>`
  const summary = rect('e-summary')
  for (const row of document.querySelectorAll('e-summary-row')) {
    const label = row.firstElementChild!.getBoundingClientRect()
    const value = row.lastElementChild!.getBoundingClientRect()
    expect(Math.round(value.right)).toBe(Math.round(summary.right))
    expect(Math.round(label.left)).toBe(Math.round(summary.left))
    expect(Math.round(value.top)).toBe(Math.round(label.top))
    expect(getComputedStyle(row.lastElementChild!).fontVariantNumeric).toBe('tabular-nums')
  }
  // A middle child, such as the item count, reads quieter than the label beside it.
  const [label, count] = document.querySelector('e-summary-row')!.children
  expect(getComputedStyle(count!).color).not.toBe(getComputedStyle(label!).color)
  expect(count!.getBoundingClientRect().left).toBeGreaterThan(label!.getBoundingClientRect().right)
})

test('the total row is the last row, at 600 weight, under a line', () => {
  document.body.innerHTML = payment()
  const total = document.querySelector('e-summary-row[total]')!
  const plain = document.querySelector('e-summary-row:not([total])')!
  expect(getComputedStyle(total.firstElementChild!).fontWeight).toBe('600')
  expect(getComputedStyle(total.lastElementChild!).fontWeight).toBe('600')
  expect(getComputedStyle(plain.lastElementChild!).fontWeight).toBe('400')
  expect(getComputedStyle(total).borderTopWidth).toBe('1px')
  expect(total.getBoundingClientRect().top).toBeGreaterThan(plain.getBoundingClientRect().bottom)
})

test('e-due is a whole-width amber block under the rows, its words readable in light and dark', async () => {
  document.body.innerHTML = payment()
  const due = document.querySelector('e-due')!
  expect(Math.round(rect('e-due').width)).toBe(Math.round(rect('e-summary').width))
  expect(rect('e-due').top).toBeGreaterThan(rect('e-summary-row[total]').bottom)
  const light = getComputedStyle(due)
  expect(light.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  const amber = getComputedStyle(document.documentElement).getPropertyValue('--e-color-warn-soft').trim()
  expect(amber).not.toBe('')
  expect(contrast(light.color, light.backgroundColor)).toBeGreaterThanOrEqual(4.5)
  const dark = await inDark(async () => {
    const style = getComputedStyle(due)
    return { color: style.color, background: style.backgroundColor }
  })
  expect(contrast(dark.color, dark.background)).toBeGreaterThanOrEqual(4.5)
})

test('each tone of e-due draws its own colours', () => {
  document.body.innerHTML = ['warning', 'success', 'critical', '']
    .map((tone) => `<e-due${tone ? ` tone="${tone}"` : ''}>৳1,930</e-due>`)
    .join('')
  const backgrounds = [...document.querySelectorAll('e-due')].map((due) => getComputedStyle(due).backgroundColor)
  expect(new Set(backgrounds).size).toBe(4)
  for (const due of document.querySelectorAll('e-due')) {
    const style = getComputedStyle(due)
    expect(contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5)
  }
})

test('at 360 px a long Bangla label wraps beside its value and nothing scrolls sideways', () => {
  document.body.innerHTML = payment('bn')
  const row = document.querySelectorAll('e-summary-row')[1]!
  const label = row.firstElementChild!.getBoundingClientRect()
  const value = row.lastElementChild!.getBoundingClientRect()
  expect(label.height).toBeGreaterThan(30)
  expect(value.left).toBeGreaterThanOrEqual(label.right)
  expect(Math.round(value.right)).toBe(Math.round(rect('e-summary').right))
  expect(document.documentElement.scrollWidth).toBe(360)
})
