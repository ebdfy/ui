// On a phone an app's own bottom bar of actions takes the place of the Admin's tab bar.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`
const fixture = `${appOrigin}/test/browser/fixtures`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const tabBar = () => shadow().querySelector<HTMLElement>('nav:not([part])')!
const frame = () => shadow().querySelector<HTMLIFrameElement>('.frame iframe')!
const title = () => shadow().querySelector('[part="title"]')?.textContent ?? ''
const shown = () => tabBar().getBoundingClientRect().height > 0

async function open(src: string, heading: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${src}">
    <a slot="nav" href="#home" aria-current="page">Home</a>
    <a slot="nav" href="#orders">Orders</a>
  </eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(title, { timeout: 10_000 }).toBe(heading)
}

afterEach(async () => {
  await page.viewport(360, 800)
})

test("while the app's page shows a bottom bar the tab bar hides, and the app reaches the screen's foot", async () => {
  await open(`${fixture}/app.html?title=Order&bottom-bar`, 'Order')
  await expect.poll(shown).toBe(false)
  expect(frame().getBoundingClientRect().bottom).toBe(chrome().getBoundingClientRect().bottom)
})

test('the tab bar comes back when the bottom bar goes', async () => {
  await open(`${fixture}/app.html?title=Order&bottom-bar=gone`, 'Order')
  await expect.poll(shown).toBe(false)
  await expect.poll(shown).toBe(true)
})

test('the tab bar comes back when the app moves on by itself to a page with no bottom bar', async () => {
  await open(`${fixture}/app.html?title=Order&bottom-bar`, 'Order')
  await expect.poll(shown).toBe(false)
  frame().contentWindow!.location.href = `${fixture}/app.html?title=Orders`
  await expect.poll(title).toBe('Orders')
  await expect.poll(shown).toBe(true)
})

test('a bottom bar in the page the modal shows leaves the tab bar alone', async () => {
  const sheet = encodeURIComponent('/test/browser/fixtures/app.html?title=Sheet&bottom-bar')
  await open(`${fixture}/modal.html?src=${sheet}`, 'Order')
  await userEvent.click(page.frameLocator(page.elementLocator(frame())).getByRole('button', { name: 'Book courier' }))
  await expect.poll(() => shadow().querySelector('dialog[part="modal"]')?.hasAttribute('open')).toBe(true)
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect(shown()).toBe(true)
})

test('from 600 px the sidebar stays whatever the app shows', async () => {
  await page.viewport(1280, 800)
  await open(`${fixture}/app.html?title=Order&bottom-bar`, 'Order')
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(shown()).toBe(true)
})
