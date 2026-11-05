// The v2 playground opens the app page its address names, and the sample app has a page for each of
// its orders and its order settings, so a deep link can land on any of them.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { siteRedirect } from '../../src/site-routes.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const appFrame = (page: Page) => page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))

async function playground(path: string, lang: 'en' | 'bn' = 'en') {
  const opened = await pages.open('', 1440)
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground${path}`)
  return opened
}

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')

test('the Button page answers at /components/button', async () => {
  const response = await fetch(`${pages.ui}/components/button`)
  expect(response.status).toBe(200)
  expect(await response.text()).toContain('<title>Button · ebdfy design system v2</title>')
})

// The pages lived under /v2/ before 2.0.0, so every old link answers 301 to the same page at the root.
test.for([
  { host: 'ui', path: '/v2/components/button', location: '/components/button' },
  { host: 'ui', path: '/v2/', location: '/' },
  { host: 'ui', path: '/v2', location: '/' },
  { host: 'ui', path: '/v2/playground/orders/1042?x=1', location: '/playground/orders/1042?x=1' },
  { host: 'sampleApp', path: '/v2/orders/1042', location: '/orders/1042' },
] as const)('$host $path answers 301 to $location', async ({ host, path, location }) => {
  const response = await fetch(`${pages[host]}${path}`, { redirect: 'manual' })
  expect(response.status).toBe(301)
  expect(response.headers.get('location')).toBe(location)
})

// A browser reads a Location of //host or /\\host as another host, and a dev server hands a raw
// backslash through, so every leading run of slashes and backslashes becomes one slash.
test('an old link never redirects to another host', () => {
  expect(siteRedirect('ui', '/v2//evil.example', '')).toBe('/evil.example')
  expect(siteRedirect('ui', '/v2/\\evil.example', '')).toBe('/evil.example')
  expect(siteRedirect('sample-app', '/v2/\\/\\evil.example', '?a=1')).toBe('/evil.example?a=1')
  expect(siteRedirect('cdn', '/v2/x', '')).toBeNull()
})

test('the playground with no app path opens the orders list', async () => {
  const { page, errors } = await playground('')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Orders')
  expect(appFrame(page)?.url()).toBe(`${pages.sampleApp}/orders?store=demo`)
  expect(errors).toEqual([])
})

// One order of each status: only a new one offers Confirm.
const statuses = [
  { order: 1042, status: 'New', confirm: 1 },
  { order: 1041, status: 'Confirmed', confirm: 0 },
  { order: 1039, status: 'With courier', confirm: 0 },
  { order: 1038, status: 'Delivered', confirm: 0 },
  { order: 1037, status: 'Returned', confirm: 0 },
]

test.for(statuses)('/playground/orders/$order opens order #$order, $status', async ({ order, status, confirm }) => {
  const { page, errors } = await playground(`/orders/${order}`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe(`Order #${order}`)
  expect(appFrame(page)?.url()).toBe(`${pages.sampleApp}/orders/${order}?store=demo`)
  const app = page.frameLocator('e-admin-panel iframe')
  expect(await app.getByRole('heading', { level: 1 }).textContent()).toBe(`Order #${order}`)
  expect(await app.locator('strong').textContent()).toBe(status)
  expect(await app.getByRole('button', { name: 'Confirm order' }).count()).toBe(confirm)
  expect(errors).toEqual([])
})

test('in Bangla the order page reads its number, status and Confirm in Bangla', async () => {
  const { page } = await playground('/orders/1042', 'bn')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('অর্ডার #1042')
  const app = page.frameLocator('e-admin-panel iframe')
  expect(await app.locator('strong').textContent()).toBe('নতুন')
  expect(await app.getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }).count()).toBe(1)
})

test('an order the app does not have says so', async () => {
  const { page } = await playground('/orders/9999')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Order not found')
})

test('/playground/orders-settings opens the order settings page', async () => {
  const { page, errors } = await playground('/orders-settings')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Order settings')
  expect(appFrame(page)?.url()).toBe(`${pages.sampleApp}/orders-settings?store=demo`)
  expect(errors).toEqual([])
})

test('/playground/home opens the home page', async () => {
  const { page, errors } = await playground('/home')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  expect(appFrame(page)?.url()).toBe(`${pages.sampleApp}/home?store=demo`)
  expect(errors).toEqual([])
})

test("the list's back link on an order opens the list with the store kept", async () => {
  const { page } = await playground('/orders/1042')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Order #1042')
  await page.frameLocator('e-admin-panel iframe').getByRole('link', { name: '← All orders' }).click()
  await expect.poll(() => titleBar(page).textContent()).toBe('Orders')
  expect(appFrame(page)?.url()).toBe(`${pages.sampleApp}/orders?store=demo`)
})
