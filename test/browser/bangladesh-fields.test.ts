import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot; value: string }

async function mount<T extends Upgraded>(markup: string, lang = 'en'): Promise<{ form: HTMLFormElement; field: T }> {
  document.documentElement.lang = lang
  document.body.innerHTML = `<form>${markup}</form>`
  const form = document.querySelector('form')!
  const field = form.firstElementChild as T
  await field.updateComplete
  return { form, field }
}

const input = (field: Upgraded) => field.shadowRoot.querySelector('input')!

test('a phone typed in Bangla digits is stored and shown in Latin digits', async () => {
  const { form, field } = await mount('<eb-phone-field name="phone" label="Phone"></eb-phone-field>', 'bn')
  await userEvent.type(input(field), '০১৭০৭০৭১৫৯১')
  await field.updateComplete
  expect(field.value).toBe('01707071591')
  expect(input(field).value).toBe('01707071591')
  expect(new FormData(form).get('phone')).toBe('01707071591')
})

test('a phone is valid only as 11 digits starting with 01', async () => {
  const { field } = await mount<Upgraded & { checkValidity(): boolean; validationMessage: string }>(
    '<eb-phone-field name="phone" label="Phone"></eb-phone-field>',
  )
  for (const [phone, valid] of [
    ['0170707159', false],
    ['02707071591', false],
    ['017070715912', false],
    ['01707071591', true],
  ] as const) {
    field.value = phone
    await field.updateComplete
    expect(field.checkValidity(), phone).toBe(valid)
  }
  field.value = '0170707159'
  await field.updateComplete
  expect(field.validationMessage).toBe('Enter an 11-digit phone starting with 01.')
})

test('a phone field brings up the phone keypad', async () => {
  const { field } = await mount('<eb-phone-field name="phone" label="Phone"></eb-phone-field>')
  expect(input(field).type).toBe('tel')
})

test('taka in Bangla shows ৳ and lakh grouping in Bangla digits and submits the plain number', async () => {
  const { form, field } = await mount('<eb-taka-field name="price" label="দাম" value="125000"></eb-taka-field>', 'bn')
  expect(field.shadowRoot.querySelector('[part="prefix"]')!.textContent).toBe('৳')
  expect(input(field).value).toBe('১,২৫,০০০')
  expect(new FormData(form).get('price')).toBe('125000')
})

test('taka in English shows lakh grouping in Latin digits', async () => {
  const { field } = await mount('<eb-taka-field name="price" label="Price" value="125000"></eb-taka-field>')
  expect(input(field).value).toBe('1,25,000')
})

test('taka typed in Bangla digits is stored in Latin digits and grouped once the field is left', async () => {
  const { form, field } = await mount('<eb-taka-field name="price" label="দাম"></eb-taka-field>', 'bn')
  await userEvent.click(input(field))
  await userEvent.type(input(field), '২৫০০০০')
  await userEvent.tab()
  await field.updateComplete
  expect(new FormData(form).get('price')).toBe('250000')
  expect(input(field).value).toBe('২,৫০,০০০')
})

test('taka keeps the text as typed while it has focus', async () => {
  const { form, field } = await mount('<eb-taka-field name="price" label="Price" value="125000"></eb-taka-field>')
  await userEvent.click(input(field))
  await userEvent.keyboard('{End}5')
  await field.updateComplete
  expect(input(field).value).toBe('1,25,0005')
  expect(new FormData(form).get('price')).toBe('1250005')
})

test('tabbing into taka selects the whole amount, so typing replaces it', async () => {
  document.documentElement.lang = 'en'
  document.body.innerHTML =
    '<form><input id="before" /><eb-taka-field name="price" label="Price" value="125000"></eb-taka-field></form>'
  const field = document.querySelector('eb-taka-field')! as unknown as Upgraded
  await field.updateComplete
  document.querySelector<HTMLInputElement>('#before')!.focus()
  await userEvent.tab()
  await userEvent.keyboard('900')
  await field.updateComplete
  expect(new FormData(document.querySelector('form')!).get('price')).toBe('900')
})
