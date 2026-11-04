import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// Duplicate, in the title bar's More menu, runs on Alt+Shift+D too.
test('on the sample order Alt+Shift+D runs Duplicate', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const app = page.frameLocator('eb-admin-chrome iframe')
  await page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'More' }).waitFor({ timeout: 15_000 })
  await app.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Alt+Shift+D')
  const toast = page.locator('eb-admin-chrome [part="toast"] span')
  await expect.poll(() => toast.textContent()).toBe('Copied to a new draft')
  expect(errors).toEqual([])
})
