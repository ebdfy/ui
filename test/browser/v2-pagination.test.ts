import { afterEach, expect, test } from 'vitest'
// e-pagination: CSS draws the label and room for two buttons before the script, which then builds
// the buttons and the label text in the same places.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { definePagination } from '../../src/v2/pagination.ts'

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

const english = '<e-pagination label="1–10 of 120" has-previous has-next></e-pagination>'
const bangla = '<div lang="bn"><e-pagination label="১–১০ / ১২০" has-next></e-pagination></div>'

// The tests above the first definePagination() run before any test defines the tag, so they see the CSS alone.
test('before the script e-pagination is a 36 px row showing its label in the muted colour', async () => {
  await page.viewport(800, 600)
  const tag = mount(english).querySelector('e-pagination')!
  const fg2 = getComputedStyle(document.documentElement).getPropertyValue('--e-color-fg2').trim()
  expect(tag.getBoundingClientRect().height).toBe(36)
  expect([getComputedStyle(tag, '::before').content, getComputedStyle(tag, '::before').color]).toEqual([
    '"1–10 of 120"',
    fg2,
  ])
})

test('below 600 px the row is 44 px tall', async () => {
  await page.viewport(360, 800)
  expect(mount(english).querySelector('e-pagination')!.getBoundingClientRect().height).toBe(44)
})

test('the script moves nothing in English or Bangla, and the buttons take the reserved end', async () => {
  await page.viewport(800, 600)
  const holder = mount(english + bangla)
  const tags = [...holder.querySelectorAll('e-pagination')]
  const before = tags.map(box)
  definePagination()
  expect(tags.map((tag, index) => near(before[index]!, box(tag)))).toEqual(tags.map(() => []))

  const [previous, next] = tags[0]!.querySelectorAll('button')
  expect(box(previous!)).toMatchObject({ width: 36, height: 36 })
  const end = before[0]!.x + before[0]!.width
  expect(Math.abs(box(next!).x + 36 - end)).toBeLessThanOrEqual(1)
  expect(tags[0]!.querySelector('e-icon[name="chevron-left"]')).not.toBeNull()
})

test('the Next page button fires e-next and Previous page fires e-previous, both bubbling', async () => {
  const holder = mount(english)
  const heard: string[] = []
  document.addEventListener('e-next', () => heard.push('next'))
  document.addEventListener('e-previous', () => heard.push('previous'))
  await page.getByRole('button', { name: 'Next page' }).click()
  await page.getByRole('button', { name: 'Previous page' }).click()
  expect(heard).toEqual(['next', 'previous'])
  expect(holder.querySelector('e-pagination')!.getAttribute('role')).toBe('navigation')
  await expect.element(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible()
})

test('without has-previous the Previous button is disabled and follows the attribute', async () => {
  const tag = mount('<e-pagination label="1–10 of 120" has-next></e-pagination>').querySelector('e-pagination')!
  const previous = page.getByRole('button', { name: 'Previous page' })
  await expect.element(previous).toBeDisabled()
  tag.setAttribute('has-previous', '')
  await expect.element(previous).toBeEnabled()
  tag.removeAttribute('has-next')
  await expect.element(page.getByRole('button', { name: 'Next page' })).toBeDisabled()
})

test('in a Bangla container the names are Bangla', async () => {
  mount(bangla)
  await expect.element(page.getByRole('button', { name: 'আগের পাতা' })).toBeVisible()
  await expect.element(page.getByRole('button', { name: 'পরের পাতা' })).toBeVisible()
  await expect.element(page.getByRole('navigation', { name: 'পাতা' })).toBeVisible()
})

test('changing label changes the text', () => {
  const tag = mount(english).querySelector('e-pagination')!
  expect(tag.textContent).toBe('1–10 of 120')
  tag.setAttribute('label', '১১–২০ / ১২০')
  expect(tag.textContent).toBe('১১–২০ / ১২০')
})

test("the kit's own words follow the page's language when it switches", async () => {
  definePagination()
  const root = document.documentElement
  const was = root.lang
  try {
    root.lang = 'en'
    mount(english)
    await expect.element(page.getByRole('button', { name: 'Next page' })).toBeInTheDocument()
    root.lang = 'bn'
    await expect.element(page.getByRole('button', { name: 'পরের পাতা' })).toBeInTheDocument()
    await expect.element(page.getByRole('navigation', { name: 'পাতা' })).toBeInTheDocument()
    root.lang = 'en'
    await expect.element(page.getByRole('button', { name: 'Previous page' })).toBeInTheDocument()
  } finally {
    root.lang = was
  }
})
