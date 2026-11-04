// A detail screen's title carries a back button to the page the app names, on the app's own origin.
import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`
const list = '/test/browser/fixtures/app.html?title=Orders'

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const back = () => shadow().querySelector<HTMLButtonElement>('[part="title-back"]')
const title = () => shadow().querySelector('[part="title"]')?.textContent ?? ''

async function open(backTo: string | null, heading = 'Order #1039'): Promise<void> {
  const query = `title=${encodeURIComponent(heading)}${backTo === null ? '' : `&back=${encodeURIComponent(backTo)}`}`
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(title, { timeout: 10_000 }).toBe(heading)
}

test('a title with back draws a 44 px Back button with a chevron before the title', async () => {
  await open(list)
  const button = back()!
  expect(button.getAttribute('aria-label')).toBe('Back')
  expect(button.querySelector('svg')).not.toBeNull()
  const box = button.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([44, 44])
  expect(box.right).toBeLessThanOrEqual(shadow().querySelector('[part="title"]')!.getBoundingClientRect().left)
})

test('tapping Back opens the page it names in the frame, whose own title has none', async () => {
  await open(list)
  await userEvent.click(back()!)
  await expect.poll(title).toBe('Orders')
  expect(shadow().querySelector('iframe')!.src).toBe(`${appOrigin}${list}`)
  expect(back()).toBeNull()
})

test('a title with no back, or a back that leaves the app, draws no Back button', async () => {
  await open(null)
  expect(back()).toBeNull()
  for (const away of ['https://example.com/', '//example.com/orders', 'javascript:alert(1)']) {
    await open(away, `Away ${away}`)
    expect(back(), away).toBeNull()
  }
})

test("a title with back from any window but the app's frame changes nothing", async () => {
  await open(null)
  window.postMessage({ type: 'title', payload: { title: 'Forged', actions: [], call: 9, back: list } }, '*')
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect([title(), back()]).toEqual(['Order #1039', null])
})
