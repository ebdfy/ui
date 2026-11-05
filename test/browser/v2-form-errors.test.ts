import { afterEach, expect, test } from 'vitest'
// The v2 form helper: ebdfy.showErrors puts the API's userErrors under the named fields they name,
// shows the rest in a banner at the top of the form, and tells the save bar the save was refused.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { watchSaveBars } from '../../src/save-bar.ts'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineDistrictPicker } from '../../src/v2/district-picker.ts'
import { defineFields } from '../../src/v2/field.ts'
import { showErrors } from '../../src/v2/form-errors.ts'
import { defineSelect } from '../../src/v2/select.ts'
import { defineSwitch } from '../../src/v2/switch.ts'

afterEach(() => {
  document.body.replaceChildren()
})

const customer = `<form data-save-bar>
  <e-text-field label="Name" name="name" value="Rahima Akter"></e-text-field>
  <e-text-field label="Phone" name="phone" value="01707071591"></e-text-field>
  <e-text-field label="Address" name="address.line1" value="House 12, Road 5"></e-text-field>
  <button>Save</button>
</form>`

function mount(): HTMLFormElement {
  document.body.innerHTML = customer
  defineFields()
  const form = document.querySelector('form')!
  form.addEventListener('submit', (event) => event.preventDefault())
  return form
}

test('an error naming phone shows under the phone field and moves focus to it', () => {
  const form = mount()
  showErrors(form, [{ field: ['phone'], message: 'Phone is taken' }])
  const phone = page.getByRole('textbox', { name: 'Phone' }).element()
  expect(phone).toHaveAccessibleDescription('Phone is taken')
  expect(phone.getAttribute('aria-invalid')).toBe('true')
  expect(document.activeElement).toBe(phone)
  expect(phone.closest('e-text-field')!.querySelector('[data-e-error]')!.textContent).toBe('Phone is taken')
})

test('an error naming ["address", "line1"] shows under the field named address.line1', () => {
  const form = mount()
  showErrors(form, [{ field: ['address', 'line1'], message: 'Enter the house and road' }])
  expect(page.getByRole('textbox', { name: 'Address' }).element()).toHaveAccessibleDescription(
    'Enter the house and road',
  )
})

test('an error naming no field, or a field the form lacks, shows in the banner at the top', () => {
  const form = mount()
  showErrors(form, [
    { field: null, message: 'The store is closed for orders' },
    { field: ['email'], message: 'Email is taken' },
  ])
  // The live region announces it, so the banner itself is no alert.
  const banner = form.firstElementChild!
  expect(banner.hasAttribute('data-e-form-errors')).toBe(true)
  expect(banner.textContent).toBe('The store is closed for orders' + 'Email is taken')
  expect(form.querySelectorAll('[aria-invalid]')).toHaveLength(0)
})

test('showing errors again replaces the last ones, and none clears them', () => {
  const form = mount()
  showErrors(form, [{ field: ['phone'], message: 'Phone is taken' }, { message: 'Try again' }])
  showErrors(form, [{ field: ['name'], message: 'Enter a name' }])
  const shown = () => [...form.querySelectorAll('[data-e-error], [data-e-form-errors]')].map((e) => e.textContent)
  expect(shown()).toEqual(['Enter a name'])
  showErrors(form, [])
  expect(form.querySelectorAll('[aria-invalid], [data-e-error], [data-e-form-errors]')).toHaveLength(0)
})

test('a refused save raises the save bar again, and Discard clears the errors', async () => {
  const form = mount()
  const shown: boolean[] = []
  const bar = watchSaveBars(document, (visible) => shown.push(visible))
  await userEvent.fill(page.getByRole('textbox', { name: 'Phone' }), '01811111111')
  bar.act('save')
  expect(shown).toEqual([true, false])

  showErrors(form, [{ field: ['phone'], message: 'Phone is taken' }, { message: 'Try again' }])
  expect(shown).toEqual([true, false, true])

  bar.act('discard')
  expect(shown).toEqual([true, false, true, false])
  expect((page.getByRole('textbox', { name: 'Phone' }).element() as HTMLInputElement).value).toBe('01707071591')
  expect(form.querySelectorAll('[aria-invalid], [data-e-error], [data-e-form-errors]')).toHaveLength(0)
})

test('every message is announced', () => {
  const form = mount()
  showErrors(form, [{ field: ['phone'], message: 'Phone is taken' }, { message: 'Try again' }])
  const live = form.querySelector('[aria-live="assertive"]')!
  expect(live.textContent).toBe('Phone is taken Try again')
})

test("errors naming the picker's address.district and address.upazila show under each select", async () => {
  document.body.innerHTML = `<form><e-district-picker name="address" district="dhaka" upazila="mirpur"></e-district-picker></form>`
  defineDistrictPicker()
  const form = document.querySelector('form')!
  const upazila = page.getByRole('combobox', { name: 'Upazila', exact: true })
  await expect.poll(() => (upazila.element() as HTMLSelectElement).disabled).toBe(false)
  showErrors(form, [
    { field: ['address', 'district'], message: 'We do not deliver there' },
    { field: ['address', 'upazila'], message: 'Choose the thana' },
  ])
  const district = page.getByRole('combobox', { name: 'District', exact: true })
  expect(district.element()).toHaveAccessibleDescription('We do not deliver there')
  expect(upazila.element()).toHaveAccessibleDescription('Choose the thana')
  expect(document.activeElement).toBe(district.element())
  showErrors(form, [])
  expect(form.querySelectorAll('[aria-invalid], [data-e-error]')).toHaveLength(0)
})

test('errors naming an e-select, e-checkbox or e-switch show under each', () => {
  document.body.innerHTML = `<form>
    <e-select label="Channel" name="channel"><option value="facebook">Facebook</option></e-select>
    <e-checkbox label="Send as a gift" name="gift"></e-checkbox>
    <e-switch label="Text the customer" name="sms"></e-switch>
  </form>`
  defineSelect()
  defineCheckbox()
  defineSwitch()
  const form = document.querySelector('form')!
  showErrors(form, [
    { field: ['channel'], message: 'Pick a channel' },
    { field: ['gift'], message: 'Gifts are off' },
    { field: ['sms'], message: 'SMS is off' },
  ])
  expect(page.getByRole('combobox', { name: 'Channel' }).element()).toHaveAccessibleDescription('Pick a channel')
  expect(page.getByRole('checkbox', { name: 'Send as a gift' }).element()).toHaveAccessibleDescription('Gifts are off')
  expect(page.getByRole('switch', { name: 'Text the customer' }).element()).toHaveAccessibleDescription('SMS is off')
  for (const line of form.querySelectorAll('[data-e-error]'))
    expect(line.getBoundingClientRect().height).toBeGreaterThan(0)
})

test('an error naming a plain control inside a layout tag goes to the banner', () => {
  document.body.innerHTML = `<form><e-stack gap="2"><input name="code" aria-label="Code"></e-stack></form>`
  const form = document.querySelector('form')!
  showErrors(form, [{ field: ['code'], message: 'Code is used' }])
  expect(form.querySelector('e-stack')!.hasAttribute('error')).toBe(false)
  expect(form.querySelector('[data-e-form-errors]')!.textContent).toBe('Code is used')
})

test("clearing errors leaves an app's own data-error hooks alone", () => {
  const form = mount()
  const hook = document.createElement('div')
  hook.dataset.error = 'kept'
  form.append(hook)
  showErrors(form, [{ field: ['phone'], message: 'Phone is taken' }])
  showErrors(form, [])
  expect(hook.dataset.error).toBe('kept')
})
