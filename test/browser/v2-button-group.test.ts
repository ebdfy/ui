import { afterEach, expect, test } from 'vitest'
// e-button-group: CSS lays the buttons in a row before the script, which then adds the group role and
// its label, and keeps aria-pressed on the native buttons without moving anything.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButtonGroup } from '../../src/v2/button-group.ts'
import { defineButton } from '../../src/v2/button.ts'

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

// The chosen button carries `pressed`; each button names itself with `value` for the change event.
const group = `<e-button-group label="Order views">
  <e-button value="all" pressed>All</e-button>
  <e-button value="new">New</e-button>
  <e-button value="ship">To ship</e-button>
</e-button-group>`

const bangla = `<div lang="bn"><e-button-group label="অর্ডারের ভিউ"><e-button value="all" pressed>সব</e-button><e-button value="new">নতুন</e-button></e-button-group></div>`

// The tests above the first define call run before any test defines the tags, so they see the CSS alone.
test('before the script the buttons sit in one row', async () => {
  await page.viewport(800, 600)
  const buttons = [...mount(group).querySelectorAll('e-button')]
  expect(new Set(buttons.map((button) => box(button).y)).size).toBe(1)
  // Joined buttons share one border, so each overlaps the one before by 1 px.
  expect(Math.abs(box(buttons[1]!).x - (box(buttons[0]!).x + box(buttons[0]!).width - 1))).toBeLessThanOrEqual(0.5)
})

test('the script moves nothing in English or Bangla', async () => {
  await page.viewport(800, 600)
  const holder = mount(group + bangla)
  const parts = [...holder.querySelectorAll('e-button-group, e-button')]
  const before = parts.map(box)
  defineButton()
  defineButtonGroup()
  expect(parts.map((part, index) => near(before[index]!, box(part)))).toEqual(parts.map(() => []))
})

test('the group has a role and a label, and the chosen button reads pressed', async () => {
  mount(group)
  await expect.element(page.getByRole('group', { name: 'Order views' })).toBeVisible()
  const pressed = ['All', 'New', 'To ship'].map((name) =>
    page.getByRole('button', { name }).element().getAttribute('aria-pressed'),
  )
  expect(pressed).toEqual(['true', 'false', 'false'])
})

test('a click on New moves the pressed state to it and tells the page which one', async () => {
  const holder = mount(group)
  const heard: unknown[] = []
  holder.addEventListener('e-button-group-change', (event) => heard.push((event as CustomEvent).detail))
  await userEvent.click(page.getByRole('button', { name: 'New' }))
  const pressed = ['All', 'New', 'To ship'].map((name) =>
    page.getByRole('button', { name }).element().getAttribute('aria-pressed'),
  )
  expect(pressed).toEqual(['false', 'true', 'false'])
  expect(heard).toEqual([{ value: 'new' }])

  // The chosen one again changes nothing and says nothing.
  await userEvent.click(page.getByRole('button', { name: 'New' }))
  expect(heard).toHaveLength(1)
})

test('the keyboard chooses a button as a click does', async () => {
  mount(group)
  page.getByRole('button', { name: 'To ship' }).element().focus()
  await userEvent.keyboard('{Enter}')
  expect(page.getByRole('button', { name: 'To ship' }).element().getAttribute('aria-pressed')).toBe('true')
})

test('the app setting pressed on another button updates the group', async () => {
  const holder = mount(group)
  holder.querySelectorAll('e-button')[2]!.setAttribute('pressed', '')
  await expect
    .poll(() =>
      ['All', 'To ship'].map((name) => page.getByRole('button', { name }).element().getAttribute('aria-pressed')),
    )
    .toEqual(['false', 'true'])
  expect(holder.querySelectorAll('e-button[pressed]')).toHaveLength(1)
})

test('at 1440 px the buttons join into one control, and the pressed one is a segment, not the primary fill', async () => {
  await page.viewport(1440, 900)
  try {
    const holder = mount(
      '<e-button-group label="Range"><e-button value="day" pressed>Day</e-button><e-button value="week">Week</e-button></e-button-group>',
    )
    const [first, second] = [...holder.querySelectorAll('e-button')] as [Element, Element]
    expect(Math.abs(box(second).x - (first.getBoundingClientRect().right - 1))).toBeLessThanOrEqual(0.5)
    const root = getComputedStyle(document.documentElement)
    const background = getComputedStyle(first).backgroundColor
    expect(background).toBe(root.getPropertyValue('--e-color-surface-3').trim())
    expect(background).not.toBe(root.getPropertyValue('--e-color-primary').trim())
  } finally {
    await page.viewport(360, 800)
  }
})

test('at 360 px each button is at least 44 px tall', async () => {
  await page.viewport(360, 800)
  const holder = mount(group)
  for (const button of holder.querySelectorAll('e-button')) expect(box(button).height).toBeGreaterThanOrEqual(44)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('a group with no button pressed, such as Previous and Next, stays plain buttons', async () => {
  const holder = mount(
    '<e-button-group label="Pages"><e-button value="previous">Previous</e-button><e-button value="next">Next</e-button></e-button-group>',
  )
  const heard: unknown[] = []
  holder.addEventListener('e-button-group-change', (event) => heard.push((event as CustomEvent).detail))
  await userEvent.click(page.getByRole('button', { name: 'Next' }))
  expect(holder.querySelectorAll('e-button[pressed]')).toHaveLength(0)
  expect(holder.querySelectorAll('[aria-pressed]')).toHaveLength(0)
  expect(heard).toEqual([])
})
