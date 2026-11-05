// A <form data-save-bar> inside an open e-modal saves from the modal's own footer: the Admin's save
// bar stays down, and closing the modal with unsaved edits asks first.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')
const appFrame = (page: Page): Frame => page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
const view = (page: Page) => page.frameLocator('e-admin-panel iframe')
const dialog = (page: Page) => view(page).getByRole('dialog', { name: 'Confirm order #1042' })
const footerButtons = (page: Page) => dialog(page).locator('footer button:visible').allTextContents()

// Opens #1042's confirm modal and records every save bar message the app sends the Admin.
async function modal(lang: 'en' | 'bn' = 'en'): Promise<{ page: Page; bars: boolean[] }> {
  const { page } = await pages.open('', 1440, { viewport: { width: 1440, height: 900 } })
  await page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-playground-lang', chosen)
    localStorage.setItem('ebdfy-sample-lang', chosen)
  }, lang)
  await page.goto(`${pages.ui}/playground/orders/1042`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).not.toBe('Sample app')
  await appFrame(page).waitForFunction(() => document.querySelector('e-modal > dialog') !== null)
  await page.evaluate(() => {
    const bars: boolean[] = []
    Object.assign(globalThis, { bars })
    addEventListener('message', (event) => {
      if (event.data?.type === 'saveBar') bars.push(event.data.payload?.visible)
    })
  })
  await view(page)
    .getByRole('button', { name: lang === 'bn' ? 'অর্ডার কনফার্ম করুন' : 'Confirm order' })
    .click()
  await expect.poll(() => dialog(page).or(view(page).getByRole('dialog')).first().isVisible()).toBe(true)
  return { page, bars: [] }
}

const barsSent = (page: Page) => page.evaluate(() => (globalThis as unknown as { bars: boolean[] }).bars)
const note = (page: Page) => dialog(page).getByRole('textbox', { name: 'Note for the courier' })

test("typing in the modal's note shows Save and Discard in its footer, and the Admin's bar stays down", async () => {
  const { page } = await modal()
  expect(await footerButtons(page)).toEqual(['Not now', 'Confirm'])
  await note(page).fill('Call before 5 pm')
  await expect.poll(() => footerButtons(page)).toEqual(['Discard', 'Save'])
  expect(await barsSent(page)).not.toContain(true)
})

test('discard puts the note back to its opening text', async () => {
  const { page } = await modal()
  const opening = await note(page).inputValue()
  await note(page).fill('Call before 5 pm')
  await dialog(page).getByRole('button', { name: 'Discard' }).click()
  expect(await note(page).inputValue()).toBe(opening)
  await expect.poll(() => footerButtons(page)).toEqual(['Not now', 'Confirm'])
})

test('save submits the form and the toast "Saved" shows over the modal', async () => {
  const { page } = await modal()
  await note(page).fill('Call before 5 pm')
  await dialog(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.locator('e-admin-panel').getByRole('status').textContent()).toBe('Saved')
  await expect.poll(() => footerButtons(page)).toEqual(['Not now', 'Confirm'])
  expect(await note(page).inputValue()).toBe('Call before 5 pm')
  expect(await dialog(page).isVisible()).toBe(true)
  // The toast lies over the app's frame, not under it.
  const lands = await page.locator('e-admin-panel > .e-toast').evaluate((toast) => {
    const { x, y, width, height } = toast.getBoundingClientRect()
    return toast.contains(document.elementFromPoint(x + width / 2, y + height / 2))
  })
  expect(lands).toBe(true)
  expect(await barsSent(page)).not.toContain(true)
})

test('closing with unsaved edits asks first: Keep editing stays, Close discards and closes', async () => {
  const { page } = await modal()
  const opening = await note(page).inputValue()
  await note(page).fill('Call before 5 pm')
  await page.keyboard.press('Escape')
  const ask = dialog(page).getByText('Close without saving?')
  await expect.poll(() => ask.isVisible()).toBe(true)
  expect(await dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Keep editing' }).click()
  expect(await ask.isVisible()).toBe(false)
  expect(await note(page).inputValue()).toBe('Call before 5 pm')

  await dialog(page).getByRole('button', { name: 'Close', exact: true }).click()
  await expect.poll(() => ask.isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Close without saving' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  // The closed modal is out of the accessibility tree, so its field is found by name.
  expect(await view(page).locator('e-modal input[name="note"]').inputValue()).toBe(opening)
})

// The dialog hides the moment it closes, and an app may read its fields right then: by that moment
// the edits are gone, not one task later when the close event fires.
test('Close without saving has put the fields back by the time the modal is hidden', async () => {
  const { page } = await modal()
  const opening = await note(page).inputValue()
  await note(page).fill('Call before 5 pm')
  await page.keyboard.press('Escape')
  const closeAnyway = dialog(page).getByRole('button', { name: 'Close without saving' })
  await expect.poll(() => closeAnyway.isVisible()).toBe(true)
  const atClose = await closeAnyway.evaluate((button) => {
    const modal = button.closest('e-modal')!
    ;(button as HTMLElement).click()
    const input = modal.querySelector<HTMLInputElement>('input[name="note"]')!
    return { open: modal.querySelector('dialog')!.open, note: input.value }
  })
  expect(atClose).toEqual({ open: false, note: opening })
})

test('a modal with nothing edited closes at once', async () => {
  const { page } = await modal()
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
})

test('in Bangla the footer and the ask speak Bangla', async () => {
  const { page } = await modal('bn')
  const bangla = view(page).getByRole('dialog', { name: 'অর্ডার #1042 কনফার্ম করুন' })
  await bangla.getByRole('textbox', { name: 'কুরিয়ারের জন্য নোট' }).fill('৫টার আগে ফোন করুন')
  await expect.poll(() => bangla.locator('footer button:visible').allTextContents()).toEqual(['বাতিল', 'সংরক্ষণ'])
  await page.keyboard.press('Escape')
  await expect.poll(() => bangla.getByText('সংরক্ষণ না করে বন্ধ করবেন?').isVisible()).toBe(true)
})
