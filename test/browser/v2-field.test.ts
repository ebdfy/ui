import { afterEach, expect, test } from 'vitest'
// e-text-field and e-search-field: CSS draws both before the script, which then builds a real label
// and input inside without moving them, and the input joins its form.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineFields } from '../../src/v2/field.ts'

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

const size = (style: CSSStyleDeclaration) => Number.parseFloat(style.fontSize)

function ring(element: Element): string[] {
  const style = getComputedStyle(element)
  return [style.outlineStyle, style.outlineWidth, style.outlineColor]
}

const phone =
  '<e-text-field label="Phone" name="phone" value="" placeholder="01XXXXXXXXX" type="tel" inputmode="numeric" required></e-text-field>'
const bangla =
  '<div lang="bn"><e-text-field label="ফোন" name="phone" placeholder="গ্রাহকের ফোন নম্বর লিখুন, যেমন ০১৭০৭০৭১৫৯১, এগারো অঙ্কে"></e-text-field></div>'

const fits = (field: Element) =>
  field.getBoundingClientRect().right <= 360 && document.documentElement.scrollWidth <= 360

const search = '<e-search-field label="Search orders" name="q" placeholder="Search orders"></e-search-field>'

test('before the script the text field shows its label above a 44 px box on a phone, with the placeholder', () => {
  const holder = mount(phone + search)
  const field = holder.querySelector('e-text-field')!
  const label = getComputedStyle(field, '::before')
  const input = getComputedStyle(field, '::after')
  expect([label.content, label.display, input.content, input.height]).toEqual([
    '"Phone"',
    'block',
    '"01XXXXXXXXX"',
    '44px',
  ])
  // An 18 px label line, 6 px between, then the 44 px box.
  expect(field.getBoundingClientRect().height).toBe(68)
  expect(getComputedStyle(field).display).not.toBe('inline')

  const tag = holder.querySelector('e-search-field')!
  const icon = getComputedStyle(tag, '::before')
  expect(tag.getBoundingClientRect().height).toBe(44)
  expect(getComputedStyle(tag).display).not.toBe('inline')
  expect([icon.width, icon.height, getComputedStyle(tag, '::after').content]).toEqual([
    '16px',
    '16px',
    '"Search orders"',
  ])
})

test('before the script a value shows in the box in place of the placeholder', () => {
  const holder = mount('<e-text-field label="Phone" name="phone" value="01707071591" placeholder="01XXXXXXXXX">')
  expect(getComputedStyle(holder.firstElementChild!, '::after').content).toBe('"01707071591"')
})

// The tests above this one run before any test defines the fields, so they see the CSS alone.
test('in Bangla before the script the label and placeholder are at least 13 px and fit 360 px', () => {
  const field = mount(bangla).querySelector('e-text-field')!
  expect(field.querySelector('input')).toBeNull()
  expect(size(getComputedStyle(field, '::before'))).toBeGreaterThanOrEqual(13)
  expect(size(getComputedStyle(field, '::after'))).toBeGreaterThanOrEqual(13)
  expect(fits(field)).toBe(true)
})

test('the script builds one labelled input in each field without moving anything', async () => {
  const holder = mount(phone + search)
  const field = holder.querySelector('e-text-field')!
  const tag = holder.querySelector('e-search-field')!
  const fieldBefore = box(field)
  const tagBefore = box(tag)
  defineFields()

  expect(field.querySelectorAll('input[name="phone"]')).toHaveLength(1)
  expect(page.getByRole('textbox', { name: 'Phone' }).elements()).toHaveLength(1)
  expect(tag.querySelectorAll('input')).toHaveLength(1)
  expect(page.getByRole('searchbox', { name: 'Search orders' }).elements()).toHaveLength(1)

  expect(near(fieldBefore, box(field))).toEqual([])
  expect(near(tagBefore, box(tag))).toEqual([])
  // A pseudo-element has no rect, so the CSS places come from the tag: the ::before is the first
  // grid row, at the tag's top-left and full width, and the ::after is the 44 px last row, 6 px
  // below it. The built label and input take those same rows.
  const label = field.querySelector('label')!
  const input = field.querySelector('input')!
  expect(
    near(
      { x: fieldBefore.x, y: fieldBefore.y, width: fieldBefore.width, height: fieldBefore.height - 44 - 6 },
      box(label),
    ),
  ).toEqual([])
  expect(
    near(
      { x: fieldBefore.x, y: fieldBefore.y + fieldBefore.height - 44, width: fieldBefore.width, height: 44 },
      box(input),
    ),
  ).toEqual([])
  // The search icon's 16 px box sits after the 1 px border and 12 px padding, centred in 44 px.
  const icon = tag.querySelector('e-icon[name="search"]')!
  expect(near({ x: tagBefore.x + 13, y: tagBefore.y + 14, width: 16, height: 16 }, box(icon))).toEqual([])
  // The placeholder ::after, and so the input, starts 8 px after the icon (13 + 16 + 8 = 37), ends
  // at the 12 px padding and 1 px border, and fills the 42 px inside the border.
  const searchbox = tag.querySelector('input')!
  expect(
    near({ x: tagBefore.x + 37, y: tagBefore.y + 1, width: tagBefore.width - 37 - 13, height: 42 }, box(searchbox)),
  ).toEqual([])

  // A second define, or the tag moving in the page, never builds a second input.
  defineFields()
  holder.append(field)
  expect(field.querySelectorAll('input')).toHaveLength(1)
})

