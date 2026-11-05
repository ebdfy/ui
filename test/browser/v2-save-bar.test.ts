import { afterEach, expect, test } from 'vitest'
// The save bar with v2 fields: it watches the native controls the e-* tags build, so a named field
// raises it, an unnamed one never does, Discard puts each back, and Save submits once.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { watchSaveBars } from '../../src/save-bar.ts'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineDistrictPicker } from '../../src/v2/district-picker.ts'
import { defineFields } from '../../src/v2/field.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.lang = 'en'
})

const customer = (lang: 'en' | 'bn') =>
  lang === 'bn'
    ? `<form data-save-bar>
  <e-search-field label="গ্রাহক খুঁজুন"></e-search-field>
  <e-text-area label="নোট" name="note" value="দুইবার বেল বাজান"></e-text-area>
  <e-district-picker district="dhaka" upazila="mirpur"></e-district-picker>
  <e-checkbox label="উপহার হিসেবে পাঠান" name="gift" checked></e-checkbox>
</form>`
    : `<form data-save-bar>
  <e-search-field label="Find a customer"></e-search-field>
  <e-text-area label="Note" name="note" value="Ring the bell twice"></e-text-area>
  <e-district-picker district="dhaka" upazila="mirpur"></e-district-picker>
  <e-checkbox label="Send as a gift" name="gift" checked></e-checkbox>
</form>`

// Mounts the form in a language and watches it; returns each value the bar was shown as and the
// count of submits.
async function mount(lang: 'en' | 'bn' = 'en') {
  document.documentElement.lang = lang
  document.body.innerHTML = customer(lang)
  defineFields()
  defineCheckbox()
  defineDistrictPicker()
  const form = document.querySelector('form')!
  const sent = { submits: 0 }
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    sent.submits++
  })
  // The bar watches from the start, as v2.js's does, before the upazila list arrives on first use.
  const shown: boolean[] = []
  const bar = watchSaveBars(document, (visible) => shown.push(visible))
  const upazila = () => form.querySelectorAll('select')[1]!
  await expect.poll(() => upazila().selectedOptions[0]?.text).toBe(lang === 'bn' ? 'মিরপুর' : 'Mirpur')
  return { form, bar, shown, sent, upazila }
}

test('typing in the named note raises the bar; typing in the unnamed search field does not', async () => {
  const { shown } = await mount()
  // The upazila list arriving is no edit.
  expect(shown).toEqual([])
  await userEvent.type(page.getByRole('searchbox', { name: 'Find a customer' }), 'Rahima')
  expect(shown).toEqual([])
  await userEvent.type(page.getByRole('textbox', { name: 'Note' }), ', then wait')
  expect(shown).toEqual([true])
})

test('Discard puts the note, the district and the checkbox back to their opening values', async () => {
  const { bar, shown, upazila } = await mount()
  await userEvent.fill(page.getByRole('textbox', { name: 'Note' }), 'Leave it at the gate')
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'District' }), 'Chattogram')
  await userEvent.click(page.getByRole('checkbox', { name: 'Send as a gift' }))
  expect(shown).toEqual([true])

  bar.act('discard')
  expect(shown).toEqual([true, false])
  expect((page.getByRole('textbox', { name: 'Note' }).element() as HTMLTextAreaElement).value).toBe(
    'Ring the bell twice',
  )
  expect((page.getByRole('combobox', { name: 'District' }).element() as HTMLSelectElement).value).toBe('dhaka')
  expect(upazila().value).toBe('mirpur')
  expect(page.getByRole('checkbox', { name: 'Send as a gift' }).element()).toBeChecked()
})

test('Save submits once, and a second Save before the answer sends nothing more', async () => {
  const { bar, shown, sent } = await mount()
  await userEvent.click(page.getByRole('checkbox', { name: 'Send as a gift' }))
  bar.act('save')
  bar.act('save')
  expect(sent.submits).toBe(1)
  expect(shown).toEqual([true, false])
})

test('the Bangla form, its opening values in the markup, raises no bar until a field changes', async () => {
  const { shown } = await mount('bn')
  expect(shown).toEqual([])
  await userEvent.click(page.getByRole('checkbox', { name: 'উপহার হিসেবে পাঠান' }))
  expect(shown).toEqual([true])
})
