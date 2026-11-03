import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import type { EbDistrictPicker } from '../../src/components/district-picker.ts'
import type { EbTextField } from '../../src/components/text-field.ts'
import { showErrors } from '../../src/form-errors.ts'
import { watchSaveBars } from '../../src/save-bar.ts'
import '../../src/v1.ts'

// A save-bar form in the test page, with the bar's state recorded as the app would post it.
async function mount(fields: string) {
  document.body.innerHTML = `<form data-save-bar novalidate>${fields}</form>`
  const form = document.querySelector('form')!
  await Promise.all([...form.querySelectorAll<EbTextField>('*')].map((el) => el.updateComplete))
  const shown: boolean[] = []
  const bar = watchSaveBars(document, (visible) => shown.push(visible))
  const submits: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submits.push(String(new FormData(form).get('note')))
  })
  const field = (name: string) => form.querySelector<EbTextField>(`[name="${name}"]`)!
  const input = (name: string) => field(name).shadowRoot!.querySelector('input')!
  return { form, bar, shown, submits, field, input }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

test('typing into a named field raises the bar, and typing it back lowers it', async () => {
  const { shown, input } = await mount('<eb-text-field name="note" value="Call first"></eb-text-field>')
  await userEvent.type(input('note'), '!')
  expect(shown).toEqual([true])
  await userEvent.keyboard('{Backspace}')
  expect(shown).toEqual([true, false])
})

test('a search field or a field with no name leaves the bar down', async () => {
  const { shown, form } = await mount(`<eb-search-field name="q"></eb-search-field>
    <eb-text-field label="Filter"></eb-text-field><input type="search" name="find" /><input />`)
  const search = form.querySelector('eb-search-field')!.shadowRoot!.querySelector('input')!
  await userEvent.type(search, 'rahim')
  await userEvent.type(form.querySelector('eb-text-field:not([name])')!.shadowRoot!.querySelector('input')!, 'x')
  await userEvent.type(form.querySelector('input[name="find"]')!, 'karim')
  await userEvent.type(form.querySelector('input:not([name])')!, 'y')
  await settle()
  expect(shown).toEqual([])
})

test('a native named input raises the bar too', async () => {
  const { shown, form } = await mount('<input name="note" value="a" />')
  await userEvent.type(form.querySelector('input')!, 'b')
  expect(shown).toEqual([true])
})

test('pressing Discard puts every field back to its value from before the edit and lowers the bar', async () => {
  const { bar, shown, field, input } = await mount(`<eb-text-field name="note" value="Call first"></eb-text-field>
    <eb-checkbox name="gift" checked></eb-checkbox>
    <eb-district-picker name="address" district="Dhaka" area="Mirpur"></eb-district-picker>`)
  await userEvent.fill(input('note'), 'Leave at the gate')
  await userEvent.click(field('gift').shadowRoot!.querySelector('input')!)
  await userEvent.fill(field('address').shadowRoot!.querySelector('input')!, 'Banani')
  bar.act('discard')
  await field('note').updateComplete
  expect(field('note').value).toBe('Call first')
  expect(input('note').value).toBe('Call first')
  expect((field('gift') as unknown as { checked: boolean }).checked).toBe(true)
  expect((field('address') as unknown as { area: string }).area).toBe('Mirpur')
  expect(shown.at(-1)).toBe(false)
})

test('a value a script set without focus goes back on Discard', async () => {
  const { bar, field, input } = await mount(`<eb-text-field name="note" value="Call first"></eb-text-field>
    <eb-phone-field name="phone" value="01707071591"></eb-phone-field>`)
  field('phone').value = '01811223344'
  await userEvent.type(input('note'), '!')
  bar.act('discard')
  await field('phone').updateComplete
  expect(field('phone').value).toBe('01707071591')
  expect(field('note').value).toBe('Call first')
})

test('pressing Save submits the form once and lowers the bar, and a second tap within 1 s does nothing', async () => {
  const { bar, shown, submits, input } = await mount('<eb-text-field name="note" value="Call first"></eb-text-field>')
  await userEvent.type(input('note'), '!')
  bar.act('save')
  bar.act('save')
  await settle()
  expect(submits).toEqual(['Call first!'])
  expect(shown).toEqual([true, false])
})

