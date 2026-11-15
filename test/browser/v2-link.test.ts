import { afterEach, expect, test } from 'vitest'
// e-link: CSS styles the <a> the page wrote, so the link works with no script at all.
import { page, userEvent } from 'vitest/browser'

import '../../src/v2.css'

afterEach(() => {
  document.body.replaceChildren()
})

function mount(html: string): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = html
  document.body.append(holder)
  return holder
}

const root = () => getComputedStyle(document.documentElement)

test('the link is a real anchor, in the kit text colour, underlined', async () => {
  mount('<p>See <e-link><a href="/orders">Orders</a></e-link> for more.</p>')
  const link = page.getByRole('link', { name: 'Orders' })
  await expect.element(link).toBeVisible()
  expect(link.element().getAttribute('href')).toBe('/orders')
  const style = getComputedStyle(link.element())
  expect(style.color).toBe(root().getPropertyValue('--e-color-fg').trim())
  expect(style.textDecorationLine).toBe('underline')
  expect(style.fontSize).toBe(getComputedStyle(link.element().closest('p')!).fontSize)
})

test.each([
  ['e-table', '<e-table><e-row><span><e-link><a href="/orders/1042">#1042</a></e-link></span></e-row></e-table>'],
  ['e-card', '<e-card><e-link><a href="/orders/1042">#1042</a></e-link></e-card>'],
])('a link in %s is 550 weight with no underline until hover', async (_name, html) => {
  mount(html)
  const link = page.getByRole('link', { name: '#1042' })
  const anchor = link.element()
  expect([getComputedStyle(anchor).textDecorationLine, getComputedStyle(anchor).fontWeight]).toEqual(['none', '550'])
  await userEvent.hover(link)
  expect(getComputedStyle(anchor).textDecorationLine).toBe('underline')
})

test('a link in a sentence keeps its underline', () => {
  mount('<p>Read the <e-link><a href="/x">guide</a></e-link>.</p>')
  const anchor = page.getByRole('link', { name: 'guide' }).element()
  expect(getComputedStyle(anchor).textDecorationLine).toBe('underline')
})

test('keyboard focus rings the link', async () => {
  mount('<e-link><a href="/orders">Orders</a></e-link>')
  await userEvent.keyboard('{Tab}')
  const link = page.getByRole('link', { name: 'Orders' }).element()
  expect(document.activeElement).toBe(link)
  const style = getComputedStyle(link)
  expect([style.outlineStyle, style.outlineWidth, style.outlineColor]).toEqual([
    'solid',
    '2px',
    root().getPropertyValue('--e-color-focus').trim(),
  ])
})
