import { afterEach, expect, test } from 'vitest'
// A field whose <input> is written inside its tag, as a sign-in form writes it: the form shows its
// fields and posts before v2.js, the script adopts the same input, and an error written in the markup
// shows under the field before the script, drawn as the script then draws it, until the person types.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineFields } from '../../src/v2/field.ts'
import { showErrors } from '../../src/v2/form-errors.ts'
import { definePhoneField } from '../../src/v2/phone-field.ts'

afterEach(() => {
  document.body.replaceChildren()
})

const signIn = `<form>
  <e-text-field label="Email"><input name="email" type="email" value="rahim@example.com" autocomplete="email" /></e-text-field>
  <e-text-field label="Password"><input name="password" type="password" value="secret12" /></e-text-field>
</form>`

const written = (lang = 'en') => `<div lang="${lang}"><form>
  <e-text-field label="${lang === 'bn' ? 'ফোন' : 'Phone'}" error="${lang === 'bn' ? '১১ অঙ্ক লিখুন' : 'Enter 11 digits'}"><input name="phone" value="0171" /></e-text-field>
  <e-text-area label="Note" error="Too long"><textarea name="note">Call first</textarea></e-text-area>
  <p>After the fields</p>
</form></div>`

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return [x, y, width, height].map(Math.round)
}

const posted = (form: HTMLFormElement) => [...new FormData(form).entries()].map(([name, value]) => `${name}=${value}`)

const colour = (value: string, property: 'color' | 'backgroundColor' = 'color') => {
  const probe = document.createElement('i')
  probe.style[property] = value
  document.body.append(probe)
  const read = getComputedStyle(probe)[property]
  probe.remove()
  return read
}

// Before the first define: the tags are plain elements, as with v2.js blocked.
test('before the script a sign-in form shows its labels and inputs, and posts email and password', () => {
  expect(customElements.get('e-text-field')).toBeUndefined()
  document.body.innerHTML = signIn
  const form = document.querySelector('form')!
  for (const field of form.querySelectorAll('e-text-field')) {
    expect(getComputedStyle(field, '::before').content).toBe(`"${field.getAttribute('label')}"`)
    const input = field.querySelector('input')!
    expect(input.checkVisibility()).toBe(true)
    // The written input is the box, 44 px on a phone, under the label.
    expect(Math.round(input.getBoundingClientRect().height)).toBe(44)
    expect(input.getBoundingClientRect().width).toBeGreaterThan(200)
  }
  expect(posted(form)).toEqual(['email=rahim@example.com', 'password=secret12'])
})

// One test for both languages: once the tags are defined, every later mount upgrades at once.
test('in en and bn a written error shows under the field with a soft red ring before the script, and the script moves nothing', async () => {
  expect(customElements.get('e-text-field')).toBeUndefined()
  document.body.innerHTML = written('en') + written('bn')
  await document.fonts.ready
  for (const field of document.querySelectorAll('e-text-field')) {
    const input = field.querySelector('input')!
    const message = getComputedStyle(field, '::after')
    expect(message.content).toBe(`"${field.getAttribute('error')}"`)
    expect(message.color).toBe(colour('var(--e-color-returned-fg)'))
    expect(message.fontSize).toBe('13px')
    // Under the input, not in its place: the input keeps its 44 px box above the message.
    expect(Math.round(input.getBoundingClientRect().height)).toBe(44)
    expect(field.getBoundingClientRect().height).toBeGreaterThan(18 + 6 + 44 + 6)
    expect(getComputedStyle(input).borderTopColor).toBe(colour('var(--e-color-returned-fg)'))
    expect(getComputedStyle(input).boxShadow).toContain('3px')
  }
  expect(getComputedStyle(document.querySelector('e-text-area')!, '::after').content).toBe('"Too long"')

  const parts = [...document.querySelectorAll('e-text-field, e-text-field > input, e-text-area, textarea, form > p')]
  const before = parts.map(box)
  defineFields()
  await document.fonts.ready
  expect(parts.map(box)).toEqual(before)
  for (const field of document.querySelectorAll('e-text-field')) {
    expect(field.querySelector(':scope > [data-e-error]')!.textContent).toBe(field.getAttribute('error'))
    expect(getComputedStyle(field, '::after').content).toBe('none')
  }
})