test('after a save, Discard goes back to the saved values', async () => {
  const { bar, field, input } = await mount('<eb-text-field name="note" value="Call first"></eb-text-field>')
  await userEvent.type(input('note'), '!')
  bar.act('save')
  await userEvent.type(input('note'), '?')
  bar.act('discard')
  await field('note').updateComplete
  expect(field('note').value).toBe('Call first!')
})

test('a form added after the page loaded is watched from the moment it appears', async () => {
  const { shown } = await mount('')
  const late = document.createElement('form')
  late.dataset.saveBar = ''
  late.innerHTML = '<input name="note" value="a" />'
  document.body.append(late)
  await settle()
  late.querySelector('input')!.value = 'changed by a script'
  await userEvent.type(late.querySelector('input')!, 'b')
  expect(shown).toEqual([true])
})

test('an edit made just after a save can be saved at once', async () => {
  const { bar, submits, input } = await mount('<eb-text-field name="note" value="Call first"></eb-text-field>')
  await userEvent.type(input('note'), '!')
  bar.act('save')
  await userEvent.type(input('note'), '?')
  bar.act('save')
  await settle()
  expect(submits).toEqual(['Call first!', 'Call first!?'])
})

test('a save the API rejects is no save: the bar comes back and Discard goes to the values before it', async () => {
  const { form, bar, shown, field, input } = await mount(`<eb-text-field name="note" value="Call first"></eb-text-field>
    <eb-phone-field name="phone" value="01707071591"></eb-phone-field>`)
  form.addEventListener('submit', () => {
    setTimeout(() => showErrors(form, [{ field: ['phone'], message: 'Enter an 11-digit phone starting with 01.' }]), 20)
  })
  await userEvent.fill(field('phone').shadowRoot!.querySelector('input')!, '0170707159')
  bar.act('save')
  await settle()
  expect(shown.at(-1)).toBe(true)
  await userEvent.type(input('note'), '!')
  bar.act('discard')
  await field('phone').updateComplete
  expect(field('phone').value).toBe('01707071591')
  expect(field('note').value).toBe('Call first')
  expect(shown.at(-1)).toBe(false)
})

test('discarding after a refused save clears the errors the refusal showed', async () => {
  const { form, bar, field } = await mount(`<eb-phone-field name="phone" value="01707071591"></eb-phone-field>
    <eb-district-picker name="address" district="Dhaka" area="Mirpur"></eb-district-picker>`)
  // The API answers after the submit, as a fetch does.
  form.addEventListener('submit', () => {
    const errors = [
      { field: ['phone'], message: 'Enter an 11-digit phone starting with 01.' },
      { field: ['address', 'area'], message: 'Name the area.' },
      { message: 'The order changed since you opened it.' },
    ]
    setTimeout(() => showErrors(form, errors), 20)
  })
  await userEvent.fill(field('phone').shadowRoot!.querySelector('input')!, '0170707159')
  bar.act('save')
  await settle()
  const phone = field('phone')
  const picker = form.querySelector<EbDistrictPicker>('eb-district-picker')!
  expect(phone.error).toBe('Enter an 11-digit phone starting with 01.')
  bar.act('discard')
  await phone.updateComplete
  expect(phone.value).toBe('01707071591')
  expect(phone.error).toBe('')
  expect(phone.shadowRoot!.querySelector('input')!.getAttribute('aria-invalid')).toBe('false')
  expect(picker.areaError).toBe('')
  expect(form.querySelector('[data-eb-form-errors]')).toBeNull()
  // A screen reader reading the form finds no word of the refusal either.
  expect(form.querySelector('[data-eb-announce]')?.textContent ?? '').toBe('')
})

test('clearing errors after a good save leaves the saved values alone', async () => {
  const { form, bar, shown, field, input } = await mount(
    '<eb-text-field name="note" value="Call first"></eb-text-field>',
  )
  form.addEventListener('submit', () => showErrors(form, []))
  await userEvent.type(input('note'), '!')
  bar.act('save')
  await settle()
  expect(shown.at(-1)).toBe(false)
  bar.act('discard')
  expect(field('note').value).toBe('Call first!')
})
