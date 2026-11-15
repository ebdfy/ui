import { afterEach, expect, test, vi } from 'vitest'
// e-date-field: a day reads "1 Nov 2026", day month year, in the page's language, over the browser's
// own date input, which still holds and submits the day as YYYY-MM-DD and opens its calendar.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineFields } from '../../src/v2/field.ts'
import { defineIcon } from '../../src/v2/icon.ts'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

const field = (lang: 'en' | 'bn') =>
  `<form lang="${lang}"><e-date-field label="${lang === 'bn' ? 'ডেলিভারির তারিখ' : 'Delivery date'}" name="delivery" value="2026-11-01"></e-date-field></form>`

const shown = (tag: Element) => tag.querySelector('[data-e-date]')!

test.for([
  ['en', '1 Nov 2026'],
  ['bn', '১ নভেম্বর ২০২৬'],
] as const)(
  'in %s the field reads %s, uncut at 360 px, and the form submits the day as written',
  async ([lang, text]) => {
    defineIcon()
    defineFields()
    document.body.innerHTML = field(lang)
    await document.fonts.ready
    const tag = document.querySelector('e-date-field')!
    const day = shown(tag)
    expect(day.textContent).toBe(text)
    expect(day.checkVisibility()).toBe(true)
    // Uncut: the words fit the box, and the box fits the phone.
    expect(day.scrollWidth).toBeLessThanOrEqual(day.clientWidth)
    expect(tag.getBoundingClientRect().right).toBeLessThanOrEqual(360)
    // It sits in the input's box, and the browser's own text there does not show through.
    const input = tag.querySelector('input')!
    const [a, b] = [day.getBoundingClientRect(), input.getBoundingClientRect()]
    expect(a.top).toBeGreaterThanOrEqual(b.top)
    expect(a.bottom).toBeLessThanOrEqual(b.bottom)
    // On top of the input, not beside it: one column, the input as wide as the field.
    expect(getComputedStyle(tag).gridTemplateColumns.split(' ')).toHaveLength(1)
    expect(Math.round(b.width)).toBe(Math.round(tag.getBoundingClientRect().width))
    expect(a.left).toBeGreaterThanOrEqual(b.left)
    expect(a.right).toBeLessThanOrEqual(b.right)
    expect(getComputedStyle(input).color).toBe('rgba(0, 0, 0, 0)')
    expect(new FormData(document.querySelector('form')!).get('delivery')).toBe('2026-11-01')
  },
)

test('a new day, picked or set by a script, reads afresh, and a switch of language redraws it', async () => {
  defineFields()
  document.body.innerHTML = field('en')
  const tag = document.querySelector('e-date-field')!
  const input = tag.querySelector('input')!
  input.value = '2026-12-25'
  expect(shown(tag).textContent).toBe('25 Dec 2026')
  input.value = ''
  expect(shown(tag).textContent).toBe('')
  input.value = '2026-09-05'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  expect(shown(tag).textContent).toBe('5 Sep 2026')
  // A page switching language sets the root's lang, as the sample pages do.
  document.querySelector('form')!.removeAttribute('lang')
  document.documentElement.lang = 'bn'
  try {
    await expect.poll(() => shown(tag).textContent).toBe('৫ সেপ্টেম্বর ২০২৬')
  } finally {
    document.documentElement.removeAttribute('lang')
  }
})

test('a press on the field opens the calendar', async () => {
  defineFields()
  document.body.innerHTML = field('en')
  const open = vi.spyOn(HTMLInputElement.prototype, 'showPicker').mockImplementation(() => {})
  await userEvent.click(page.getByLabelText('Delivery date'))
  expect(open).toHaveBeenCalledTimes(1)
})

// A day typed a part at a time is no day until it is whole, so while the field has focus the browser's
// own text shows, and the day returns once the person leaves it.
test('while the field has focus the typed parts show, and the day reads again after', async () => {
  defineFields()
  document.body.innerHTML = field('en')
  const tag = document.querySelector('e-date-field')!
  const input = tag.querySelector('input')!
  input.focus()
  expect(getComputedStyle(input).color).not.toBe('rgba(0, 0, 0, 0)')
  expect(shown(tag).checkVisibility({ visibilityProperty: true })).toBe(false)
  input.blur()
  expect(getComputedStyle(input).color).toBe('rgba(0, 0, 0, 0)')
  expect(shown(tag).checkVisibility({ visibilityProperty: true })).toBe(true)
})
