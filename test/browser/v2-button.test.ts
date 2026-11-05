import { afterEach, expect, test } from 'vitest'
// e-button: CSS draws it before the script, which then builds one native <button> inside without
// moving it, and an app's own CSS outside any layer restyles it.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'
import { defineButton } from '../../src/v2/button.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.head.querySelector('style[data-app]')?.remove()
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

test('before the script a primary e-button is 44 px tall on a phone, with the primary fill and the label inside', () => {
  const button = mount('<e-button tone="primary">Save</e-button>').firstElementChild!
  const style = getComputedStyle(button)
  expect(button.getBoundingClientRect().height).toBe(44)
  expect(style.display).toBe('inline-flex')
  expect(style.backgroundColor).toBe(
    getComputedStyle(document.documentElement).getPropertyValue('--e-color-primary').trim(),
  )
  expect(style.color).toBe(getComputedStyle(document.documentElement).getPropertyValue('--e-color-primary-fg').trim())
})

test('the script builds exactly one native button, found by role and name, without moving the tag', async () => {
  const holder = mount(
    '<p>Before <e-button tone="primary">Save</e-button> <e-button>Export</e-button> <e-button tone="plain" size="sm">More</e-button> <e-button size="lg">Big</e-button></p>',
  )
  const tags = [...holder.querySelectorAll('e-button')]
  const before = tags.map(box)
  defineButton()
  expect(tags.map((tag) => tag.querySelectorAll('button').length)).toEqual([1, 1, 1, 1])
  expect(tags.flatMap((tag, index) => near(before[index]!, box(tag)))).toEqual([])
  await expect.element(page.getByRole('button', { name: 'Save' })).toBeVisible()
  expect(page.getByRole('button', { name: 'Save' }).elements()).toHaveLength(1)
  // A second define, or the tag moving in the page, never builds a second button.
  defineButton()
  holder.append(tags[0]!)
  expect(tags[0]!.querySelectorAll('button')).toHaveLength(1)
})

test('from 600 px sizes are 28, 36 and 44 px tall, and on a phone every one is a 44 px target', async () => {
  const holder = mount('<e-button size="sm">A</e-button><e-button>B</e-button><e-button size="lg">C</e-button>')
  defineButton()
  const heights = () => [...holder.querySelectorAll('e-button')].map((tag) => tag.getBoundingClientRect().height)
  expect(heights()).toEqual([44, 44, 44])
  await page.viewport(600, 800)
  try {
    expect(heights()).toEqual([28, 36, 44])
  } finally {
    await page.viewport(360, 800)
  }
})

test('a tap on the button fires click on it, and a disabled one is a disabled native button', async () => {
  const holder = mount('<e-button>Save</e-button><e-button disabled>Delete</e-button>')
  defineButton()
  let clicks = 0
  holder.querySelector('e-button')!.addEventListener('click', () => clicks++)
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  expect(clicks).toBe(1)
  await expect.element(page.getByRole('button', { name: 'Delete' })).toBeDisabled()
  holder.querySelectorAll('e-button')[1]!.removeAttribute('disabled')
  await expect.element(page.getByRole('button', { name: 'Delete' })).toBeEnabled()
})

test('inside a form a submit e-button submits it, and type="button" does not', async () => {
  const holder = mount(
    '<form><input name="phone" value="01707071591"><e-button type="button">Preview</e-button><e-button type="submit" tone="primary">Save</e-button></form>',
  )
  defineButton()
  const form = holder.querySelector('form')!
  const submitted: string[] = []
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submitted.push(new URLSearchParams(new FormData(form) as never).toString())
  })
  await userEvent.click(page.getByRole('button', { name: 'Preview' }))
  await userEvent.click(page.getByRole('button', { name: 'Save' }))
  expect(submitted).toEqual(['phone=01707071591'])
})

test("an app's rule outside any layer wins over the kit's, before and after the script", () => {
  const style = document.createElement('style')
  style.dataset.app = ''
  style.textContent = 'e-button { border-radius: 0 }'
  document.head.append(style)
  const button = mount('<e-button tone="primary">Save</e-button>').firstElementChild!
  expect(getComputedStyle(button).borderRadius).toBe('0px')
  defineButton()
  expect(getComputedStyle(button).borderRadius).toBe('0px')
})

test('keyboard focus rings the e-button', async () => {
  mount('<e-button>Save</e-button>')
  defineButton()
  await userEvent.keyboard('{Tab}')
  const tag = document.querySelector('e-button')!
  expect(document.activeElement).toBe(tag.querySelector('button'))
  expect(getComputedStyle(tag).outlineStyle).toBe('solid')
})

test('an icon button is named by its aria-label, which follows a new one', async () => {
  defineButton()
  mount('<e-button aria-label="Add view"><e-icon name="plus"></e-icon></e-button>')
  await expect.element(page.getByRole('button', { name: 'Add view' })).toBeInTheDocument()
  document.querySelector('e-button')!.setAttribute('aria-label', 'ভিউ যোগ করুন')
  await expect.element(page.getByRole('button', { name: 'ভিউ যোগ করুন' })).toBeInTheDocument()
})

test('a hidden button takes no room', () => {
  mount('<e-button hidden>Clear search</e-button>')
  expect(document.querySelector('e-button')!.getBoundingClientRect().height).toBe(0)
})