test('inside a form the typed phone submits as phone=01707071591', async () => {
  const holder = mount(`<form>${phone}<button>Save</button></form>`)
  defineFields()
  const form = holder.querySelector('form')!
  const submitted: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitted.push(new URLSearchParams(new FormData(form) as never).toString())
  })
  await userEvent.type(page.getByRole('textbox', { name: 'Phone' }), '01707071591')
  expect((holder.querySelector('e-text-field') as HTMLElement & { value: string }).value).toBe('01707071591')
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  expect(submitted).toEqual(['phone=01707071591'])
})

test('a field added after the script ran is built too', async () => {
  defineFields()
  mount(phone)
  await expect.element(page.getByRole('textbox', { name: 'Phone' })).toBeVisible()
})

test('in Bangla after the script the label and placeholder are at least 13 px and fit 360 px', () => {
  defineFields()
  const field = mount(bangla).querySelector('e-text-field')!
  expect(size(getComputedStyle(field.querySelector('label')!))).toBeGreaterThanOrEqual(13)
  expect(size(getComputedStyle(field.querySelector('input')!, '::placeholder'))).toBeGreaterThanOrEqual(13)
  expect(fits(field)).toBe(true)
})

test('keyboard focus rings the field box in 2 px of the focus colour', async () => {
  const holder = mount(phone + search)
  defineFields()
  const focus = getComputedStyle(document.documentElement).getPropertyValue('--e-color-focus').trim()

  await userEvent.keyboard('{Tab}')
  const input = holder.querySelector('e-text-field > input')!
  expect(document.activeElement).toBe(input)
  expect(ring(input)).toEqual(['solid', '2px', focus])

  await userEvent.keyboard('{Tab}')
  const tag = holder.querySelector('e-search-field')!
  expect(document.activeElement).toBe(tag.querySelector('input'))
  expect(ring(tag)).toEqual(['solid', '2px', focus])
})

test.for(['e-text-field label="Note"', 'e-search-field label="Search"'])(
  'a built <%s> with a value draws only its input, at full width',
  async (tag) => {
    const name = tag.split(' ')[0]!
    const field = mount(`<${tag} name="q" value="Ring the bell twice"></${name}>`).firstElementChild!
    defineFields()
    const input = field.querySelector('input')!
    expect(input.value).toBe('Ring the bell twice')
    expect(getComputedStyle(field, '::after').content).toBe('none')
    const room = field.getBoundingClientRect().right - input.getBoundingClientRect().left
    // The field's end padding and border stand after the input.
    expect(input.getBoundingClientRect().width).toBeGreaterThanOrEqual(room - 13)
  },
)

test('from 600 px the text, date and search fields are 36 px tall, and on a phone 44 px targets', async () => {
  defineFields()
  mount(
    '<e-text-field label="Name"></e-text-field><e-date-field label="Date"></e-date-field><e-search-field label="Search"></e-search-field>',
  )
  const heights = () =>
    [...document.querySelectorAll('e-text-field > input, e-date-field > input, e-search-field')].map(
      (box) => box.getBoundingClientRect().height,
    )
  expect(heights()).toEqual([44, 44, 44])
  await page.viewport(600, 800)
  try {
    expect(heights()).toEqual([36, 36, 36])
  } finally {
    await page.viewport(360, 800)
  }
})
