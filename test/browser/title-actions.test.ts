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
const toastText = () => shadow().querySelector('[part="toast"] span')?.textContent ?? ''
const frame = () => shadow().querySelector('iframe')!

async function open(actions: string[], extra = ''): Promise<void> {
  const query = `title=${encodeURIComponent('Order #1042')}&actions=${encodeURIComponent(JSON.stringify(actions))}${extra}`
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(labels, { timeout: 10_000 }).not.toEqual([])
}

test('the bar shows the title and both actions, each a 44 px target inside a 360 px screen', async () => {
  await open(['Book courier', 'Print'])
  expect(shadow().querySelector('[part="title"]')!.textContent).toBe('Order #1042')
  expect(labels()).toEqual(['Book courier', 'Print'])
  for (const button of buttons()) {
    const box = button.getBoundingClientRect()
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.right).toBeLessThanOrEqual(360)
  }
})

test('a third action is dropped and the app is warned', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  createBridge(window).title('Order #1042', { actions: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] })
  expect(warn).toHaveBeenCalledWith('ebdfy: at most 2 title actions')
  warn.mockRestore()
  await open(['Book courier', 'Print', 'Archive'])
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(labels()).toEqual(['Book courier', 'Print'])
})

test("tapping Book courier in the bar runs the app's handler once", async () => {
  await open(['Book courier', 'Print'])
  await userEvent.click(buttons()[0]!)
  await expect.poll(toastText).toBe('Book courier ran 1')
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(toastText()).toBe('Book courier ran 1')
  await userEvent.click(buttons()[1]!)
  await expect.poll(toastText).toBe('Print ran 1')
})

test('a tap meant for an earlier title runs nothing', async () => {
  await open(['Book courier'])
  // The fixture set its title once, so its actions belong to call 1.
  frame().contentWindow!.postMessage({ type: 'titleAction', payload: { call: 0, index: 0 } }, appOrigin)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(toastText()).toBe('')
  frame().contentWindow!.postMessage({ type: 'titleAction', payload: { call: 1, index: 0 } }, appOrigin)
  await expect.poll(toastText).toBe('Book courier ran 1')
})

test('a modal opened from a title action gives focus back to that action when it closes', async () => {
  await open(['Book courier', 'Print'], '&modal')
  await userEvent.click(buttons()[0]!)
  await expect.poll(() => shadow().querySelector<HTMLDialogElement>('dialog[part="modal"]')?.open).toBe(true)
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => shadow().querySelector('dialog[part="modal"]')).toBeNull()
  expect(shadow().activeElement).toBe(buttons()[0])
})
