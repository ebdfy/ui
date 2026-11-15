import { expect, test } from 'vitest'
// A card's slot="actions" children sit on its heading's line at the right. On a phone two stay there
// and the rest fold into a More menu on that line, each a 44 px target, and the script moves nothing.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'
import { defineCard } from '../../src/v2/card.ts'
import { defineMenu } from '../../src/v2/menu.ts'

const card = (id: string, actions: string[], lang = 'en') =>
  `<div lang="${lang}"><e-card id="${id}" heading="Items">${actions
    .map((label) => `<e-button slot="actions">${label}</e-button>`)
    .join('')}<p>Two items</p></e-card></div>`

const cards = [
  card('one', ['Edit']),
  card('two', ['Edit', 'Print']),
  card('three', ['Edit', 'Print', 'Archive']),
  card('bangla', ['সম্পাদনা', 'প্রিন্ট', 'আর্কাইভ'], 'bn'),
].join('')

const box = (element: Element) => {
  const { x, y, width, height } = element.getBoundingClientRect()
  return { x, y, width, height }
}

function near(before: ReturnType<typeof box>, after: ReturnType<typeof box>): string[] {
  return (Object.keys(before) as (keyof typeof before)[])
    .filter((key) => Math.abs(before[key] - after[key]) > 1)
    .map((key) => `${key} ${before[key]} -> ${after[key]}`)
}

const centre = (element: Element) => {
  const { top, height } = element.getBoundingClientRect()
  return top + height / 2
}

const actions = (id: string) => [...document.querySelectorAll(`#${id} > [slot="actions"]`)]
const more = (id: string) => document.querySelector(`#${id} > e-menu`)

// Before the script the heading is the card's ::before and the More box its ::after, which have no
// rect of their own.
function drawn(id: string, pseudo: string): { width: number; height: number } {
  const style = getComputedStyle(document.querySelector(`#${id}`)!, pseudo)
  return { width: Number.parseFloat(style.width), height: Number.parseFloat(style.height) }
}

