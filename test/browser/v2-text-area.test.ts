import { afterEach, expect, test } from 'vitest'
// e-text-area: CSS draws the label and a four-line box before the script, which then builds a real
// label and textarea in the same places, and the textarea joins its form.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineFields } from '../../src/v2/field.ts'

afterEach(() => {
  document.body.replaceChildren()
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

const note = '<e-text-area label="Note for the courier" name="note" value="Ring the bell twice"></e-text-area>'

// The tests above the one that defines the fields see the CSS alone.
test('before the script the text area shows its label above a box with its value', () => {
  const field = mount(note).querySelector('e-text-area')!
  const label = getComputedStyle(field, '::before')
  const text = getComputedStyle(field, '::after')
  expect([label.content, text.content]).toEqual(['"Note for the courier"', '"Ring the bell twice"'])
  // An 18 px label line, 6 px between, then four 20 px lines inside 8 px padding and a 1 px border.
  expect(field.getBoundingClientRect().height).toBe(18 + 6 + 98)
})

test('the script builds one labelled textarea without moving anything, and it submits by name', async () => {
  const holder = mount(`<form>${note}<button>Save</button></form>`)
  const field = holder.querySelector('e-text-area')!
  const before = box(field)
  defineFields()

  const textarea = page.getByRole('textbox', { name: 'Note for the courier' })
  expect(textarea.elements()).toHaveLength(1)
  expect(field.querySelector('textarea')!.value).toBe('Ring the bell twice')
  expect(near(before, box(field))).toEqual([])
  expect(near({ ...before, y: before.y + 24, height: 98 }, box(field.querySelector('textarea')!))).toEqual([])
  expect(getComputedStyle(field, '::after').content).toBe('none')

  const form = holder.querySelector('form')!
  const submitted: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitted.push(new URLSearchParams(new FormData(form) as never).toString())
  })
  await userEvent.fill(textarea, 'Call first')
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  expect(submitted).toEqual(['note=Call+first'])
})

test('in Bangla a new label renames the text area', () => {
  const field = mount('<div lang="bn"><e-text-area label="Note" name="note"></e-text-area></div>').querySelector(
    'e-text-area',
  )!
  defineFields()
  field.setAttribute('label', 'কুরিয়ারের জন্য নোট')
  expect(page.getByRole('textbox', { name: 'কুরিয়ারের জন্য নোট' }).elements()).toHaveLength(1)
})
