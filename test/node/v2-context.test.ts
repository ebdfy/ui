// An app in the v2 Admin reads its store, the staff member's language and the device, and follows the
// Admin when its language or width class changes, with no reload.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

// The app's global, as each test reads it inside the app's frame.
declare const ebdfy: {
  config: { store: string; app: string }
  user(): Promise<{ language: string }>
  environment: { embedded: boolean; mobile: boolean }
}

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')
const appFrame = (page: Page) => page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!

interface Seen {
  store: string
  app: string
  language: string
  embedded: boolean
  mobile: boolean
}

async function playground(path: string, width = 1440): Promise<{ page: Page; app: Frame; errors: string[] }> {
  const { page, errors } = await pages.open('', width, { viewport: { width, height: 900 } })
  await page.goto(`${pages.ui}/playground${path}`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).not.toBe('Sample app')
  const app = appFrame(page)
  await app.waitForFunction(() => 'ebdfy' in globalThis)
  // Every context event the app hears from here on, and a mark a reload would lose.
  await app.evaluate(() => {
    const seen: Seen[] = []
    Object.assign(globalThis, { seen, mark: true })
    addEventListener('ebdfy:context', (event) => seen.push((event as CustomEvent<Seen>).detail))
  })
  return { page, app, errors }
}

const lastSeen = (app: Frame) => app.evaluate(() => (globalThis as unknown as { seen: Seen[] }).seen.at(-1))
const kept = (app: Frame) => app.evaluate(() => (globalThis as { mark?: boolean }).mark === true)

test('in the playground the app reads its store, app, language and a desktop', async () => {
  const { app, errors } = await playground('')
  expect(await app.evaluate(() => ({ ...ebdfy.config }))).toEqual({ store: 'demo', app: 'sample' })
  expect(await app.evaluate(() => ebdfy.user())).toEqual({ language: 'en' })
  expect(await app.evaluate(() => ({ ...ebdfy.environment }))).toEqual({ embedded: true, mobile: false })
  expect(errors).toEqual([])
})

test('switching the Admin to বাংলা tells the app, which turns its whole page Bangla with no reload', async () => {
  const { page, app, errors } = await playground('')
  await page.getByRole('button', { name: 'বাংলা' }).click()
  await expect
    .poll(() => lastSeen(app))
    .toEqual({
      store: 'demo',
      app: 'sample',
      language: 'bn',
      embedded: true,
      mobile: false,
    })
  await expect.poll(() => titleBar(page).textContent()).toBe('অর্ডার')
  const view = page.frameLocator('e-admin-panel iframe')
  expect(await view.getByRole('heading', { level: 1 }).textContent()).toBe('অর্ডার')
  expect(await view.getByRole('button', { name: 'সংরক্ষণ করুন' }).count()).toBe(1)
  expect(await view.getByRole('searchbox').getAttribute('placeholder')).toBe('অর্ডার খুঁজুন')
  expect(await view.getByRole('searchbox').getAttribute('aria-label')).toBe('অর্ডার খুঁজুন')
  expect(await view.getByRole('table').getAttribute('aria-label')).toBe('অর্ডার')
  expect(await view.locator('e-row:not([head])').first().locator('> *').allTextContents()).toEqual([
    '',
    '#1042',
    'আজ ১১:২৪',
    'রহিমা আক্তার',
    'ফেসবুক',
    'ক্যাশ অন ডেলিভারি',
    'নতুন',
    '২টি পণ্য',
    '৳১,৯৩০',
  ])
  expect(await app.evaluate(() => ebdfy.user())).toEqual({ language: 'bn' })
  expect(await kept(app)).toBe(true)

  // And back: nothing stays Bangla.
  await page.getByRole('button', { name: 'English' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('Orders')
  expect(await view.getByRole('heading', { level: 1 }).textContent()).toBe('Orders')
  expect(await view.getByRole('button', { name: 'Save' }).count()).toBe(1)
  expect(await view.getByRole('searchbox').getAttribute('placeholder')).toBe('Search orders')
  expect(await view.locator('e-row:not([head])').first().locator('a').textContent()).toBe('#1042')
  expect(await kept(app)).toBe(true)
  expect(errors).toEqual([])
})

test("the order page follows the switch, and Save's toast speaks the new language", async () => {
  const { page, app } = await playground('/orders/1042')
  await page.getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('অর্ডার #1042')
  const view = page.frameLocator('e-admin-panel iframe')
  expect(await view.locator('strong').textContent()).toBe('নতুন')
  expect(await view.getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }).count()).toBe(1)
  expect(await view.getByRole('link', { name: '← সব অর্ডার' }).count()).toBe(1)
  expect(await kept(app)).toBe(true)

  const { page: list } = await playground('')
  await list.getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => titleBar(list).textContent()).toBe('অর্ডার')
  await list.frameLocator('e-admin-panel iframe').getByRole('button', { name: 'সংরক্ষণ করুন' }).click()
  await expect.poll(() => list.locator('e-admin-panel').getByRole('status').textContent()).toBe('সংরক্ষিত')
})

