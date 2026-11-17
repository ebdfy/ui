// The area a page with no menu entry of its own belongs to, after a move puts its panel in.
import { afterEach, expect, test } from 'vitest'

import { putPanel } from '../../src/v2-host-panel.ts'

const start = location.pathname + location.search

afterEach(() => {
  history.replaceState(history.state, '', start)
  document.body.replaceChildren()
})

function frameWith(paths: string[]): Element {
  const frame = document.createElement('e-admin-frame')
  const menu = document.createElement('nav')
  menu.slot = 'menu'
  for (const path of paths) {
    const link = document.createElement('a')
    link.href = path
    link.textContent = path
    menu.append(link)
  }
  frame.append(menu, document.createElement('e-admin-panel'))
  document.body.append(frame)
  return frame
}

const marked = (frame: Element) =>
  [...frame.querySelectorAll('a[aria-current]')].map((link) => [link.getAttribute('href'), link.getAttribute('aria-current')])

test('a record under an area with pages of its own belongs to the area whose path holds it', () => {
  const frame = frameWith(['/store/h', '/store/h/orders', '/store/h/orders/drafts', '/store/h/orders/returns'])
  history.replaceState(history.state, '', '/store/h/orders/1042')
  putPanel(frame, document.createElement('e-admin-panel'))
  expect(marked(frame)).toEqual([['/store/h/orders', 'true']])
})

test('a page whose area leads to a page beside it belongs to that area, not to the root that holds both', () => {
  const frame = frameWith(['/store/h', '/store/h/products/import', '/store/h/orders'])
  history.replaceState(history.state, '', '/store/h/products/7')
  putPanel(frame, document.createElement('e-admin-panel'))
  expect(marked(frame)).toEqual([['/store/h/products/import', 'true']])
})
