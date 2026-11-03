import { expect, test } from 'vitest'

import type { EbDistrictPicker } from '../../src/components/district-picker.ts'
import type { EbPhoneField } from '../../src/components/phone-field.ts'
import { showErrors } from '../../src/form-errors.ts'
import '../../src/v1.ts'

const phoneError = { field: ['phone'], code: 'INVALID_PHONE', message: 'Enter an 11-digit phone starting with 01.' }

async function mount() {
  document.documentElement.lang = 'en'
  document.body.innerHTML = `<form>
    <eb-text-field name="note" label="Note"></eb-text-field>
    <eb-phone-field name="phone" label="Phone" value="0170707159"></eb-phone-field>
    <eb-district-picker name="address" district="Dhaka"></eb-district-picker>
  </form>`
  const form = document.querySelector('form')!
  const phone = form.querySelector<EbPhoneField>('eb-phone-field')!
  const picker = form.querySelector<EbDistrictPicker>('eb-district-picker')!
  await Promise.all([phone.updateComplete, picker.updateComplete])
  const announced = () => form.querySelector('[aria-live]')?.textContent ?? ''
  const banner = () => form.querySelector('[data-eb-form-errors]')
  return { form, phone, picker, announced, banner }
}

test('a userError shows under the field its path names, and is announced', async () => {
  const { form, phone, announced, banner } = await mount()
  showErrors(form, [phoneError])
  await phone.updateComplete
  expect(phone.shadowRoot!.querySelector('[part="error"]')!.textContent).toBe(phoneError.message)
  expect(form.querySelector('[aria-live]')!.getAttribute('aria-live')).toBe('assertive')
  expect(announced()).toContain(phoneError.message)
  expect(banner()).toBeNull()
})

test('a userError that names no field shows in a banner at the top of the form', async () => {
  const { form, announced, banner } = await mount()
  showErrors(form, [
    { field: null, code: 'THROTTLED', message: 'Too many saves. Wait a minute.' },
    { field: ['shop', 'plan'], code: 'INVALID', message: 'Your plan does not allow this.' },
  ])
  expect(form.firstElementChild).toBe(banner())
  expect(banner()!.textContent).toContain('Too many saves. Wait a minute.')
  expect(banner()!.textContent).toContain('Your plan does not allow this.')
  expect(announced()).toContain('Too many saves. Wait a minute.')
})

test("a userError for address.area shows under the district picker's area", async () => {
  const { form, picker } = await mount()
  showErrors(form, [{ field: ['address', 'area'], code: 'INVALID', message: 'Name the area.' }])
  await picker.updateComplete
  expect(picker.shadowRoot!.querySelector('#area-error')!.textContent).toBe('Name the area.')
  expect(picker.shadowRoot!.querySelector('#error')).toBeNull()
})

test('showing the next errors clears the last ones', async () => {
  const { form, phone, picker, banner } = await mount()
  showErrors(form, [
    phoneError,
    { field: ['address', 'area'], code: 'INVALID', message: 'Name the area.' },
    { field: null, code: 'X', message: 'Try again.' },
  ])
  showErrors(form, [])
  await Promise.all([phone.updateComplete, picker.updateComplete])
  expect(phone.shadowRoot!.querySelector('[part="error"]')).toBeNull()
  expect(picker.shadowRoot!.querySelector('#area-error')).toBeNull()
  expect(banner()).toBeNull()
})

test('the helper is ebdfy.showErrors', () => {
  expect(globalThis.ebdfy.showErrors).toBe(showErrors)
})
