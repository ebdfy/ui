// The v2 sample app's Home page: a setup guide with five steps, two done, that stays gone once the
// person dismisses it.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')

async function home(lang: 'en' | 'bn' = 'en') {
  const opened = await pages.open('', 1440)
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground/home`)
  return opened
}

const app = (page: Page) => page.frameLocator('e-admin-panel iframe')

test('/playground/home opens Home with a guide that reads 2 of 5 and two steps ticked', async () => {
  const { page, errors } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const guide = app(page).locator('e-setup-guide')
  await expect.poll(() => guide.locator('[data-count]').textContent()).toBe('2 of 5')
  expect(await guide.getByRole('checkbox', { checked: true }).count()).toBe(2)
  expect(await guide.getByRole('checkbox').count()).toBe(5)
  expect(errors).toEqual([])
})

test('after Dismiss and a reload the guide is not on the page', async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  await app(page).getByRole('button', { name: 'Dismiss' }).click()
  expect(await app(page).locator('e-setup-guide').count()).toBe(0)
  await page.reload()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  expect(await app(page).locator('e-setup-guide').count()).toBe(0)
})

test('in Bangla the guide reads ৫টির মধ্যে ২টি', async () => {
  const { page } = await home('bn')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('হোম')
  await expect.poll(() => app(page).locator('e-setup-guide [data-count]').textContent()).toBe('৫টির মধ্যে ২টি')
})

test("another part's dismiss event, a banner's say, does not put the guide away", async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const frame = page.frames().find((one) => one.url().startsWith(`${pages.sampleApp}/home`))!
  await frame.evaluate(() => document.body.dispatchEvent(new CustomEvent('dismiss', { bubbles: true })))
  expect(await frame.evaluate(() => localStorage.getItem('ebdfy-sample-setup-dismissed'))).toBeNull()
  await page.reload()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  expect(await app(page).locator('e-setup-guide').count()).toBe(1)
})
