// The v2 Admin's address follows the app's page, so a reload or a shared link returns to it, and the
// app's nav marks the entry the page sits under.
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
const address = (page: Page) => new URL(page.url()).pathname + new URL(page.url()).search
const appNav = (page: Page) => page.getByRole('navigation', { name: 'Sample app' })

async function current(page: Page): Promise<string[]> {
  return appNav(page).locator('a[aria-current="page"]').allTextContents()
}

async function playground(path = '', width = 1440): Promise<Page> {
  const { page } = await pages.open('', width, { viewport: { width, height: 900 } })
  await page.goto(`${pages.ui}/playground${path}`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).not.toBe('Sample app')
  return page
}

test('opening #1042 puts its page in the address, and the nav marks Orders, not Order settings', async () => {
  const page = await playground()
  await expect.poll(() => address(page)).toBe('/playground/orders')
  await page.frameLocator('e-admin-panel iframe').getByRole('link', { name: '#1042' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('Order #1042')
  await expect.poll(() => address(page)).toBe('/playground/orders/1042')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders/1042?store=demo`)
  expect(await appNav(page).getByRole('link').allTextContents()).toEqual(['Home', 'Orders', 'Order settings'])
  expect(await current(page)).toEqual(['Orders'])
})

test('reloading the address of #1042 opens #1042 again', async () => {
  const page = await playground('/orders/1042')
  await page.reload()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Order #1042')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders/1042?store=demo`)
  expect(address(page)).toBe('/playground/orders/1042')
})

test('browser Back from #1042 returns the app to the list and the address to /playground/orders', async () => {
  const page = await playground()
  await expect.poll(() => address(page)).toBe('/playground/orders')
  await page.frameLocator('e-admin-panel iframe').getByRole('link', { name: '#1042' }).click()
  await expect.poll(() => address(page)).toBe('/playground/orders/1042')
  await page.goBack()
  await expect.poll(() => titleBar(page).textContent()).toBe('Orders')
  await expect.poll(() => address(page)).toBe('/playground/orders')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders?store=demo`)
  expect(await current(page)).toEqual(['Orders'])
})

test('the address follows pushState and popstate, keeping the query but never the store', async () => {
  const page = await playground()
  await expect.poll(() => address(page)).toBe('/playground/orders')
  await appFrame(page).evaluate(() => history.pushState(null, '', '/orders?view=open&store=demo'))
  await expect.poll(() => address(page)).toBe('/playground/orders?view=open')
  await appFrame(page).evaluate(() => history.back())
  await expect.poll(() => address(page)).toBe('/playground/orders')
})

test("tapping an entry of the app's nav opens its page, and it becomes the current one", async () => {
  const page = await playground()
  await appNav(page).getByRole('link', { name: 'Order settings' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('Order settings')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders-settings?store=demo`)
  await expect.poll(() => address(page)).toBe('/playground/orders-settings')
  expect(await current(page)).toEqual(['Order settings'])
})

test('at 360 px a button at the end of the title bar opens the nav under it, and the frame never moves', async () => {
  const { page } = await pages.open('', 360, { viewport: { width: 360, height: 800 } })
  await page.goto(`${pages.ui}/playground/orders/1042`)
  const frameTop = () => page.locator('e-admin-panel > iframe').evaluate((frame) => frame.getBoundingClientRect().y)
  const before = await frameTop()
  const opener = page.locator('e-admin-panel > header').getByRole('button', { name: 'Sample app' })
  await expect.poll(() => opener.isVisible(), { timeout: 15_000 }).toBe(true)
  expect(await frameTop()).toBe(before)
  expect(await appNav(page).isVisible()).toBe(false)

  await opener.click()
  const nav = appNav(page)
  expect(await nav.getByRole('link').allTextContents()).toEqual(['Home', 'Orders', 'Order settings'])
  expect(await current(page)).toEqual(['Orders'])
  const header = await page.locator('e-admin-panel > header').boundingBox()
  expect((await nav.boundingBox())!.y).toBeCloseTo(header!.y + header!.height, 0)
  await nav.getByRole('link', { name: 'Order settings' }).click()
  await expect.poll(() => address(page)).toBe('/playground/orders-settings')
  expect(await nav.isVisible()).toBe(false)
})

test("in Bangla the app's nav reads its Bangla labels", async () => {
  const page = await playground()
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await page.locator('#e-user').getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => appNav(page).getByRole('link').allTextContents()).toEqual(['হোম', 'অর্ডার', 'অর্ডার সেটিংস'])
})

test('a page message from a frame that is not the app moves neither the address nor the nav', async () => {
  const page = await playground()
  await expect.poll(() => address(page)).toBe('/playground/orders')
  await page.evaluate((app) => {
    const forger = document.createElement('iframe')
    forger.srcdoc = `<script>
      parent.postMessage({ type: 'page', payload: { page: '${app}/orders-settings' } }, '*')
      parent.postMessage({ type: 'nav', payload: { entries: [{ label: 'Evil', path: '/evil' }] } }, '*')
    </script>`
    document.body.append(forger)
  }, pages.sampleApp)
  await page.waitForTimeout(500)
  expect(address(page)).toBe('/playground/orders')
  expect(await appNav(page).getByRole('link').allTextContents()).toEqual(['Home', 'Orders', 'Order settings'])
})

test('a tab opened on an app page lands in the playground on that page', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/orders/1042?store=demo&view=full`, 1440, {
    viewport: { width: 1440, height: 900 },
  })
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Order #1042')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders/1042?view=full&store=demo`)
  await expect.poll(() => address(page)).toBe('/playground/orders/1042?view=full')
})

test('a page named on another origin opens the list instead', async () => {
  const page = await playground('?page=//example.com/orders/1042')
  await expect.poll(() => titleBar(page).textContent()).toBe('Orders')
  expect(appFrame(page).url()).toBe(`${pages.sampleApp}/orders?store=demo`)
})
