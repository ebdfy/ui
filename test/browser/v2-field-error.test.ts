import { afterEach, expect, test } from 'vitest'
// A v2 field's error attribute shows its message under the control, marks the control invalid and
// describes it with the message; without the attribute neither shows.
import { page } from 'vitest/browser'

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

const message = 'Enter an 11-digit number starting 01'

test.for([
  ['e-text-field', 'Phone'],
  ['e-text-area', 'Note'],
])('<%s error> shows the message under the control, which reads invalid and described by it', ([tag, label]) => {
  const field = mount(`<${tag} label="${label}" name="x" error="${message}"></${tag}>`).firstElementChild!
  defineFields()
  const control = page.getByRole('textbox', { name: label })
  expect(control.element().getAttribute('aria-invalid')).toBe('true')
  expect(control.element()).toHaveAccessibleDescription(message)
  const line = page.getByText(message)
  expect(line.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
    control.element().getBoundingClientRect().bottom,
  )
  expect(field.contains(line.element())).toBe(true)
})

test('an error set after the script shows, a new one replaces it, and removing it clears both marks', () => {
  const field = mount('<e-text-field label="Phone" name="phone"></e-text-field>').firstElementChild!
  defineFields()
  const input = field.querySelector('input')!
  expect(input.hasAttribute('aria-invalid')).toBe(false)

  field.setAttribute('error', 'Phone is taken')
  expect(input).toHaveAccessibleDescription('Phone is taken')
  field.setAttribute('error', message)
  expect(page.getByText('Phone is taken').elements()).toHaveLength(0)
  expect(input).toHaveAccessibleDescription(message)

  field.removeAttribute('error')
  expect(page.getByText(message).elements()).toHaveLength(0)
  expect(input.hasAttribute('aria-invalid')).toBe(false)
  expect(input.hasAttribute('aria-describedby')).toBe(false)
})

test('the error line is in the danger colour, and in Bangla at least 13 px on a 1.4 line', () => {
  mount(
    `<div lang="bn"><e-text-field label="ফোন" name="phone" error="০১ দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন"></e-text-field></div>`,
  )
  defineFields()
  const style = getComputedStyle(page.getByText('০১ দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন').element())
  const danger = getComputedStyle(document.documentElement).getPropertyValue('--e-color-returned-fg').trim()
  const probe = document.createElement('i')
  probe.style.color = danger
  document.body.append(probe)
  expect(style.color).toBe(getComputedStyle(probe).color)
  const size = Number.parseFloat(style.fontSize)
  expect(size).toBeGreaterThanOrEqual(13)
  expect(Number.parseFloat(style.lineHeight) / size).toBeGreaterThanOrEqual(1.4)
})
