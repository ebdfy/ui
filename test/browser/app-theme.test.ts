// An embedded app follows the Admin's theme: the chrome passes it over the bridge, and only the
// app's own parent can change it.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`
const fixtures = `${appOrigin}/test/browser/fixtures`
const bg = { light: 'oklch(0.985 0.002 85)', dark: 'oklch(0.16 0.004 85)' }

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const barText = () => shadow().querySelector('[part="title"]')?.textContent ?? ''
const modal = () => shadow().querySelector<HTMLDialogElement>('dialog[part="modal"]')
const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

async function open(fixture = 'app.html?theme'): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/${fixture}"></eb-admin-chrome>`
  await chrome().updateComplete
}

afterEach(() => {
  delete document.documentElement.dataset.theme
})

test('with the Admin in dark, the app computes the dark background without setting anything', async () => {
  document.documentElement.dataset.theme = 'dark'
  await open()
  await expect.poll(barText, { timeout: 10_000 }).toBe(`${bg.dark} 1`)
})

test('switching the Admin back to light turns the app light with one theme message', async () => {
  document.documentElement.dataset.theme = 'dark'
  await open()
  await expect.poll(barText, { timeout: 10_000 }).toBe(`${bg.dark} 1`)
  document.documentElement.dataset.theme = 'light'
  await expect.poll(barText).toBe(`${bg.light} 2`)
  await settle()
  expect(barText()).toBe(`${bg.light} 2`)
})

test('an Admin left to the device setting tells the app light on a light device', async () => {
  await open()
  await expect.poll(barText, { timeout: 10_000 }).toBe(`${bg.light} 1`)
})

test("a theme message from a window other than the app's parent is ignored", async () => {
  await open()
  await expect.poll(barText, { timeout: 10_000 }).toBe(`${bg.light} 1`)
  // A sibling frame on the Admin's own origin, so only the source tells it apart from the parent.
  const stranger = document.createElement('iframe')
  document.body.append(stranger)
  const app = shadow().querySelector('iframe')!.contentWindow!
  const forge = new (stranger.contentWindow as Window & typeof globalThis).Function(
    'app',
    "app.postMessage({ type: 'theme', payload: { theme: 'dark' } }, '*')",
  )
  forge(app)
  await expect.poll(barText).toBe(`${bg.light} 2`)
  await settle()
  expect(barText()).toBe(`${bg.light} 2`)
})

test('the page in the modal follows the Admin into dark too', async () => {
  await open('modal.html?store=demo')
  await expect.poll(barText, { timeout: 10_000 }).toBe('Order')
  const app = page.frameLocator(page.elementLocator(shadow().querySelector('.frame iframe')!))
  await app.getByRole('button', { name: 'Book courier' }).click()
  await expect.poll(() => modal()?.open, { timeout: 10_000 }).toBe(true)
  const sheet = page.frameLocator(page.elementLocator(modal()!.querySelector('iframe')!))
  // A trial click waits until the sheet's buttons show, which is once its bridge listens.
  await sheet.getByRole('button', { name: 'Book' }).click({ trial: true })
  document.documentElement.dataset.theme = 'dark'
  await expect.poll(() => modal()?.querySelector('[part="toast"] span')?.textContent).toBe('Theme dark')
})
