import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/host.ts'
import { contrast, inDark } from './colour.ts'

const appOrigin = `http://localhost:${location.port}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const toastText = () => shadow().querySelector('[part="toast"] span')?.textContent ?? ''
const barText = () => part('title')?.textContent ?? ''
const frame = () => shadow().querySelector('iframe')!

async function open(query: string, until: () => boolean = () => part('toast') !== null): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(until, { timeout: 10_000 }).toBeTruthy()
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300))

test('pressing Undo runs the app handler once and closes the toast', async () => {
  await open('toast=Order+cancelled&undo', () => part('toast-action') !== null)
  expect(part('toast-action')!.textContent!.trim()).toBe('Undo')
  await userEvent.click(part('toast-action')!)
  await expect.poll(barText).toBe('Undone 1')
  expect(part('toast')).toBeNull()
  // The same call again, from a page that stays quiet, still runs nothing.
  frame().contentWindow!.postMessage({ type: 'toastAction', payload: { call: 1 } }, appOrigin)
  await settle()
  expect(barText()).toBe('Undone 1')
})

test('a press meant for an earlier toast runs nothing', async () => {
  await open('toast=First&toast=Second&undo', () => toastText() === 'Second')
  frame().contentWindow!.postMessage({ type: 'toastAction', payload: { call: 1 } }, appOrigin)
  await settle()
  expect(barText()).toBe('Orders')
  frame().contentWindow!.postMessage({ type: 'toastAction', payload: { call: 2 } }, appOrigin)
  await expect.poll(barText).toBe('Undone 1')
})

test("a toast from the page in the modal runs that page's handler, not the app's", async () => {
  // The app's own toast has the same call number, 1, as the sheet's.
  await open('toast=App+toast&undo&actions=%5B%22Open%22%5D&modal', () => part('title-action') !== null)
  await userEvent.click(part('title-action')!)
  await expect.poll(() => shadow().querySelector('dialog[part="modal"]')?.querySelector('iframe')).toBeTruthy()
  const sheet = page.frameLocator(page.elementLocator(shadow().querySelector('dialog[part="modal"] iframe')!))
  await sheet.getByRole('button', { name: 'Reserve' }).click()
  await expect.poll(toastText).toBe('Booked')
  // A person presses it with the modal still open, which makes the rest of the Admin inert.
  await userEvent.click(part('toast-action')!)
  await expect.poll(toastText).toBe('Sheet undone')
  await settle()
  expect(barText()).toBe('Orders')
})

test('the action is inverse-act and reads 4.5:1 on the toast in light and dark', async () => {
  await open('toast=Saved&undo', () => part('toast-action') !== null)
  const look = async () => {
    const colour = getComputedStyle(part('toast-action')!).color
    return { colour, ratio: contrast(colour, getComputedStyle(part('toast')!).backgroundColor) }
  }
  const light = await look()
  const dark = await inDark(look)
  expect(light.colour).toBe('oklch(0.82 0.1 268)')
  expect(dark.colour).toBe('oklch(0.82 0.1 268)')
  expect(light.ratio).toBeGreaterThanOrEqual(4.5)
  expect(dark.ratio).toBeGreaterThanOrEqual(4.5)
})

test('dismiss in an error toast rings in white under keyboard focus', async () => {
  await open('toast=Pathao+did+not+answer&error', () => part('dismiss') !== null)
  for (let press = 0; press < 10 && shadow().activeElement !== part('dismiss'); press += 1) {
    await userEvent.keyboard('{Tab}')
  }
  expect(shadow().activeElement).toBe(part('dismiss'))
  const style = getComputedStyle(part('dismiss')!)
  expect([style.outlineWidth, style.outlineStyle, style.outlineColor]).toEqual(['2px', 'solid', 'oklch(1 0 0)'])
})

test('an action in an error toast is the on-danger white, 4.5:1 on the danger fill', async () => {
  await open('toast=Pathao+did+not+answer&error&undo', () => part('toast-action') !== null)
  const colour = getComputedStyle(part('toast-action')!).color
  expect(colour).toBe('oklch(1 0 0)')
  expect(contrast(colour, getComputedStyle(part('toast')!).backgroundColor)).toBeGreaterThanOrEqual(4.5)
})

test('a toast from a page in the modal that then closes keeps its words but drops the Undo it cannot run', async () => {
  await open('actions=%5B%22Open%22%5D&modal', () => part('title-action') !== null)
  await userEvent.click(part('title-action')!)
  await expect.poll(() => shadow().querySelector('dialog[part="modal"]')?.querySelector('iframe')).toBeTruthy()
  const sheet = page.frameLocator(page.elementLocator(shadow().querySelector('dialog[part="modal"] iframe')!))
  await sheet.getByRole('button', { name: 'Keep' }).click()
  await expect.poll(() => shadow().querySelector('dialog[part="modal"]')).toBeNull()
  await expect.poll(toastText).toBe('Kept')
  expect(part('toast-action')).toBeNull()
})