// The tests run in order and this one defines the tags, so it alone sees the CSS without the script.
test('the script moves no card, action or More box by more than 1 px, at 360 and at 1440', async () => {
  document.body.innerHTML = cards
  // Until the faces load the words are measured in another face, a px wider or narrower.
  await document.fonts.ready
  const parts = [...document.querySelectorAll('e-card, e-card > [slot="actions"]')]
  const before360 = parts.map(box)
  const ids = ['one', 'two', 'three', 'bangla']
  const heading360 = ids.map((id) => drawn(id, '::before'))
  const more360 = ['three', 'bangla'].map((id) => drawn(id, '::after'))
  await page.viewport(1440, 900)
  const before1440 = parts.map(box)
  await page.viewport(360, 800)

  defineCard()
  defineButton()
  defineMenu()
  expect(document.querySelectorAll('e-card > h2')).toHaveLength(4)
  expect(parts.map((part, index) => near(before360[index]!, box(part)))).toEqual(parts.map(() => []))
  for (const [index, id] of ids.entries()) {
    const h2 = box(document.querySelector(`#${id} > h2`)!)
    expect(Math.abs(h2.width - heading360[index]!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(h2.height - heading360[index]!.height)).toBeLessThanOrEqual(1)
  }
  for (const [index, id] of ['three', 'bangla'].entries()) {
    const menu = box(more(id)!)
    expect(Math.abs(menu.width - more360[index]!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(menu.height - more360[index]!.height)).toBeLessThanOrEqual(1)
    const second = actions(id)[1]!.getBoundingClientRect()
    expect(Math.abs(menu.x - (second.right + 8))).toBeLessThanOrEqual(1)
  }
  try {
    await page.viewport(1440, 900)
    expect(parts.map((part, index) => near(before1440[index]!, box(part)))).toEqual(parts.map(() => []))
  } finally {
    await page.viewport(360, 800)
  }
})

test('at 1440 a single action sits on the heading line at the right padding edge', async () => {
  document.body.innerHTML = cards
  try {
    await page.viewport(1440, 900)
    const h2 = document.querySelector('#one > h2')!
    const edit = actions('one')[0]!
    expect(Math.abs(centre(edit) - centre(h2))).toBeLessThanOrEqual(1)
    const right = document.querySelector('#one')!.getBoundingClientRect().right - 1 - 20
    expect(Math.abs(edit.getBoundingClientRect().right - right)).toBeLessThanOrEqual(1)
  } finally {
    await page.viewport(360, 800)
  }
})

test('at 1440 a three-action card shows all three on the heading line and no More', async () => {
  document.body.innerHTML = cards
  try {
    await page.viewport(1440, 900)
    const h2 = document.querySelector('#three > h2')!
    for (const action of actions('three')) {
      expect(box(action).height).toBeGreaterThan(0)
      expect(Math.abs(centre(action) - centre(h2))).toBeLessThanOrEqual(1)
    }
    expect(box(more('three')!).width).toBe(0)
  } finally {
    await page.viewport(360, 800)
  }
})

test('at 360 two actions stay on the heading line, and a third folds into More on that line', async () => {
  document.body.innerHTML = cards
  const two = document.querySelector('#two > h2')!
  for (const action of actions('two')) expect(Math.abs(centre(action) - centre(two))).toBeLessThanOrEqual(1)

  const three = document.querySelector('#three > h2')!
  const [edit, print, archive] = actions('three')
  for (const shown of [edit!, print!, more('three')!]) {
    expect(box(shown).height).toBeGreaterThan(0)
    expect(Math.abs(centre(shown) - centre(three))).toBeLessThanOrEqual(1)
  }
  expect(box(archive!).height).toBe(0)

  let archived = 0
  archive!.addEventListener('click', () => archived++)
  const holder = page.elementLocator(document.querySelector('#three')!)
  await userEvent.click(holder.getByRole('button', { name: 'More' }))
  await userEvent.click(holder.getByRole('menuitem', { name: 'Archive' }))
  expect(archived).toBe(1)
})

test('at 360 each shown action and the More trigger is a 44 px tall target', () => {
  document.body.innerHTML = cards
  const shown = [...actions('two'), ...actions('three').slice(0, 2), more('three')!.querySelector('e-button')!]
  expect(shown.map((part) => box(part).height >= 44)).toEqual(shown.map(() => true))
})

test('in Bangla the More trigger reads আরও', () => {
  document.body.innerHTML = cards
  expect(more('bangla')!.querySelector('[slot="trigger"]')!.textContent).toBe('আরও')
  expect(more('three')!.querySelector('[slot="trigger"]')!.textContent).toBe('More')
})

// The sample relabels its actions, in the buttons they built, when the Admin's language changes.
test('the More menu follows a folded action relabelled, and the trigger follows the language', async () => {
  document.body.innerHTML = cards
  const archive = actions('three')[2]!
  archive.querySelector('button')!.textContent = 'আর্কাইভ'
  document.querySelector('#three')!.parentElement!.lang = 'bn'
  const holder = page.elementLocator(document.querySelector('#three')!)
  await expect.element(holder.getByRole('button', { name: 'আরও' })).toBeInTheDocument()
  await userEvent.click(holder.getByRole('button', { name: 'আরও' }))
  await expect.element(holder.getByRole('menuitem', { name: 'আর্কাইভ' })).toBeVisible()
})

test('a folded icon-only action is named in the menu by its aria-label', async () => {
  document.body.innerHTML = `<e-card id="icons" heading="Items"><e-button slot="actions">Edit</e-button><e-button slot="actions">Print</e-button><e-button slot="actions" aria-label="Delete"><e-icon name="x"></e-icon></e-button></e-card>`
  const holder = page.elementLocator(document.querySelector('#icons')!)
  await userEvent.click(holder.getByRole('button', { name: 'More' }))
  await expect.element(holder.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
})

test('a heading squeezed by its actions keeps its words whole', async () => {
  document.body.innerHTML = `<div style="width: 260px"><e-card id="tight" heading="Deliveries"><e-button slot="actions">Book courier</e-button><e-button slot="actions">Print</e-button></e-card></div>`
  const h2 = document.querySelector('#tight > h2')!
  const range = document.createRange()
  range.selectNodeContents(h2)
  expect(range.getClientRects()).toHaveLength(1)
})
