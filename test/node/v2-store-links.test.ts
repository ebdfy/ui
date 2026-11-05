// An app's own link inside the Admin keeps the store the Admin opened it for, so the page it opens,
// and a tab opened from it, still knows its store.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function app(page: Page): Promise<Frame> {
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => page.locator('e-admin-panel header h1').textContent(), { timeout: 15_000 }).toBe('Orders')
  return page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
}

// Taps a link added to the app's page and reads the address it would open, stopping the visit.
async function tapped(frame: Frame, href: string, button: 'left' | 'middle' = 'left'): Promise<string> {
  await frame.evaluate((to) => {
    const link = document.createElement('a')
    link.href = to
    link.id = 'probe'
    link.textContent = 'Probe'
    document.body.prepend(link)
    for (const type of ['click', 'auxclick']) {
      window.addEventListener(type, (event) => {
        const target = event.target instanceof Element ? event.target.closest('a') : null
        if (target?.id === 'probe') {
          event.preventDefault()
          document.body.dataset.opened = target.href
        }
      })
    }
  }, href)
  await frame.locator('#probe').click({ button })
  return frame.evaluate(() => document.body.dataset.opened ?? '')
}

test('tapping an order in the app opens it with the store kept', async () => {
  const { page } = await pages.open('', 1440)
  const frame = await app(page)
  await frame.getByRole('link', { name: '#1042' }).click()
  await expect.poll(() => frame.url()).toBe(`${pages.sampleApp}/orders/1042?store=demo`)
})

test('a link on the app origin keeps the store, its own query and hash, with either button', async () => {
  const { page } = await pages.open('', 1440)
  expect(await tapped(await app(page), '/orders?view=open#top')).toBe(
    `${pages.sampleApp}/orders?view=open&store=demo#top`,
  )
  const { page: second } = await pages.open('', 1440)
  expect(await tapped(await app(second), '/orders/1041', 'middle')).toBe(`${pages.sampleApp}/orders/1041?store=demo`)
})

test('a link that names a store, or leaves the app origin, is left as written', async () => {
  const { page } = await pages.open('', 1440)
  const frame = await app(page)
  expect(await tapped(frame, '/orders?store=other')).toBe(`${pages.sampleApp}/orders?store=other`)
  const { page: second } = await pages.open('', 1440)
  expect(await tapped(await app(second), 'https://example.com/x')).toBe('https://example.com/x')
})
