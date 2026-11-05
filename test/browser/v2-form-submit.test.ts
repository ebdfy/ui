import { afterEach, expect, test } from 'vitest'
// Every v2 field submits its value by name in a plain form, through the native control it builds.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineCheckbox } from '../../src/v2/checkbox.ts'
import { defineChoiceList } from '../../src/v2/choice-list.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineSelect } from '../../src/v2/select.ts'
import { defineSwitch } from '../../src/v2/switch.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const define = () => {
  defineFields()
  defineSelect()
  defineCheckbox()
  defineChoiceList()
  defineSwitch()
}

// Mounts the fields in a form with a Save button, and returns what each submit sent.
function form(fields: string): string[] {
  const holder = document.createElement('form')
  holder.innerHTML = `${fields}<button>Save</button>`
  document.body.append(holder)
  define()
  const sent: string[] = []
  holder.addEventListener('submit', (event) => {
    event.preventDefault()
    sent.push(new URLSearchParams(new FormData(holder) as never).toString())
  })
  return sent
}

const save = () => userEvent.click(page.getByRole('button', { name: 'Save' }))

test('an e-select set to Facebook submits channel=facebook', async () => {
  const sent = form(
    '<e-select label="Channel" name="channel"><option value="website">Website</option><option value="facebook">Facebook</option></e-select>',
  )
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'Channel' }), 'Facebook')
  await save()
  expect(sent).toEqual(['channel=facebook'])
})

test('a ticked e-checkbox submits gift=on and an unticked one submits nothing', async () => {
  const sent = form('<e-checkbox label="Send as a gift" name="gift"></e-checkbox>')
  await save()
  await userEvent.click(page.getByRole('checkbox', { name: 'Send as a gift' }))
  await save()
  expect(sent).toEqual(['', 'gift=on'])
})

test('an indeterminate e-checkbox reads mixed, and at 360 px its tag is 44 px tall', () => {
  form('<e-checkbox label="Select all" name="all" indeterminate></e-checkbox>')
  expect(page.getByRole('checkbox', { name: 'Select all' }).element().getAttribute('aria-checked')).toBe('mixed')
  expect(document.querySelector('e-checkbox')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
})

test('an e-choice-list with Cash on delivery chosen submits payment=cod', async () => {
  const sent = form(
    '<e-choice-list label="Payment" name="payment"><option value="bkash" selected>bKash</option><option value="cod">Cash on delivery</option></e-choice-list>',
  )
  expect(page.getByRole('radiogroup', { name: 'Payment' }).elements()).toHaveLength(1)
  await save()
  await userEvent.click(page.getByRole('radio', { name: 'Cash on delivery' }))
  await save()
  expect(sent).toEqual(['payment=bkash', 'payment=cod'])
})

test('an e-date-field set to 5 November 2026 submits due=2026-11-05', async () => {
  const sent = form('<e-date-field label="Due" name="due"></e-date-field>')
  await userEvent.fill(page.getByLabelText('Due'), '2026-11-05')
  await save()
  expect(sent).toEqual(['due=2026-11-05'])
})

test('an e-switch submits sms=on once turned on, and nothing while off', async () => {
  const sent = form('<e-switch label="Text the customer" name="sms"></e-switch>')
  await save()
  const control = page.getByRole('switch', { name: 'Text the customer' })
  await userEvent.click(control)
  await save()
  expect(sent).toEqual(['', 'sms=on'])
  expect(control.element()).toBeChecked()
})
