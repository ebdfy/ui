import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// The hint is true only because the page runs Duplicate on the shortcut too.
test('the sample order hints Ctrl+D on Duplicate and Control+D runs it', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.getByRole('button', { name: 'More' }).click({ timeout: 15_000 })
  const item = app.locator('eb-menu-item#duplicate:defined')
  const hint = item.locator('eb-kbd[part="shortcut"]:defined')
  await expect.poll(() => hint.evaluate((el) => el.shadowRoot?.querySelector('kbd')?.textContent)).toBe('Ctrl+D')

  await page.keyboard.press('Escape')
  await app.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Control+D')
  const toast = page.locator('eb-admin-chrome [part="toast"] span')
  await expect.poll(() => toast.textContent()).toBe('Copied to a new draft')
  expect(errors).toEqual([])
})
