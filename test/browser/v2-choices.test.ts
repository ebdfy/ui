import { afterEach, expect, test } from 'vitest'
// e-choice-list, e-switch and e-date-field: CSS draws each before the script, which then builds the
// native radios, switch or date input in the same places.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineChoiceList } from '../../src/v2/choice-list.ts'
import { defineFields } from '../../src/v2/field.ts'
import { defineSwitch } from '../../src/v2/switch.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function near(before: ReturnType<typeof box>, after: ReturnType<typeof box>): string[] {
  return (Object.keys(before) as (keyof typeof before)[])
    .filter((key) => Math.abs(before[key] - after[key]) > 1)
    .map((key) => `${key} ${before[key]} -> ${after[key]}`)
}

const payment =
  '<e-choice-list label="Payment" name="payment"><option value="cod" selected>Cash on delivery</option><option value="bkash">bKash</option></e-choice-list>'
const sms = '<e-switch label="Text the customer" name="sms" checked></e-switch>'
const due = '<e-date-field label="Due" name="due" value="2026-11-05"></e-date-field>'

// The tests above the first define see the CSS alone.
test('before the script the choice list shows its label and a row per option, the chosen one marked', () => {
  const list = mount(payment).firstElementChild!
  expect(getComputedStyle(list, '::before').content).toBe('"Payment"')
  const [cod, bkash] = list.querySelectorAll('option')
  expect([cod!.getBoundingClientRect().height, bkash!.getBoundingClientRect().height]).toEqual([44, 44])
  expect(getComputedStyle(cod!, '::before').backgroundColor).not.toBe(
    getComputedStyle(bkash!, '::before').backgroundColor,
  )
})

test('before the script the switch shows its track and label, and the date field its value', () => {
  const holder = mount(sms + due)
  const toggle = holder.querySelector('e-switch')!
  expect(getComputedStyle(toggle, '::after').content).toBe('"Text the customer"')
  expect(getComputedStyle(toggle, '::before').width).toBe('32px')
  const date = holder.querySelector('e-date-field')!
  expect(getComputedStyle(date, '::before').content).toBe('"Due"')
  // As e-text-field's box: a 44 px target on a phone, 36 px from 600 px.
  expect(getComputedStyle(date, '::after').height).toBe('44px')
})

// Once defined, a tag upgrades as it is mounted, so both widths are measured before the one define.
test('at 360 and 1280 px the script builds each control without moving a box', async () => {
  const holder = mount(payment + sms + due)
  const tags = [...holder.children]
  const measure = () => ({ tags: tags.map(box), rows: [...holder.querySelectorAll('option')].map(box) })
  await page.viewport(1280, 800)
  const wide = measure()
  await page.viewport(360, 800)
  const narrow = measure()
  defineChoiceList()
  defineSwitch()
  defineFields()

  const moved = (before: ReturnType<typeof measure>) => {
    const rows = page
      .getByRole('radio')
      .elements()
      .map((radio) => box(radio.closest('label')!))
    return [
      ...tags.map((tag, i) => near(before.tags[i]!, box(tag))).flat(),
      ...rows.map((row, i) => near(before.rows[i]!, row)).flat(),
    ]
  }
  expect(page.getByRole('radio').elements()).toHaveLength(2)
  expect(moved(narrow)).toEqual([])
  await page.viewport(1280, 800)
  expect(moved(wide)).toEqual([])
  expect(page.getByRole('radio', { name: 'Cash on delivery' }).element()).toBeChecked()
  expect(page.getByRole('switch', { name: 'Text the customer' }).element()).toBeChecked()
  expect((page.getByLabelText('Due').element() as HTMLInputElement).value).toBe('2026-11-05')
  for (const tag of tags) expect(getComputedStyle(tag, '::before').content).toBe('none')
})

test('from 600 px each choice row and the date box are 36 px, and below it 44 px', async () => {
  await page.viewport(1280, 800)
  const holder = mount(payment + due)
  defineChoiceList()
  defineFields()
  const row = holder.querySelector('e-choice-list label')!
  const date = holder.querySelector('e-date-field input')!
  expect([row.getBoundingClientRect().height, date.getBoundingClientRect().height]).toEqual([36, 36])
  await page.viewport(360, 800)
  expect([row.getBoundingClientRect().height, date.getBoundingClientRect().height]).toEqual([44, 44])
})

test('arrow keys move the choice, and a new label renames the group', async () => {
  const list = mount(payment).firstElementChild!
  defineChoiceList()
  await userEvent.click(page.getByRole('radio', { name: 'Cash on delivery' }))
  await userEvent.keyboard('{ArrowDown}')
  expect(page.getByRole('radio', { name: 'bKash' }).element()).toBeChecked()
  list.setAttribute('label', 'পেমেন্ট')
  expect(page.getByRole('radiogroup', { name: 'পেমেন্ট' }).elements()).toHaveLength(1)
})
