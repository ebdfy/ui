// The save bar's rules, on the native controls v2's tags build: what raises the bar, what Discard
// and Save do after a save, and how a save the API refused counts.
import { afterEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import { watchSaveBars } from '../../src/save-bar.ts'
import { defineFields } from '../../src/v2/field.ts'
import { showErrors } from '../../src/v2/form-errors.ts'

afterEach(() => {
  document.body.replaceChildren()
})

// A save-bar form in the test page, with the bar's state recorded as the app would post it.
function mount(fields: string) {
  document.body.innerHTML = `<form data-save-bar novalidate>${fields}</form>`
  defineFields()
  const form = document.querySelector('form')!
  const shown: boolean[] = []
  const bar = watchSaveBars(document, (visible) => shown.push(visible))
  const submits: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submits.push(String(new FormData(form).get('note')))
  })
  const input = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)!
  return { form, bar, shown, submits, input }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

test('typing into a named field raises the bar, and typing it back lowers it', async () => {
  const { shown, input } = mount('<e-text-field label="Note" name="note" value="Call first"></e-text-field>')
  await userEvent.type(input('note'), '!')
  expect(shown).toEqual([true])
  await userEvent.keyboard('{Backspace}')
  expect(shown).toEqual([true, false])
})

test('a search field or a field with no name leaves the bar down', async () => {
  const { shown, form } = mount(`<e-search-field label="Find a customer"></e-search-field>
    <e-text-field label="Filter"></e-text-field><input type="search" name="find" /><input />`)
  await userEvent.type(form.querySelector('e-search-field input')!, 'rahim')
  await userEvent.type(form.querySelector('e-text-field input')!, 'x')
  await userEvent.type(form.querySelector('input[name="find"]')!, 'karim')
  await userEvent.type(form.querySelector(':scope > input:not([name])')!, 'y')
  await settle()
  expect(shown).toEqual([])
})

test('a native named input raises the bar too', async () => {
  const { shown, input } = mount('<input name="note" value="a" />')
  await userEvent.type(input('note'), 'b')
  expect(shown).toEqual([true])
})

test('a value a script set without focus goes back on Discard', async () => {
  const { bar, input } = mount(`<e-text-field label="Note" name="note" value="Call first"></e-text-field>
    <e-text-field label="Phone" name="phone" value="01707071591"></e-text-field>`)
  input('phone').value = '01811223344'
  await userEvent.type(input('note'), '!')
  bar.act('discard')
  expect(input('phone').value).toBe('01707071591')
  expect(input('note').value).toBe('Call first')
})

test('after a save, Discard goes back to the saved values', async () => {
  const { bar, input } = mount('<e-text-field label="Note" name="note" value="Call first"></e-text-field>')
  await userEvent.fill(input('note'), 'Call first!')
  bar.act('save')
  await userEvent.fill(input('note'), 'Call first!?')
  bar.act('discard')
  expect(input('note').value).toBe('Call first!')
})

// A file input takes no value from a script but '', so Discard after a save that held a chosen file
// must leave it be, and still put every other field back.
test('after a save holding a chosen file, Discard puts the other fields back and lowers the bar', async () => {
  const { form, bar, shown, input } = mount(`<input type="file" name="csv" />
    <e-text-field label="Note" name="note" value="Call first"></e-text-field>`)
  const chosen = new DataTransfer()
  chosen.items.add(new File(['sku,price\n'], 'products.csv', { type: 'text/csv' }))
  input('csv').files = chosen.files
  input('csv').dispatchEvent(new Event('change', { bubbles: true }))
  bar.act('save')
  await userEvent.fill(input('note'), 'Call first!')
  const discarded: Event[] = []
  form.addEventListener('e-save-discarded', (event) => discarded.push(event))
  expect(() => bar.act('discard')).not.toThrow()
  expect(input('note').value).toBe('Call first')
  expect(input('csv').files?.[0]?.name).toBe('products.csv')
  expect(discarded).toHaveLength(1)
  expect(shown.at(-1)).toBe(false)
})

// Discard cannot put the saved file back, so the file now chosen becomes the saved one and the bar
// does not stay up for good.
test('after a save holding a chosen file, choosing another and pressing Discard lowers the bar', async () => {
  const { bar, shown, input } = mount('<input type="file" name="csv" />')
  const choose = (name: string) => {
    const chosen = new DataTransfer()
    chosen.items.add(new File(['sku,price\n'], name, { type: 'text/csv' }))
    input('csv').files = chosen.files
    input('csv').dispatchEvent(new Event('change', { bubbles: true }))
  }
  choose('products.csv')
  bar.act('save')
  choose('other.csv')
  expect(shown.at(-1)).toBe(true)
  bar.act('discard')
  expect(shown.at(-1)).toBe(false)
  expect(bar.edited()).toBe(false)
})

test('a form added after the page loaded is watched from the moment it appears', async () => {
  const { shown } = mount('')
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
  const { bar, submits, input } = mount('<e-text-field label="Note" name="note" value="Call first"></e-text-field>')
  await userEvent.fill(input('note'), 'Call first!')
  bar.act('save')
  await userEvent.fill(input('note'), 'Call first!?')
  bar.act('save')
  await settle()
  expect(submits).toEqual(['Call first!', 'Call first!?'])
})

test('a save the API rejects is no save: the bar comes back and Discard goes to the values before it', async () => {
  const { form, bar, shown, input } = mount(`<e-text-field label="Note" name="note" value="Call first"></e-text-field>
    <e-text-field label="Phone" name="phone" value="01707071591"></e-text-field>`)
  form.addEventListener('submit', () => {
    setTimeout(() => showErrors(form, [{ field: ['phone'], message: 'Enter an 11-digit phone starting with 01.' }]), 20)
  })
  await userEvent.fill(input('phone'), '0170707159')
  bar.act('save')
  await settle()
  expect(shown.at(-1)).toBe(true)
  await userEvent.type(input('note'), '!')
  bar.act('discard')
  expect(input('phone').value).toBe('01707071591')
  expect(input('note').value).toBe('Call first')
  expect(shown.at(-1)).toBe(false)
})

test('clearing errors after a good save leaves the saved values alone', async () => {
  const { form, bar, shown, input } = mount('<e-text-field label="Note" name="note" value="Call first"></e-text-field>')
  form.addEventListener('submit', () => showErrors(form, []))
  await userEvent.fill(input('note'), 'Call first!')
  bar.act('save')
  await settle()
  expect(shown.at(-1)).toBe(false)
  bar.act('discard')
  expect(input('note').value).toBe('Call first!')
})
