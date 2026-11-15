// An embedded app's form raises the Admin's one save bar through the bridge: the sample app's order
// settings, framed by the playground, from another origin.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path = '/playground/orders-settings', width = 1440) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript(() => {
    localStorage.setItem('ebdfy-playground-lang', 'en')
    localStorage.setItem('ebdfy-sample-lang', 'en')
  })
  await opened.page.goto(`${pages.ui}${path}`)
  const app = await appFrame(opened.page)
  return { ...opened, app }
}

// The app's frame once its page has its form and the bridge's script.
async function appFrame(page: Page): Promise<Frame> {
  const frame = (await (await page.locator('e-admin-panel > iframe').elementHandle())!.contentFrame())!
  await frame.locator('e-taka-field[name="inside"] input:not([type="hidden"])').waitFor()
  await frame.waitForFunction(() => 'ebdfy' in globalThis)
  // Each submit of the app's form is counted where the test can read it.
  await frame.evaluate(() =>
    document.querySelector('form[data-save-bar]')!.addEventListener('submit', () =>
      Object.assign(globalThis, {
        submits: ((globalThis as unknown as { submits?: number }).submits ?? 0) + 1,
      }),
    ),
  )
  return frame
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const inside = (app: Frame) => app.locator('e-taka-field[name="inside"] input:not([type="hidden"])')
const submits = (app: Frame) => app.evaluate(() => (globalThis as unknown as { submits?: number }).submits ?? 0)

test('changing Inside Dhaka from ৳80 to ৳90 shows "Unsaved changes" in the Admin\'s band', async () => {
  const { page, app, errors } = await open()
  expect(await inside(app).inputValue()).toBe('80')
  await inside(app).fill('90')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await said(page)).toBe('Unsaved changes')
  expect(errors).toEqual([])
})

test("the Admin's Discard puts ৳80 back, and its Save submits the app's form once", async () => {
  const { page, app } = await open()
  await inside(app).fill('90')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => inside(app).inputValue()).toBe('80')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  await inside(app).fill('90')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Delivery charges saved')
  expect(await submits(app)).toBe(1)
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('an app answer with one userError shows "Not saved: 1 field needs a fix", and putting it right clears it', async () => {
  const { page, app } = await open()
  await inside(app).fill('5000')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  expect(await app.locator('e-taka-field[name="inside"]').getAttribute('error')).toBe(
    'A delivery charge is at most ৳1,000.',
  )
  await inside(app).fill('90')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
})

test("with focus in Inside Dhaka, Ctrl+S submits the app's form once, and Enter there does too", async () => {
  const { page, app } = await open()
  await inside(app).fill('90')
  await inside(app).press('Control+s')
  await expect.poll(() => submits(app)).toBe(1)
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Delivery charges saved')
  await inside(app).fill('95')
  await inside(app).press('Enter')
  await expect.poll(() => submits(app)).toBe(2)
  // A clean form saves nothing.
  await inside(app).press('Control+s')
  await page.waitForTimeout(300)
  expect(await submits(app)).toBe(2)
})

test('clicking Orders with the app form dirty asks "Leave without saving?"', async () => {
  const { page, app } = await open()
  await inside(app).fill('90')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Orders/ })
    .first()
    .click()
  const dialog = page.locator('dialog.e-leave')
  await expect.poll(() => dialog.isVisible()).toBe(true)
  expect(await dialog.locator('h2').textContent()).toBe('Leave without saving?')
  expect(new URL(page.url()).pathname).toBe('/playground/orders-settings')
  await dialog.getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => new URL(page.url()).pathname).toBe('/playground/orders')
})

test('from a dirty Admin page to an app page and back there is one bar, never two', async () => {
  const { page } = await pages.open(`${pages.ui}/playground/settings/store`, 1440, {
    viewport: { width: 1440, height: 900 },
  })
  await page.locator('e-phone-field input').fill('01819556691')
  await page.locator('[slot="menu"] > a[data-back]').click()
  await page.locator('dialog.e-leave').getByRole('button', { name: 'Leave' }).click()
  await page.waitForURL(`${pages.ui}/playground/home`)
  await page.goto(`${pages.ui}/playground/orders-settings`)
  const app = await appFrame(page)
  await inside(app).fill('90')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await page.locator('.e-save-bar').count()).toBe(1)
  await page
    .locator('[slot="menu"] > a')
    .filter({ hasText: /^Settings$/ })
    .click()
  await page.locator('dialog.e-leave').getByRole('button', { name: 'Leave' }).click()
  await page.waitForURL(`${pages.ui}/playground/settings/store`)
  await page.locator('e-phone-field input').fill('01819556692')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await page.locator('.e-save-bar').count()).toBe(1)
})
