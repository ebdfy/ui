import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import type { EbDistrictPicker } from '../../src/components/district-picker.ts'
import '../../src/v1.ts'

async function mount(markup: string, lang = 'en') {
  document.documentElement.lang = lang
  document.body.innerHTML = `<form>${markup}</form>`
  const form = document.querySelector('form')!
  const picker = document.querySelector('eb-district-picker')!
  await picker.updateComplete
  const root = picker.shadowRoot!
  return {
    form,
    picker,
    select: root.querySelector('select')!,
    area: root.querySelector<HTMLInputElement>('input#area')!,
    offered: () => [...root.querySelectorAll('datalist option')].map((o) => o.getAttribute('value')),
  }
}

const entries = (form: HTMLFormElement) => [...new FormData(form)].map(([k, v]) => [k, String(v)])

test('the picker lists the 64 districts by their Bangla names in bn and English names in en', async () => {
  for (const [lang, dhaka] of [
    ['bn', 'ঢাকা'],
    ['en', 'Dhaka'],
  ]) {
    const { select } = await mount('<eb-district-picker></eb-district-picker>', lang)
    const districts = [...select.options].filter((o) => o.value)
    expect(districts).toHaveLength(64)
    expect(districts.find((o) => o.value === 'Dhaka')!.text).toBe(dhaka)
  }
})

test('picking Dhaka then Mirpur submits district Dhaka and area Mirpur', async () => {
  const { form, picker, select, area } = await mount('<eb-district-picker></eb-district-picker>')
  await userEvent.selectOptions(select, 'Dhaka')
  await picker.updateComplete
  await userEvent.fill(area, 'Mirpur')
  await picker.updateComplete
  expect(entries(form)).toEqual([
    ['district', 'Dhaka'],
    ['area', 'Mirpur'],
  ])
})

test('an area typed by hand is kept as typed', async () => {
  const { form, picker, area } = await mount('<eb-district-picker district="Khulna"></eb-district-picker>')
  await userEvent.fill(area, 'House 12 lane')
  await picker.updateComplete
  expect(new FormData(form).get('area')).toBe('House 12 lane')
})

test("for Dhaka the area list offers its upazilas and the city's thanas, in the field's language", async () => {
  const en = await mount('<eb-district-picker district="Dhaka"></eb-district-picker>')
  expect(en.offered()).toEqual(expect.arrayContaining(['Savar', 'Mirpur', 'Dhanmondi', 'Uttara East', 'Uttara West']))
  const bn = await mount('<eb-district-picker district="Dhaka"></eb-district-picker>', 'bn')
  expect(bn.offered()).toEqual(expect.arrayContaining(['সাভার', 'মিরপুর', 'ধানমন্ডি']))
  expect(bn.offered()).not.toContain('Mirpur')
})

test('choosing another district changes the areas offered', async () => {
  const { picker, select, offered } = await mount('<eb-district-picker district="Dhaka"></eb-district-picker>')
  await userEvent.selectOptions(select, 'Chattogram')
  await picker.updateComplete
  expect(offered()).toContain('Patiya')
  expect(offered()).not.toContain('Mirpur')
})

test('a named picker prefixes both entries with its name', async () => {
  const { form } = await mount(
    '<eb-district-picker name="address" district="Dhaka" area="Mirpur"></eb-district-picker>',
  )
  expect(entries(form)).toEqual([
    ['address.district', 'Dhaka'],
    ['address.area', 'Mirpur'],
  ])
})

test('an area error shows under the area, apart from the district', async () => {
  const { picker, area } = await mount('<eb-district-picker district="Dhaka"></eb-district-picker>')
  ;(picker as EbDistrictPicker).areaError = 'Name the area.'
  await picker.updateComplete
  const error = picker.shadowRoot!.querySelector('#area-error')!
  expect(error.textContent).toBe('Name the area.')
  expect(error.getBoundingClientRect().top).toBeGreaterThanOrEqual(area.getBoundingClientRect().bottom)
  expect(area.getAttribute('aria-invalid')).toBe('true')
})