test('the Admin keeps its language on reload, and the app opens in it', async () => {
  const { page } = await playground('')
  await page.getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('অর্ডার')
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('bn')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('অর্ডার')
  expect(await page.getByRole('button', { name: 'English' }).count()).toBe(1)
})

test('at 360 px the app is on a phone, and widening the Admin tells it it is not', async () => {
  const { page, app } = await playground('', 360)
  expect(await app.evaluate(() => ebdfy.environment.mobile)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect.poll(() => lastSeen(app).then((seen) => seen?.mobile)).toBe(false)
  expect(await app.evaluate(() => ebdfy.environment.mobile)).toBe(false)
  await page.setViewportSize({ width: 360, height: 800 })
  await expect.poll(() => lastSeen(app).then((seen) => seen?.mobile)).toBe(true)
})

test('a page outside the Admin is not embedded and has no staff member to ask about', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/orders`, 1440)
  await page.waitForFunction(() => 'ebdfy' in globalThis)
  expect(await page.evaluate(() => ebdfy.environment.embedded)).toBe(false)
  expect(
    await page.evaluate(() =>
      ebdfy.user().then(
        () => 'resolved',
        (error: Error) => error.message,
      ),
    ),
  ).toContain('only from the Admin')
})

test('a context message from a frame that is not the Admin changes nothing', async () => {
  const { page, app } = await playground('')
  await expect.poll(() => app.evaluate(() => ebdfy.user())).toEqual({ language: 'en' })
  await page.evaluate(() => {
    const forger = document.createElement('iframe')
    forger.srcdoc = `<script>parent.frames[0].postMessage({ type: 'context', payload: { store: 'evil', app: 'x', language: 'bn', mobile: true } }, '*')</script>`
    document.body.append(forger)
  })
  await page.waitForTimeout(500)
  expect(await app.evaluate(() => ebdfy.user())).toEqual({ language: 'en' })
  expect(await app.evaluate(() => ({ ...ebdfy.config }))).toEqual({ store: 'demo', app: 'sample' })
  expect(await titleBar(page).textContent()).toBe('Orders')
})

test("an app that last spoke English opens in the Admin's Bangla, even when its listener comes late", async () => {
  const { page } = await pages.open('', 1440, { viewport: { width: 1440, height: 900 } })
  await page.context().addInitScript(() => {
    localStorage.setItem('ebdfy-playground-lang', 'bn')
    localStorage.setItem('ebdfy-sample-lang', 'en')
  })
  // The page's listener sits in a module that waits for /nav.js, so the Admin's one context
  // message comes first.
  await page.route('**/nav.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800))
    await route.continue()
  })
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('অর্ডার')
  const view = page.frameLocator('e-admin-panel iframe')
  expect(await view.getByRole('heading', { level: 1 }).textContent()).toBe('অর্ডার')
})
