import { afterEach, expect, test } from 'vitest'
// e-checkbox: CSS draws the box and the label before the script, which then builds a native checkbox
// inside without moving anything.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineCheckbox } from '../../src/v2/checkbox.ts'

type Checkbox = HTMLElement & { checked: boolean; indeterminate: boolean }

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

// The computed colour of a token, as the browser resolves it.
function colour(name: string): string {
  const probe = document.createElement('i')
  probe.style.color = `var(${name})`
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

const variants = [
  '<e-checkbox label="Select #1042" hide-label name="a" checked></e-checkbox>',
  '<e-checkbox label="Select #1043" hide-label name="b"></e-checkbox>',
  '<e-checkbox label="Select #1044" hide-label name="c" indeterminate></e-checkbox>',
  '<e-checkbox label="Remember me" name="d"></e-checkbox>',
  '<e-checkbox label="Remember me" name="e" checked></e-checkbox>',
  '<e-checkbox label="মনে রাখুন" name="f" indeterminate disabled></e-checkbox>',
]

const hidden = '<e-checkbox label="Select #1042" hide-label name="x" value="on"></e-checkbox>'

// The tests until the one that defines e-checkbox see the CSS alone.
test('before the script a checked tag draws a ticked 18 px box and an unchecked one an empty box', () => {
  const holder = mount(
    '<e-checkbox label="Select #1042" hide-label checked></e-checkbox><e-checkbox label="Select #1043" hide-label></e-checkbox>',
  )
  const [ticked, empty] = [...holder.querySelectorAll('e-checkbox')].map((tag) => getComputedStyle(tag, '::before'))
  expect([ticked!.width, ticked!.height, ticked!.backgroundColor]).toEqual([
    '18px',
    '18px',
    colour('--e-color-primary'),
  ])
  expect([empty!.width, empty!.height, empty!.backgroundColor]).toEqual(['18px', '18px', colour('--e-color-surface')])
  expect(ticked!.borderTopColor).toBe(colour('--e-color-line-2'))
  // The mark is drawn on the box, not in text.
  expect(ticked!.backgroundImage).toContain('gradient')
  expect(empty!.backgroundImage).toBe('none')
  expect(holder.querySelector('e-checkbox')!.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
})

test('before the script a labelled tag shows its label beside the box and hide-label shows none', () => {
  const holder = mount(
    '<e-checkbox label="Remember me"></e-checkbox><e-checkbox label="Select #1042" hide-label></e-checkbox>',
  )
  const [labelled, quiet] = [...holder.querySelectorAll('e-checkbox')]
  expect(getComputedStyle(labelled!, '::after').content).toBe('"Remember me"')
  expect(getComputedStyle(quiet!, '::after').content).toBe('none')
})

test('the script builds one input in each tag without moving any box', async () => {
  const holder = mount(variants.join(''))
  const tags = [...holder.querySelectorAll('e-checkbox')]
  // The page's fonts swap in once loaded, which would move the labels between the two measures.
  await document.fonts.ready
  const at360 = tags.map(box)
  await page.viewport(1280, 800)
  const at1280 = tags.map(box)
  defineCheckbox()

  expect(tags.map((tag) => tag.querySelectorAll('input[type="checkbox"]').length)).toEqual([1, 1, 1, 1, 1, 1])
  expect(tags.flatMap((tag, index) => near(at1280[index]!, box(tag)))).toEqual([])
  // The 18 px input stands where the 18 px box stood: the tag's left edge, centred on the line.
  const input = tags[0]!.querySelector('input')!
  expect(near({ x: at1280[0]!.x, y: at1280[0]!.y, width: 18, height: 18 }, box(input))).toEqual([])
  await page.viewport(360, 800)
  expect(tags.flatMap((tag, index) => near(at360[index]!, box(tag)))).toEqual([])
  expect(near({ x: at360[0]!.x + 13, y: at360[0]!.y + 13, width: 18, height: 18 }, box(input))).toEqual([])

  // A second define, or the tag moving in the page, never builds a second input.
  defineCheckbox()
  holder.append(tags[0]!)
  expect(tags[0]!.querySelectorAll('input')).toHaveLength(1)
  // The initial state came from the attributes.
  expect(tags.map((tag) => (tag as Checkbox).checked)).toEqual([true, false, false, false, true, false])
  expect(tags.map((tag) => tag.querySelector('input')!.indeterminate)).toEqual([false, false, true, false, false, true])
})

test('the hide-label input is a checkbox named by the label, and a click ticks it and tells the document', async () => {
  defineCheckbox()
  const holder = mount(hidden)
  const changes: string[] = []
  document.addEventListener('change', (event) => changes.push((event.target as HTMLInputElement).name))
  const input = page.getByRole('checkbox', { name: 'Select #1042' })
  expect(input.elements()).toHaveLength(1)
  await userEvent.click(input)
  expect(changes).toEqual(['x'])
  expect(holder.querySelector('input')!.checked).toBe(true)
  expect((holder.firstElementChild as Checkbox).checked).toBe(true)
})

test('a labelled tag builds a label that ticks the input', async () => {
  defineCheckbox()
  const tag = mount('<e-checkbox label="Remember me" name="r" value="yes"></e-checkbox>').firstElementChild as Checkbox
  await userEvent.click(page.getByText('Remember me'))
  expect(tag.checked).toBe(true)
  expect(tag.querySelector('input')!.value).toBe('yes')
})

test('indeterminate marks the input mixed until the person ticks it', async () => {
  defineCheckbox()
  const tag = mount(hidden).firstElementChild as Checkbox
  const input = tag.querySelector('input')!
  tag.indeterminate = true
  expect([input.indeterminate, input.getAttribute('aria-checked'), tag.getAttribute('indeterminate')]).toEqual([
    true,
    'mixed',
    '',
  ])

  await userEvent.click(page.getByRole('checkbox', { name: 'Select #1042' }))
  expect([
    input.checked,
    input.indeterminate,
    input.getAttribute('aria-checked'),
    tag.hasAttribute('indeterminate'),
  ]).toEqual([true, false, null, false])

  tag.indeterminate = true
  tag.indeterminate = false
  expect([input.indeterminate, input.getAttribute('aria-checked'), tag.indeterminate]).toEqual([false, null, false])
})

test('below 600 px a hide-label tag is at least 44 px square and from 600 px it is the 18 px box', async () => {
  defineCheckbox()
  const tag = mount(hidden).firstElementChild!
  await page.viewport(360, 800)
  const phone = tag.getBoundingClientRect()
  expect([phone.width >= 44, phone.height >= 44]).toEqual([true, true])
  // The box sits in the middle of it and a tap anywhere in it ticks the box.
  const input = tag.querySelector('input')!
  const box = input.getBoundingClientRect()
  expect([box.x - phone.x, box.y - phone.y]).toEqual([13, 13])
  await userEvent.click(page.elementLocator(tag), { position: { x: 2, y: 2 } })
  expect(input.checked).toBe(true)

  await page.viewport(1280, 800)
  const desktop = tag.getBoundingClientRect()
  expect([desktop.width, desktop.height]).toEqual([18, 18])
})

test('a new label attribute renames the control', async () => {
  defineCheckbox()
  const holder = mount(`${hidden}<e-checkbox label="Remember me" name="r"></e-checkbox>`)
  const [quiet, shown] = [...holder.querySelectorAll('e-checkbox')]
  quiet!.setAttribute('label', 'অর্ডার #১০৪২ বাছাই')
  shown!.setAttribute('label', 'আমাকে মনে রাখুন')
  expect(page.getByRole('checkbox', { name: 'অর্ডার #১০৪২ বাছাই' }).elements()).toHaveLength(1)
  expect(page.getByRole('checkbox', { name: 'আমাকে মনে রাখুন' }).elements()).toHaveLength(1)
  expect(shown!.querySelector('label')!.textContent).toBe('আমাকে মনে রাখুন')
})

test('a disabled tag disables its input and a ticked box follows the checked property', () => {
  defineCheckbox()
  const tag = mount('<e-checkbox label="Pick" name="p" disabled></e-checkbox>').firstElementChild as Checkbox
  const input = tag.querySelector('input')!
  expect(input.disabled).toBe(true)
  tag.removeAttribute('disabled')
  expect(input.disabled).toBe(false)
  tag.checked = true
  expect(input.checked).toBe(true)
  expect(getComputedStyle(input).backgroundColor).toBe(colour('--e-color-primary'))
})
