import { afterEach, expect, test } from 'vitest'
// e-phone-field: CSS draws the label and box before the script, which then builds a real label and
// tel input in the same places. Bangla digits turn Latin as typed, and the form refuses a number that
// is not 11 digits starting 01, with the message under the field.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { watchSaveBars } from '../../src/save-bar.ts'
import { definePhoneField } from '../../src/v2/phone-field.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(1280, 800)
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

const phone = '<e-phone-field label="Phone" name="phone" placeholder="01XXXXXXXXX"></e-phone-field>'

// Submits each time the form lets a submit through, and keeps what it would send.
function submits(form: HTMLFormElement): string[] {
  const sent: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    sent.push(new URLSearchParams(new FormData(form) as never).toString())
  })
  return sent
}

// The tests until the one that defines e-phone-field see the CSS alone.
test('the script builds the label and input where the CSS drew them: 36 px at 1280, 44 px at 360', async () => {
  const holder = mount(
    phone + `<div lang="bn"><e-phone-field label="ফোন" name="b" value="01707071591"></e-phone-field></div>`,
  )
  const tags = [...holder.querySelectorAll('e-phone-field')]
  await document.fonts.ready
  await page.viewport(1280, 800)
  const at1280 = tags.map(box)
  await page.viewport(360, 800)
  const at360 = tags.map(box)
  expect(getComputedStyle(tags[0]!, '::before').content).toBe('"Phone"')
  expect(getComputedStyle(tags[1]!, '::after').content).toBe('"01707071591"')
  definePhoneField()
  // Only the built label and input draw, so the value is not drawn twice.
  expect(tags.map((tag) => getComputedStyle(tag, '::after').content)).toEqual(['none', 'none'])

  // An 18 px label (20 px in Bangla), 6 px between, then the box.
  expect(tags.map((tag) => tag.querySelector('input')!.getBoundingClientRect().height)).toEqual([44, 44])
  expect(tags.flatMap((tag, index) => near(at360[index]!, box(tag)))).toEqual([])
  const label = tags[0]!.querySelector('label')!
  expect(near({ ...at360[0]!, height: 18 }, box(label))).toEqual([])
  expect(near({ ...at360[0]!, y: at360[0]!.y + 24, height: 44 }, box(tags[0]!.querySelector('input')!))).toEqual([])
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)

  await page.viewport(1280, 800)
  expect(tags.flatMap((tag, index) => near(at1280[index]!, box(tag)))).toEqual([])
  expect(near({ ...at1280[0]!, y: at1280[0]!.y + 24, height: 36 }, box(tags[0]!.querySelector('input')!))).toEqual([])
  expect(near({ ...at1280[1]!, y: at1280[1]!.y + 26, height: 36 }, box(tags[1]!.querySelector('input')!))).toEqual([])
})

test('typing a phone in Bangla digits shows and submits it in Latin digits', async () => {
  definePhoneField()
  const form = mount(`<form>${phone}</form>`).querySelector('form')!
  const sent = submits(form)
  const input = page.getByRole('textbox', { name: 'Phone' })
  await userEvent.type(input, '০১৭০৭০৭১৫৯১')
  await expect.element(input).toHaveValue('01707071591')
  form.requestSubmit()
  expect(sent).toEqual(['phone=01707071591'])
})

test('a short number blocks the submit with the message under the field, until the 11th digit', async () => {
  definePhoneField()
  const form = mount(`<form>${phone}</form>`).querySelector('form')!
  const sent = submits(form)
  const input = page.getByRole('textbox', { name: 'Phone' })
  const prevented: boolean[] = []
  input.element().addEventListener('invalid', (event) => prevented.push(event.defaultPrevented))
  await userEvent.type(input, '0170707159')
  form.requestSubmit()

  expect(sent).toEqual([])
  expect(prevented).toEqual([true])
  const message = page.getByText('Enter an 11-digit number starting 01')
  expect(input.element().getAttribute('aria-invalid')).toBe('true')
  expect(input.element()).toHaveAccessibleDescription('Enter an 11-digit number starting 01')
  expect(message.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    input.element().getBoundingClientRect().bottom,
  )

  await userEvent.type(input, '1')
  expect(page.getByText('Enter an 11-digit number starting 01').elements()).toHaveLength(0)
  expect(input.element().hasAttribute('aria-invalid')).toBe(false)
  form.requestSubmit()
  expect(sent).toEqual(['phone=01707071591'])
})

test('in Bangla the message is the Bangla one', async () => {
  definePhoneField()
  const form = mount(`<form lang="bn"><e-phone-field label="ফোন" name="phone"></e-phone-field></form>`).querySelector(
    'form',
  )!
  submits(form)
  await userEvent.type(page.getByRole('textbox', { name: 'ফোন' }), '০১৭')
  form.requestSubmit()
  await expect.element(page.getByText('01 দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন')).toBeVisible()
})

test('an empty phone that is not required submits', () => {
  definePhoneField()
  const form = mount(`<form>${phone}</form>`).querySelector('form')!
  const sent = submits(form)
  form.requestSubmit()
  expect(sent).toEqual(['phone='])
})

test('a short number put back by Discard to a whole one leaves the form free to submit', async () => {
  definePhoneField()
  const form = mount(
    `<form data-save-bar>${phone.replace('placeholder', 'value="01707071591" placeholder')}</form>`,
  ).querySelector('form')!
  const sent = submits(form)
  const bar = watchSaveBars(document, () => {})
  const input = page.getByRole('textbox', { name: 'Phone' })
  await userEvent.fill(input, '0170707159')
  form.requestSubmit()
  expect(sent).toEqual([])

  bar.act('discard')
  expect((input.element() as HTMLInputElement).value).toBe('01707071591')
  expect(page.getByText('Enter an 11-digit number starting 01').elements()).toHaveLength(0)
  form.requestSubmit()
  expect(sent).toEqual(['phone=01707071591'])
})

test('Bangla digits typed in the middle of a number land where they were typed', async () => {
  definePhoneField()
  mount(phone)
  const input = page.getByRole('textbox', { name: 'Phone' })
  await userEvent.fill(input, '017071591')
  ;(input.element() as HTMLInputElement).setSelectionRange(3, 3)
  await userEvent.keyboard('০৭')
  expect((input.element() as HTMLInputElement).value).toBe('01707071591')
})

test('a phone given in Bangla digits in the markup is a Latin, valid number', () => {
  definePhoneField()
  mount('<e-phone-field label="Phone" name="phone" value="০১৭০৭০৭১৫৯১"></e-phone-field>')
  const input = page.getByRole('textbox', { name: 'Phone' }).element() as HTMLInputElement
  expect([input.value, input.validity.valid]).toEqual(['01707071591', true])
})

test('a refused save puts focus on the phone', async () => {
  definePhoneField()
  const form = mount(`<form><e-text-field label="Name" name="name"></e-text-field>${phone}</form>`).querySelector(
    'form',
  )!
  await userEvent.fill(page.getByRole('textbox', { name: 'Phone' }), '0170707159')
  ;(document.activeElement as HTMLElement).blur()
  form.requestSubmit()
  expect(document.activeElement).toBe(page.getByRole('textbox', { name: 'Phone' }).element())
})
