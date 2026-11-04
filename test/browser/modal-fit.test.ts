// A page in the chrome's modal knows it is in one, draws on the modal's surface and stands as tall
// as its content, so the modal can fit it.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/host.ts'
import { inDark } from './colour.ts'

const appOrigin = `http://localhost:${location.port}`
const fixtures = `${appOrigin}/test/browser/fixtures`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const modal = () => shadow().querySelector<HTMLDialogElement>('dialog[part="modal"]')
const toast = () => shadow().querySelector('[part="toast"] span')?.textContent ?? ''
const app = () => page.frameLocator(page.elementLocator(shadow().querySelector('.frame iframe')!))

async function book(src = '/test/browser/fixtures/modal-page.html'): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/modal.html?src=${encodeURIComponent(src)}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => shadow().querySelector('[part="title"]')?.textContent, { timeout: 10_000 }).toBe('Order')
  await app().getByRole('button', { name: 'Book courier' }).click()
  await expect.poll(() => modal()?.open, { timeout: 10_000 }).toBe(true)
}

afterEach(async () => {
  await page.viewport(360, 800)
})

test("at 1280 px the modal's page knows it is in a dialog, on surface, and stands only as tall as its words", async () => {
  await page.viewport(1280, 800)
  await book()
  await expect.poll(toast, { timeout: 10_000 }).toMatch(/^dialog /)
  const [, fill, height] = toast().match(/^dialog (.+) (\d+)$/)!
  expect(fill).toBe('oklch(1 0 0)')
  // 16 px padding, a 20 px line, 16 px padding.
  expect(Number(height)).toBe(52)
})

test("at 360 px the modal's page knows it is in a sheet, on surface in dark too", async () => {
  await inDark(async () => {
    await book()
    await expect.poll(toast, { timeout: 10_000 }).toMatch(/^sheet oklch\(0\.215 0\.004 85\) \d+$/)
  })
})

test('the same page opened as the app, not in the modal, keeps its ground and its full height', async () => {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/modal-page.html"></eb-admin-chrome>`
  await expect.poll(toast, { timeout: 10_000 }).toMatch(/^none /)
  expect(toast()).toBe(
    `none oklch(0.985 0.002 85) ${Math.round(shadow().querySelector('.frame')!.getBoundingClientRect().height)}`,
  )
})

const sheetFrame = () => modal()!.querySelector('iframe')!
const page4 = (query: string) => `/test/browser/fixtures/modal-page.html?${query}`

test('at 1280 px the dialog is as tall as its page: the header over a 52 px frame', async () => {
  await page.viewport(1280, 800)
  await book()
  await expect.poll(() => sheetFrame().getBoundingClientRect().height, { timeout: 10_000 }).toBe(52)
  const header = shadow().querySelector('[part="modal-header"]')!.getBoundingClientRect()
  expect(modal()!.getBoundingClientRect().height).toBe(header.height + 52)
})

test.for([
  [1280, 800, 680],
  [1280, 1000, 720],
  [360, 800, 680],
] as const)(
  'a page taller than the window stops the modal at %i x %i at %i px, scrolling inside',
  async ([width, height, cap]) => {
    await page.viewport(width, height)
    await book(page4('lines=200'))
    await expect.poll(() => modal()!.getBoundingClientRect().height, { timeout: 10_000 }).toBe(cap)
    expect(modal()!.getBoundingClientRect().bottom).toBeLessThanOrEqual(height)
    const frame = sheetFrame().getBoundingClientRect()
    expect(frame.bottom).toBeLessThanOrEqual(modal()!.getBoundingClientRect().bottom)
    expect(frame.height).toBeLessThan(200 * 20)
  },
)

test('a page that grows after it shows grows the modal with it', async () => {
  await page.viewport(1280, 800)
  await book(page4('lines=5&grow'))
  await expect.poll(() => sheetFrame().getBoundingClientRect().height, { timeout: 10_000 }).toBe(52)
  // Each line is 20 px, 12 px below the one before it.
  await expect.poll(() => sheetFrame().getBoundingClientRect().height).toBe(52 + 5 * (12 + 20))
})

test('at 360 px the sheet is as tall as its page and still sits on the screen foot', async () => {
  await book(page4('lines=3'))
  await expect
    .poll(() => sheetFrame().getBoundingClientRect().height, { timeout: 10_000 })
    .toBe(16 + 4 * 24 + 3 * 12 + 16)
  expect(Math.abs(modal()!.getBoundingClientRect().bottom - 800)).toBeLessThanOrEqual(1)
})

test("a desktop dialog's footer buttons are md and keep their own width", async () => {
  await page.viewport(1280, 800)
  await book(page4('bar'))
  await expect.poll(toast, { timeout: 10_000 }).toMatch(/ bar /)
  const [height, ...widths] = toast().split(' bar ')[1]!.split(' ').map(Number)
  expect(height).toBe(36)
  for (const width of widths) expect(width).toBeLessThan(100)
})

test("a phone sheet's footer buttons are 44 px and share the row in equal halves", async () => {
  await book(page4('bar'))
  await expect.poll(toast, { timeout: 10_000 }).toMatch(/ bar /)
  const [height, cancel, book_] = toast().split(' bar ')[1]!.split(' ').map(Number)
  expect(height).toBe(44)
  expect(cancel).toBe(book_)
  // 360 px less the bar's 16 px sides and the 8 px between them.
  expect(cancel! + book_!).toBe(360 - 32 - 8)
})

test('a page that never says how tall it is gets the tallest modal 2 s after it was asked for', async () => {
  await page.viewport(1280, 800)
  await book('/test/browser/fixtures/silent.html')
  expect(modal()!.checkVisibility({ visibilityProperty: true })).toBe(false)
  await expect.poll(() => modal()!.checkVisibility({ visibilityProperty: true }), { timeout: 10_000 }).toBe(true)
  expect(modal()!.getBoundingClientRect().height).toBe(680)
})

test("a page laid out at the frame's full height still stands as tall as its words", async () => {
  await page.viewport(1280, 800)
  await book(page4('full'))
  await expect.poll(() => modal()!.checkVisibility({ visibilityProperty: true }), { timeout: 10_000 }).toBe(true)
  await expect.poll(() => sheetFrame().getBoundingClientRect().height).toBe(52)
})

test('a page that grows and then shrinks takes the modal back down with it', async () => {
  await page.viewport(1280, 800)
  await book(page4('lines=5&grow'))
  await expect.poll(() => sheetFrame().getBoundingClientRect().height, { timeout: 10_000 }).toBe(52 + 5 * 32)
  const sheet = sheetFrame().contentWindow!
  sheet.postMessage({ shrink: true }, appOrigin)
  await expect.poll(() => sheetFrame().getBoundingClientRect().height).toBe(52)
})

test('while the page in the modal loads, the scrim shows at once, and a tap on it closes the modal', async () => {
  await page.viewport(1280, 800)
  await book('/test/browser/fixtures/slow-modal.html')
  expect(getComputedStyle(modal()!, '::backdrop').visibility).toBe('visible')
  expect(modal()!.checkVisibility({ visibilityProperty: true })).toBe(false)
  modal()!.click()
  await expect.poll(() => modal()).toBeNull()
})
