// The search field: a 16 px search icon inside its control, and a label that can hide and stay the name.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

afterEach(() => {
  document.body.innerHTML = ''
})

async function search(attributes: string): Promise<Upgraded> {
  document.body.innerHTML = `<eb-search-field ${attributes}></eb-search-field>`
  const el = document.querySelector<Upgraded>('eb-search-field')!
  await el.updateComplete
  return el
}

const part = (el: Upgraded, selector: string) => el.shadowRoot.querySelector<HTMLElement>(selector)!

test('a hidden label stays the searchbox name and takes no box', async () => {
  const el = await search('label="Search orders" label-hidden')
  await expect.element(page.getByRole('searchbox', { name: 'Search orders' })).toBeInTheDocument()
  const box = part(el, 'label').getBoundingClientRect()
  expect(Math.min(box.width, box.height)).toBeLessThanOrEqual(1)
  expect(el.getBoundingClientRect().top).toBeCloseTo(part(el, '.control').getBoundingClientRect().top, 0)
})

test('a shown label sits above the control', async () => {
  const el = await search('label="Search orders"')
  expect(part(el, 'label').getBoundingClientRect().height).toBeGreaterThan(0)
  expect(part(el, '.control').getBoundingClientRect().top).toBeGreaterThan(el.getBoundingClientRect().top + 10)
})

test('a 16 px icon sits 8 to 16 px inside the control, centred, before the text', async () => {
  const el = await search('label="Search orders" label-hidden')
  const icon = part(el, 'svg').getBoundingClientRect()
  const box = part(el, '.control').getBoundingClientRect()
  expect([icon.width, icon.height]).toEqual([16, 16])
  expect(icon.left - box.left).toBeGreaterThanOrEqual(8)
  expect(icon.left - box.left).toBeLessThanOrEqual(16)
  expect(Math.abs(icon.top + icon.height / 2 - (box.top + box.height / 2))).toBeLessThanOrEqual(1)
  expect(Number.parseFloat(getComputedStyle(part(el, '.control')).paddingInlineStart)).toBeGreaterThanOrEqual(32)
})

test('the icon takes the third text colour in the dark theme', async () => {
  const el = await search('label="Search orders" label-hidden')
  const found = await inDark(async () => {
    const probe = document.body.appendChild(document.createElement('div'))
    probe.style.color = 'var(--eb-color-text-3)'
    const token = getComputedStyle(probe).color
    probe.remove()
    return { icon: getComputedStyle(part(el, 'svg')).color, token }
  })
  expect(found.icon).toBe(found.token)
  expect(found.token).toMatch(/^oklch\(0\.\d+/)
})

// With its label hidden the empty box still says what it searches.
test('a hidden label shows as the placeholder, and a shown one does not repeat there', async () => {
  const hidden = await search('label="Search orders" label-hidden')
  expect((part(hidden, 'input') as HTMLInputElement).placeholder).toBe('Search orders')
  hidden.setAttribute('label', 'অর্ডার খুঁজুন')
  await hidden.updateComplete
  expect((part(hidden, 'input') as HTMLInputElement).placeholder).toBe('অর্ডার খুঁজুন')
  const shown = await search('label="Search orders"')
  expect((part(shown, 'input') as HTMLInputElement).placeholder).toBe('')
})
