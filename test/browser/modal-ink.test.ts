// The chrome's modal, its phone sheet and the leave dialog in Ink: surface, 12 px radius, shadow
// level 3 and the overlay edge, which in dark keeps them apart from the page.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/host.ts'
import { inDark } from './colour.ts'
import { phones } from './phones.ts'

const appOrigin = `http://localhost:${location.port}`
const fixtures = `${appOrigin}/test/browser/fixtures`

const ring = {
  light: 'oklch(0.925 0.004 85) 0px 0px 0px 1px inset',
  dark: 'oklch(0.35 0.006 85) 0px 0px 0px 1px inset',
}
const shadow3 = { light: '0px 16px 40px 0px', dark: '0px 18px 48px 0px' }

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const modal = () => shadow().querySelector<HTMLDialogElement>('dialog[part="modal"]')
const app = () => page.frameLocator(page.elementLocator(shadow().querySelector('.frame iframe')!))

async function book(): Promise<HTMLDialogElement> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/modal.html?store=demo"></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Order')
  await app().getByRole('button', { name: 'Book courier' }).click()
  await expect.poll(() => modal()?.open, { timeout: 10_000 }).toBe(true)
  return modal()!
}

function look(element: Element) {
  const style = getComputedStyle(element)
  return { background: style.backgroundColor, radius: style.borderRadius, shadow: style.boxShadow }
}

afterEach(async () => {
  await page.viewport(360, 800)
})

test('at 1280 px the modal is a centred surface with a 12 px radius, shadow 3 and the overlay edge', async () => {
  await page.viewport(1280, 800)
  const dialog = await book()
  const box = dialog.getBoundingClientRect()
  expect(Math.abs(box.left + box.width / 2 - 640)).toBeLessThanOrEqual(1)
  const light = look(dialog)
  expect(light.background).toBe('oklch(1 0 0)')
  expect(light.radius).toBe('12px')
  expect(light.shadow).toContain(ring.light)
  expect(light.shadow).toContain(shadow3.light)
  const dark = await inDark(async () => look(dialog))
  expect(dark.background).toBe('oklch(0.2 0.004 85)')
  expect(dark.shadow).toContain(ring.dark)
  expect(dark.shadow).toContain(shadow3.dark)
})

test.for(phones)(
  'the sheet has a grab handle centred at its top, and at 1280 px the dialog has none, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    const sheet = await book()
    const handle = part('grab-handle')!
    expect(handle.getAttribute('aria-hidden')).toBe('true')
    const box = handle.getBoundingClientRect()
    const top = sheet.getBoundingClientRect().top
    expect([box.width, box.height]).toEqual([36, 4])
    expect(Math.abs(box.left + box.width / 2 - 180)).toBeLessThanOrEqual(1)
    expect(box.top - top).toBe(8)
    expect(look(sheet).radius).toBe('12px 12px 0px 0px')

    await page.viewport(1280, 800)
    expect(part('grab-handle')!.getBoundingClientRect().height).toBe(0)
  },
)

test('a toast from the page in the sheet hangs above the sheet, covering none of its page', async () => {
  const sheet = await book()
  const inner = page.frameLocator(page.elementLocator(sheet.querySelector('iframe')!))
  await inner.getByRole('button', { name: 'Reserve' }).click()
  await expect.poll(() => sheet.querySelector('[part="toast"]')).not.toBeNull()
  const toast = sheet.querySelector('[part="toast"]')!.getBoundingClientRect()
  expect(toast.bottom).toBeLessThanOrEqual(sheet.getBoundingClientRect().top)
  expect(toast.top).toBe(8)
  expect(toast.left).toBeGreaterThanOrEqual(16)
  expect(toast.right).toBeLessThanOrEqual(344)
})

// The toast hangs from the top on every phone: below the sheet's top on a tall one, over its
// header on a short one, and whole on the screen either way, even a long error.
test.for(phones)(
  'a toast over the sheet hangs 8 px from the top, whole on the screen, on a $width x $height phone',
  async ({ width, height }) => {
    await page.viewport(width, height)
    const sheet = await book()
    const inner = page.frameLocator(page.elementLocator(sheet.querySelector('iframe')!))
    await inner.getByRole('button', { name: 'Reserve' }).click()
    await expect.poll(() => sheet.querySelector('[part="toast"]')).not.toBeNull()
    const toast = sheet.querySelector('[part="toast"]')!.getBoundingClientRect()
    expect(toast.top).toBe(8)
    expect(toast.bottom).toBeLessThanOrEqual(height)
    expect(toast.height).toBeGreaterThan(44)
    expect(toast.left).toBeGreaterThanOrEqual(16)
    expect(toast.right).toBeLessThanOrEqual(344)
  },
)

test('the leave dialog is the same surface, radius, shadow and edge in both themes', async () => {
  document.body.innerHTML = `<eb-admin-chrome src="${fixtures}/form.html"><a slot="nav" href="#away">Away</a></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('save-bar'), { timeout: 10_000 }).not.toBeNull()
  document.querySelector<HTMLAnchorElement>('a[slot="nav"]')!.click()
  const dialog = shadow().querySelector<HTMLDialogElement>('dialog.leave')!
  await expect.poll(() => dialog.open).toBe(true)
  const light = look(dialog)
  expect(light).toMatchObject({ background: 'oklch(1 0 0)', radius: '12px' })
  expect(light.shadow).toContain(ring.light)
  expect(light.shadow).toContain(shadow3.light)
  const dark = await inDark(async () => look(dialog))
  expect(dark.shadow).toContain(ring.dark)
  expect(dark.shadow).toContain(shadow3.dark)
  part('stay')!.click()
})