// A phone field's error from the server, as a refused form's page writes it, stays when the script
// builds the field, whether its input is written or not, and a field with a written input moves nothing.
// A field with no written input has no box to show the error under before the script, so it grows then.
test('a phone field keeps an error written in its markup when the script runs, and moves nothing', async () => {
  expect(customElements.get('e-phone-field')).toBeUndefined()
  document.body.innerHTML = `<form>
    <e-phone-field label="Mobile" error="Enter a mobile number"><input name="phone" required /></e-phone-field>
    <p>After the fields</p>
    <e-phone-field label="Mobile" name="other" value="01712345678" error="This number already has an account"></e-phone-field>
  </form>`
  await document.fonts.ready
  const fields = [...document.querySelectorAll('e-phone-field')]
  const written = fields[0]!
  expect(getComputedStyle(written, '::after').content).toBe('"Enter a mobile number"')
  const parts = [written, written.querySelector('input')!, document.querySelector('form > p')!]
  const before = parts.map(box)
  definePhoneField()
  await document.fonts.ready
  expect(fields.map((field) => field.getAttribute('error'))).toEqual([
    'Enter a mobile number',
    'This number already has an account',
  ])
  expect(fields.map((field) => field.querySelector('[data-e-error]')?.textContent)).toEqual([
    'Enter a mobile number',
    'This number already has an account',
  ])
  expect(parts.map(box)).toEqual(before)
})

test('the script adopts the written input: the same element, labelled, and each field posts once', async () => {
  document.body.innerHTML = signIn
  const inputs = [...document.querySelectorAll('input')]
  defineFields()
  const form = document.querySelector('form')!
  expect([...form.querySelectorAll('input')]).toEqual(inputs)
  await expect.element(page.getByRole('textbox', { name: 'Email' })).toHaveValue('rahim@example.com')
  expect(page.getByLabelText('Password').element()).toBe(inputs[1])
  // The written input's own type and autocomplete stay.
  expect([inputs[0]!.type, inputs[0]!.autocomplete, inputs[1]!.type]).toEqual(['email', 'email', 'password'])
  expect(posted(form)).toEqual(['email=rahim@example.com', 'password=secret12'])
  // The label is built, so the ::before has gone.
  expect(getComputedStyle(form.querySelector('e-text-field')!, '::before').content).toBe('none')
})

// A sign-in form written with its labels too, so its fields have names before the script and with it
// off: the script keeps the written label and the input's id.
test.for([
  ['e-text-field', 'type="email"'],
  ['e-phone-field', ''],
] as const)('a written label and input id stay in %s, the one label naming the field', async ([tag, type]) => {
  defineFields()
  definePhoneField()
  document.body.innerHTML = `<form><${tag} label="Email"
    ><label for="signin-email">Email</label><input id="signin-email" name="email" ${type}
  /></${tag}></form>`
  const field = document.querySelector(tag)!
  expect(field.querySelectorAll('label')).toHaveLength(1)
  const input = field.querySelector('input')!
  expect(input.id).toBe('signin-email')
  expect(page.getByLabelText('Email').element()).toBe(input)
  field.setAttribute('label', 'ইমেইল')
  expect(field.querySelector('label')!.textContent).toBe('ইমেইল')
})

test('labels are 13 px at 500', () => {
  defineFields()
  definePhoneField()
  document.body.innerHTML = `${signIn}<e-phone-field label="Mobile"></e-phone-field>`
  for (const label of document.querySelectorAll('label')) {
    const style = getComputedStyle(label)
    expect([style.fontSize, style.fontWeight]).toEqual(['13px', '500'])
  }
})

test('typing in a field clears an error written in the markup, as it clears one from showErrors', async () => {
  defineFields()
  document.body.innerHTML = written()
  const field = document.querySelector('e-text-field')!
  expect(field.hasAttribute('error')).toBe(true)
  const input = page.getByRole('textbox', { name: 'Phone' })
  await userEvent.type(input, '5')
  expect(field.hasAttribute('error')).toBe(false)
  expect(field.querySelector('[data-e-error]')).toBeNull()
  expect(input.element().getAttribute('aria-invalid')).toBeNull()

  showErrors(document.querySelector('form')!, [{ field: ['phone'], message: 'Enter 11 digits' }])
  expect(field.getAttribute('error')).toBe('Enter 11 digits')
  await userEvent.type(input, '6')
  expect(field.hasAttribute('error')).toBe(false)
})

test('a field the script builds still builds its own input, and a script setting the value keeps the error', () => {
  defineFields()
  document.body.innerHTML =
    '<form><e-text-field label="City" name="city" value="Sylhet" error="We do not deliver there"></e-text-field></form>'
  const field = document.querySelector('e-text-field')!
  const input = field.querySelector('input')!
  expect([input.name, input.value]).toEqual(['city', 'Sylhet'])
  input.value = 'Dhaka'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  // Only a person's typing is a correction.
  expect(field.getAttribute('error')).toBe('We do not deliver there')
})
