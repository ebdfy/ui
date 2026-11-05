import { afterEach, expect, test } from 'vitest'
// e-select: CSS draws the selected option in a box before the script, which then builds a native
// select inside and moves the options into it without moving anything.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineSelect } from '../../src/v2/select.ts'

type Select = HTMLElement & { value: string }

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

const sort =
  '<e-select label="Sort" hide-label name="sort"><option value="newest" selected>Newest first</option><option value="oldest">Oldest first</option></e-select>'

const variants = [
  '<e-select label="Sort" name="a"><option value="newest" selected>Newest first</option><option value="oldest">Oldest first</option></e-select>',
  sort,
  '<e-select label="Sort" hide-label name="c"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></e-select>',
  '<e-select label="Sort" hide-label name="d"><option value="newest">Newest first</option><option value="oldest" selected>Oldest first, by the day</option></e-select>',
  '<div lang="bn"><e-select label="সাজান" name="e"><option value="newest" selected>নতুন আগে</option><option value="oldest">পুরনো আগে, তারিখ অনুযায়ী</option></e-select></div>',
  '<div lang="bn"><e-select label="সাজান" hide-label name="f"><option value="newest">নতুন আগে</option><option value="oldest" selected>পুরনো আগে</option></e-select></div>',
]

// The tests until the one that defines e-select see the CSS alone.
test('before the script the tag shows the selected option and hides the others', () => {
  const holder = mount(sort + variants[2])
  const [selected, first] = [...holder.querySelectorAll('e-select')]
  const [newest, oldest] = [...selected!.querySelectorAll('option')]
  expect(newest!.textContent).toBe('Newest first')
  expect([getComputedStyle(newest!).visibility, getComputedStyle(oldest!).visibility]).toEqual(['visible', 'hidden'])
  // With no selected option the first is the one shown.
  const [one, two] = [...first!.querySelectorAll('option')]
  expect([getComputedStyle(one!).visibility, getComputedStyle(two!).visibility]).toEqual(['visible', 'hidden'])
  // A 36 px box with a 1 px border, on a 360 px phone 44 px.
  expect(newest!.getBoundingClientRect().height).toBe(44)
  expect(getComputedStyle(newest!).borderTopColor).toBe(colour('--e-color-line-2'))
  expect(getComputedStyle(selected!).display).toBe('inline-grid')
})

test('before the script a labelled tag shows its label above the box', () => {
  const tag = mount(variants[0]!).firstElementChild!
  expect(getComputedStyle(tag, '::before').content).toBe('"Sort"')
  // An 18 px label line, 6 px between, then the 44 px box on a phone.
  expect(tag.getBoundingClientRect().height).toBe(68)
})

test('the script builds one select in each tag without moving any box', async () => {
  const holder = mount(variants.join(''))
  const tags = [...holder.querySelectorAll('e-select')]
  // The page's fonts swap in once loaded, which would move the texts between the two measures.
  await document.fonts.ready
  const shown = tags.map((tag) => tag.querySelector('option[selected]') ?? tag.querySelector('option')!)
  const at360 = tags.map(box)
  const options360 = shown.map(box)
  await page.viewport(1280, 800)
  const at1280 = tags.map(box)
  const options1280 = shown.map(box)
  defineSelect()

  expect(tags.map((tag) => tag.querySelectorAll('select').length)).toEqual([1, 1, 1, 1, 1, 1])
  expect(tags.map((tag) => tag.querySelectorAll(':scope > option').length)).toEqual([0, 0, 0, 0, 0, 0])
  expect(tags.flatMap((tag, index) => near(at1280[index]!, box(tag)))).toEqual([])
  // The built select takes the place of the shown option.
  expect(tags.flatMap((tag, index) => near(options1280[index]!, box(tag.querySelector('select')!)))).toEqual([])
  expect(at1280[1]!.height).toBe(36)
  await page.viewport(360, 800)
  expect(tags.flatMap((tag, index) => near(at360[index]!, box(tag)))).toEqual([])
  expect(tags.flatMap((tag, index) => near(options360[index]!, box(tag.querySelector('select')!)))).toEqual([])
  expect(at360[1]!.height).toBe(44)

  // A second define, or the tag moving in the page, never builds a second select.
  defineSelect()
  holder.append(tags[0]!)
  expect(tags[0]!.querySelectorAll('select')).toHaveLength(1)
  expect(tags.map((tag) => (tag as Select).value)).toEqual(['newest', 'newest', 'newest', 'oldest', 'newest', 'oldest'])
})

test('choosing Oldest first reads back as oldest and tells the document', async () => {
  defineSelect()
  const tag = mount(sort).firstElementChild as Select
  const changes: string[] = []
  document.addEventListener('change', (event) => changes.push((event.target as HTMLSelectElement).value))
  await userEvent.selectOptions(page.getByRole('combobox', { name: 'Sort' }), 'oldest')
  expect(changes).toEqual(['oldest'])
  expect(tag.value).toBe('oldest')
  tag.value = 'newest'
  expect(tag.querySelector('select')!.value).toBe('newest')
})

test('a labelled tag builds a label that names the select', () => {
  defineSelect()
  const tag = mount(variants[0]!).firstElementChild!
  expect(tag.querySelector('label')!.textContent).toBe('Sort')
  expect(page.getByRole('combobox', { name: 'Sort' }).elements()).toHaveLength(1)
})

test('a new label attribute renames the control', () => {
  defineSelect()
  const holder = mount(sort + variants[0]!.replace('name="a"', 'name="z"').replace('Sort', 'Order'))
  const [quiet, shown] = [...holder.querySelectorAll('e-select')]
  quiet!.setAttribute('label', 'সাজান')
  shown!.setAttribute('label', 'ক্রম')
  expect(page.getByRole('combobox', { name: 'সাজান' }).elements()).toHaveLength(1)
  expect(page.getByRole('combobox', { name: 'ক্রম' }).elements()).toHaveLength(1)
  expect(shown!.querySelector('label')!.textContent).toBe('ক্রম')
})

test('a disabled tag disables its select', () => {
  defineSelect()
  const tag = mount(sort.replace('name="sort"', 'name="sort" disabled')).firstElementChild!
  const select = tag.querySelector('select')!
  expect(select.disabled).toBe(true)
  tag.removeAttribute('disabled')
  expect(select.disabled).toBe(false)
})
