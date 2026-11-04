import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/host.ts'
import { phones } from './phones.ts'

const appOrigin = `http://localhost:${location.port}`
const fixtures = `${appOrigin}/test/browser/fixtures`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const modal = () => shadow().querySelector<HTMLDialogElement>('dialog[part="modal"]')
const barText = () => shadow().querySelector('[part="title"]')?.textContent ?? ''
const app = () => page.frameLocator(page.elementLocator(shadow().querySelector('iframe')!))

async function open(query = ''): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/modal.html?store=demo${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(barText, { timeout: 10_000 }).toBe('Order')
}

// Opens the modal the way a person does, with a tap on the app's own button, and waits until it shows:
// it stays unseen until its page has said how tall it is.
async function book(): Promise<HTMLDialogElement> {
  await app().getByRole('button', { name: 'Book courier' }).click()
  await expect.poll(() => modal()?.open, { timeout: 10_000 }).toBe(true)
  await expect.poll(() => modal()!.checkVisibility({ visibilityProperty: true })).toBe(true)
  return modal()!
}

afterEach(async () => {
  await page.viewport(360, 800)
})

test.for(phones)(
  'the modal is a sheet docked to the bottom, full width, drawn by the chrome, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    await open()
    const dialog = await book()
    // The sheet slides up from below the screen, so it is measured once it has come to rest.
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished))
    const box = dialog.getBoundingClientRect()
    expect(box.left).toBe(0)
    expect(box.width).toBe(360)
    expect(Math.abs(box.bottom - height)).toBeLessThanOrEqual(1)
    expect(box.top).toBeGreaterThan(0)
    expect(dialog.getAttribute('aria-label')).toBe('Book courier')
    const frame = dialog.querySelector('iframe')!
    expect(frame.src).toBe(`${fixtures}/sheet.html?store=demo`)
  },
)

// One size a test: each opens the chrome and the modal, which under a full suite's load took 5 s,
// and three in one test ran past its 15 s and kept running into the next test.
test.for([
  { size: 'medium', width: 620 },
  { size: 'small', width: 380 },
  { size: 'large', width: 980 },
])('on a 1280 px desktop a $size modal is a centred dialog $width px wide', async ({ size, width }) => {
  await page.viewport(1280, 800)
  await open(`&size=${size}`)
  const box = (await book()).getBoundingClientRect()
  expect(box.width).toBe(width)
  expect(Math.abs(box.left + box.width / 2 - 640)).toBeLessThanOrEqual(1)
  expect(Math.abs(box.top + box.height / 2 - 400)).toBeLessThanOrEqual(1)
})

test('pressing Escape closes the modal and focus goes back to Book courier in the app', async () => {
  await open()
  await book()
  await expect.poll(barText).toBe('Focused: none')
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => modal()).toBeNull()
  await expect.poll(barText).toBe('Focused: Book courier')
  expect(shadow().activeElement).toBe(shadow().querySelector('iframe'))
})

test('pressing Escape inside the page in the modal closes it too', async () => {
  await open()
  const dialog = await book()
  const sheet = page.frameLocator(page.elementLocator(dialog.querySelector('iframe')!))
  await sheet.getByRole('button', { name: 'Pathao' }).click()
  await userEvent.keyboard('{Escape}')
  await expect.poll(() => modal()).toBeNull()
  await expect.poll(barText).toBe('Focused: Book courier')
})

test('the close button closes the modal and focus goes back to Book courier', async () => {
  await open()
  const dialog = await book()
  const close = dialog.querySelector<HTMLButtonElement>('[part="modal-close"]')!
  expect(close.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  expect(close.getAttribute('aria-label')).toBe('Close')
  await userEvent.click(close)
  await expect.poll(() => modal()).toBeNull()
  await expect.poll(barText).toBe('Focused: Book courier')
})

test('a tap on the backdrop closes the modal and a tap inside it does not', async () => {
  await open()
  const dialog = await book()
  dialog.querySelector<HTMLElement>('[part="modal-title"]')!.click()
  expect(modal()?.open).toBe(true)
  // A tap on the backdrop lands on the dialog element itself.
  dialog.click()
  await expect.poll(() => modal()).toBeNull()
  await expect.poll(barText).toBe('Focused: Book courier')
})

test('while the modal is open Tab stays inside it', async () => {
  await open()
  const dialog = await book()
  for (let press = 0; press < 8; press += 1) {
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement, `press ${press}`).toBe(chrome())
    expect(dialog.contains(shadow().activeElement), `press ${press}`).toBe(true)
  }
})

test('the page in the modal can show a toast and close it', async () => {
  await open()
  const dialog = await book()
  const sheet = page.frameLocator(page.elementLocator(dialog.querySelector('iframe')!))
  await sheet.getByRole('button', { name: 'Book' }).click()
  await expect.poll(() => modal()).toBeNull()
  expect(shadow().querySelector('[part="toast"] span')?.textContent).toBe('Booked')
})

test('the page in the modal cannot change the title bar', async () => {
  await open()
  // The modal shows once its page has said how tall it is, by which time the page has run its title.
  await book()
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(barText()).toBe('Focused: none')
})

test('an open modal closes when the app navigates to another path', async () => {
  await open('&then-go')
  await book()
  await expect.poll(barText, { timeout: 10_000 }).toBe('Next page')
  await expect.poll(() => modal()).toBeNull()
})

test('a modal the app asks for while its page is loading opens once the page has loaded', async () => {
  await open('&at-start')
  await expect.poll(() => modal()?.open, { timeout: 10_000 }).toBe(true)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(modal()?.open).toBe(true)
})

test('a modal page on another origin is refused', async () => {
  for (const src of ['https://evil.example/', '//evil.example/', 'book-courier']) {
    await open(`&src=${encodeURIComponent(src)}`)
    await app().getByRole('button', { name: 'Book courier' }).click()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(modal(), src).toBeNull()
  }
})
