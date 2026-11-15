// e-chips: tags and collections as a row of chips. A removable chip gets a × from the script, in room
// v2.css reserved for it, and inside a form the chips keep one named field that the save bar counts.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { watchSaveBars } from '../../src/save-bar.ts'
import { defineChips } from '../../src/v2/chips.ts'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const tags = (attributes = 'name="tags" label="Tags"') =>
  `<e-chips ${attributes}><e-chip value="facebook" removable>Facebook</e-chip><e-chip value="repeat" removable>Repeat customer</e-chip></e-chips>`

const settle = () => new Promise((resolve) => setTimeout(resolve, 50))

const chip = (value: string) => document.querySelector<HTMLElement>(`e-chip[value="${value}"]`)!
const remove = (value: string) => chip(value).querySelector('button')!

function putBack(where: 'start' | 'end') {
  const back = document.createElement('e-chip')
  back.setAttribute('value', 'facebook')
  back.setAttribute('removable', '')
  back.textContent = 'Facebook'
  const chips = document.querySelector('e-chips')!
  if (where === 'start') chips.prepend(back)
  else chips.append(back)
}

// A save-bar form holding the chips, with the bar's state recorded as the app would post it.
function mount(barFirst = false) {
  document.body.innerHTML = `<form data-save-bar>${tags()}</form>`
  const shown: boolean[] = []
  if (!barFirst) defineChips()
  const bar = watchSaveBars(document, (visible) => shown.push(visible))
  if (barFirst) defineChips()
  const form = document.querySelector('form')!
  const field = () => form.querySelector<HTMLInputElement>('input[name="tags"]')!
  return { form, bar, shown, field }
}

// This test runs before any other defines the tags, so it sees the CSS alone first.
test('two chips sit in one 24 px row 8 px apart, and the script adds the × without moving them', () => {
  document.body.innerHTML = tags()
  const [one, two] = document.querySelectorAll('e-chip')
  const before = [one!.getBoundingClientRect(), two!.getBoundingClientRect()]
  expect(document.querySelector('e-chip button')).toBeNull()
  expect(before.map((box) => box.height)).toEqual([24, 24])
  expect(before[1]!.top).toBe(before[0]!.top)
  expect(before[1]!.left - before[0]!.right).toBe(8)
  expect(getComputedStyle(one!).fontSize).toBe('13px')

  defineChips()
  const after = [one!.getBoundingClientRect(), two!.getBoundingClientRect()]
  for (const [index, box] of after.entries()) {
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs(box[key] - before[index]![key])).toBeLessThanOrEqual(1)
    }
  }
  const button = one!.querySelector('button')!
  expect(button.getAttribute('aria-label')).toBe('Remove Facebook')
  expect(button.getBoundingClientRect().width).toBeGreaterThanOrEqual(24)
  expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(after[0]!.right + 1)
})

test('removing a chip writes the field and raises the bar; putting it back at the end lowers it', async () => {
  const { form, shown, field } = mount()
  const inputs: string[] = []
  form.addEventListener('input', (event) => inputs.push((event.target as HTMLInputElement).value))
  expect(field().value).toBe('facebook,repeat')
  expect(field().type).toBe('hidden')
  await userEvent.click(remove('facebook'))
  expect(document.querySelectorAll('e-chip')).toHaveLength(1)
  expect(field().value).toBe('repeat')
  expect(shown).toEqual([true])
  putBack('end')
  await settle()
  expect(field().value).toBe('facebook,repeat')
  expect(shown).toEqual([true, false])
  expect(inputs).toEqual(['repeat', 'facebook,repeat'])
})

test('with the bar watching first, the chips’ field still counts, and a chip put back in its place lowers it', async () => {
  const { shown, field } = mount(true)
  await settle()
  expect(field().value).toBe('facebook,repeat')
  await userEvent.click(remove('facebook'))
  expect(shown).toEqual([true])
  putBack('start')
  await settle()
  expect(field().value).toBe('facebook,repeat')
  expect(shown).toEqual([true, false])
})

test('the bar’s Discard brings a removed chip back in its place and the field to its opening value', async () => {
  const { bar, shown, field } = mount()
  await userEvent.click(remove('facebook'))
  bar.act('discard')
  expect([...document.querySelectorAll('e-chip')].map((one) => one.textContent)).toEqual([
    'Facebook',
    'Repeat customer',
  ])
  expect(field().value).toBe('facebook,repeat')
  expect(shown).toEqual([true, false])
  await settle()
  expect(shown).toEqual([true, false])
})

test('removing fires e-remove with the chip’s value and moves focus to the next chip’s ×', async () => {
  mount()
  const removed: unknown[] = []
  document.addEventListener('e-remove', (event) => removed.push((event as CustomEvent).detail.value), { once: true })
  const next = remove('repeat')
  await userEvent.click(remove('facebook'))
  expect(removed).toEqual(['facebook'])
  expect(document.activeElement).toBe(next)
})

test('without a name, or outside a form, the chips make no field and still remove', async () => {
  document.body.innerHTML = `<form data-save-bar>${tags('label="Tags"')}</form><div>${tags()}</div>`
  defineChips()
  expect(document.querySelectorAll('input')).toHaveLength(0)
  await userEvent.click(document.querySelector<HTMLElement>('div e-chip button')!)
  expect(document.querySelectorAll('div e-chip')).toHaveLength(1)
})

test('at 360 px each × is at least 44 px tall to the touch, and five long chips do not scroll sideways', async () => {
  const long = Array.from(
    { length: 5 },
    (_, index) =>
      `<e-chip value="c${index}" removable>Customers who ordered twice from Facebook in the last ninety days, batch ${index}</e-chip>`,
  ).join('')
  const short = '<e-chip value="vip" removable>VIP</e-chip><e-chip value="dhaka" removable>Dhaka</e-chip>'
  // Room above the first row, so the probe 20 px above it stays on the page.
  document.body.innerHTML = `<div style="padding-top: 24px"><e-chips label="Collections">${short}${long}</e-chips></div>`
  defineChips()
  for (const one of document.querySelectorAll('e-chip')) {
    const button = one.querySelector('button')!
    const box = button.getBoundingClientRect()
    const x = box.left + box.width / 2
    const middle = one.getBoundingClientRect().top + one.getBoundingClientRect().height / 2
    for (const y of [middle - 20, middle, middle + 20]) {
      const hit = document.elementFromPoint(x, y)
      expect(hit === button || button.contains(hit)).toBe(true)
    }
  }
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('a Bangla row names its × in Bangla', () => {
  document.body.innerHTML = `<div lang="bn">${tags()}</div>`
  defineChips()
  expect(remove('facebook').getAttribute('aria-label')).toBe('Facebook সরান')
})
