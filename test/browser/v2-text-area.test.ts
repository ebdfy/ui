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
  // An 18 px label line, 6 px between, then four 20 px lines inside 10 px padding and a 1 px border.
  expect(field.getBoundingClientRect().height).toBe(18 + 6 + 102)
})

// Request 33: a text area takes rows, so a policy opens tall enough to read.
test('a text area with rows="10" opens ten lines tall, its box at least 220 px, before the script and after it', async () => {
  const field = mount(
    '<form><e-text-area label="Refund policy" name="refund" rows="10"></e-text-area></form>',
  ).querySelector('e-text-area')!
  // Ten 20 px lines inside 10 px padding and a 1 px border: the box itself is at least 220 px.
  const tall = 10 * 20 + 20 + 2
  expect(Number.parseFloat(getComputedStyle(field, '::after').height)).toBe(tall)
  expect(tall).toBeGreaterThanOrEqual(220)
  const before = box(field)
  defineFields()
  const textarea = field.querySelector('textarea')!
  expect(textarea.getBoundingClientRect().height).toBe(tall)
  expect(textarea.rows).toBe(10)
  expect(near(before, box(field))).toEqual([])
  document.body.replaceChildren()
})

// Safari, Firefox and Chromium before 133 read no typed attr(), so v2.css's rows rule is not there.
test('where the browser reads no typed attr(), a text area with rows="10" opens ten lines tall after the script', () => {
  const removed: { list: CSSGroupingRule | CSSStyleSheet; index: number; text: string }[] = []
  const strip = (list: CSSGroupingRule | CSSStyleSheet) => {
    for (let index = list.cssRules.length - 1; index >= 0; index--) {
      const rule = list.cssRules[index]!
      if (rule instanceof CSSSupportsRule && rule.conditionText.includes('attr(rows')) {
        removed.push({ list, index, text: rule.cssText })
        list.deleteRule(index)
      } else if (rule instanceof CSSGroupingRule) strip(rule)
    }
  }
  for (const sheet of document.styleSheets) strip(sheet)
  expect(removed).toHaveLength(1)
  try {
    defineFields()
    const field = mount('<e-text-area label="Refund policy" name="refund" rows="10"></e-text-area>').querySelector(
      'e-text-area',
    )!
    expect(field.querySelector('textarea')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(10 * 20 + 20 + 2)
  } finally {
    for (const { list, index, text } of removed) list.insertRule(text, index)
  }
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
  expect(near({ ...before, y: before.y + 24, height: 102 }, box(field.querySelector('textarea')!))).toEqual([])
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
