import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import { createBridge } from '../../src/bridge.ts'
import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const buttons = () => [...shadow().querySelectorAll<HTMLButtonElement>('[part="title-action"]')]
const labels = () => buttons().map((b) => b.textContent!.trim())
const items = () => [...shadow().querySelectorAll<HTMLElement>('eb-menu-item')]
const toastText = () => shadow().querySelector('[part="toast"] span')?.textContent ?? ''
const more = () => buttons()[1]!

const orderActions = [
  'Book courier',
  {
    label: 'More',
    items: [{ label: 'Print' }, { label: 'Duplicate' }, { label: 'Cancel order', tone: 'critical' }],
  },
]

async function open(): Promise<void> {
  const query = `title=${encodeURIComponent('Order #1001')}&actions=${encodeURIComponent(JSON.stringify(orderActions))}`
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(labels, { timeout: 10_000 }).toEqual(['Book courier', 'More'])
}

test('a title action with items draws as a button that says it opens a menu', async () => {
  await open()
  expect(buttons()[0]!.hasAttribute('aria-haspopup')).toBe(false)
  expect(more().getAttribute('aria-haspopup')).toBe('menu')
  expect(more().getAttribute('aria-expanded')).toBe('false')
  // The whole label shows, as it does on a plain action.
  expect(more().scrollWidth).toBeLessThanOrEqual(more().clientWidth)
  for (const button of buttons()) {
    const box = button.getBoundingClientRect()
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.right).toBeLessThanOrEqual(360)
  }
})

test("tapping More opens a menu of the app's items inside a 360 px screen", async () => {
  await open()
  await userEvent.click(more())
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('true')
  expect(items().map((item) => item.textContent!.trim())).toEqual(['Print', 'Duplicate', 'Cancel order'])
  expect(items().map((item) => item.getAttribute('role'))).toEqual(['menuitem', 'menuitem', 'menuitem'])
  expect(items().map((item) => item.getAttribute('tone'))).toEqual(['default', 'default', 'critical'])
  const box = shadow().querySelector('eb-menu')!.shadowRoot!.querySelector('[popover]')!.getBoundingClientRect()
  expect(box.width).toBeGreaterThan(0)
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(360)
})

test("picking Duplicate runs that item's handler in the app, closes the menu and refocuses More", async () => {
  await open()
  await userEvent.click(more())
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('true')
  await userEvent.click(items()[1]!)
  await expect.poll(toastText).toBe('Duplicate ran 1')
  expect(more().getAttribute('aria-expanded')).toBe('false')
  expect(shadow().activeElement).toBe(more())
})

test('pressing Escape closes the menu and refocuses More', async () => {
  await open()
  await userEvent.click(more())
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('true')
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('false')
  expect(shadow().activeElement).toBe(more())
})

test('the bridge posts menus aligned with the actions and runs only the picked item', () => {
  const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
  const bridge = createBridge(window)
  const onAction = vi.fn()
  const plain = vi.fn()
  bridge.title('X', { actions: [{ label: 'More', onAction: plain, items: [{ label: 'A', onAction }] }] })
  const titled = post.mock.calls.map(([message]) => message).find((message) => message?.type === 'title')
  post.mockRestore()
  expect(titled.payload.actions).toEqual(['More'])
  expect(titled.payload.menus).toEqual([[{ label: 'A' }]])
  const pick = (item: number) =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'titleAction', payload: { call: titled.payload.call, index: 0, item } },
        source: window.parent,
        origin: location.ancestorOrigins[0],
      }),
    )
  pick(0)
  pick(1)
  expect(onAction).toHaveBeenCalledTimes(1)
  expect(plain).not.toHaveBeenCalled()
})

// A press in the app's page lands in another document, which the menu's own light dismiss never
// hears, so the Admin closes it when its window loses focus to the frame.
test('a press in the app closes an open title menu and leaves focus in the app', async () => {
  await open()
  await userEvent.click(more())
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('true')
  const frame = shadow().querySelector<HTMLIFrameElement>('.frame iframe')!
  await userEvent.click(frame)
  await expect.poll(() => more().getAttribute('aria-expanded')).toBe('false')
  expect(shadow().activeElement).toBe(frame)
})
