// v2-host.js takes the app's messages under v1's bridge rules: the app's title in the panel's title
// bar, a toast inside the panel, a loading bar while the app loads or is busy, and a notice when the
// app has not answered for 15 s. The app here is a page of the test's own on the sample app's origin,
// loading the real kit and its bridge.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const desktop = { viewport: { width: 1440, height: 900 } }
const start = new Date('2026-03-02T09:00:00')

const appPage = (script: string, bridge = true) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><link rel="icon" href="data:," /></head>
  <body>
    ${bridge ? '<script type="module" src="/ui/v2.js"></script>' : ''}
    <script type="module">${script}</script>
  </body>
</html>`

// The playground with its app's page served by the test. With clock, time stands still from the
// first moment, so the 15 s wait starts at a known time and moves only by runFor.
async function open(body: string, { url = '/playground', clock = false } = {}) {
  const { page, errors } = await pages.open('', 1440, desktop)
  if (clock) {
    await page.clock.install({ time: start })
    await page.clock.pauseAt(start)
  }
  const loads: string[] = []
  // The orders page the playground frames, not the kit's own files on the same origin.
  const orders = (url: URL) => url.origin === pages.sampleApp && url.pathname === '/orders'
  await page.route(orders, (route) => {
    loads.push(route.request().url())
    return route.fulfill({ contentType: 'text/html', body })
  })
  await page.goto(`${pages.ui}${url}`)
  return { page, errors, loads }
}

const isApp = (url: string) => url.startsWith(`${pages.sampleApp}/`)

async function appFrame(page: Page) {
  await expect.poll(() => page.frames().some((frame) => isApp(frame.url()))).toBe(true)
  return page.frames().find((frame) => isApp(frame.url()))!
}

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).boundingBox()
  if (!found) throw new Error(`${selector} has no box`)
  return found
}

const title = (page: Page) => page.locator('e-admin-panel > header h1').textContent()

test("the app's title shows in the panel's title bar, cut to 60 letters", async () => {
  const { page, errors } = await open(appPage("ebdfy.title('Orders')"))
  await expect.poll(() => title(page)).toBe('Orders')

  const app = await appFrame(page)
  await app.evaluate("ebdfy.title('x'.repeat(70))")
  await expect.poll(() => title(page)).toBe(`${'x'.repeat(59)}…`)
  expect(errors).toEqual([])
})

test('a toast shows inside the panel over the iframe for 5 s, and a new one takes its place', async () => {
  const { page, errors } = await open(appPage("ebdfy.title('Orders')"), { clock: true })
  await expect.poll(() => title(page)).toBe('Orders')
  const app = await appFrame(page)
  const toast = page.getByRole('status')

  await app.evaluate("ebdfy.toast('Saved')")
  await expect.poll(() => toast.textContent()).toBe('Saved')
  const panel = await box(page, 'e-admin-panel')
  const frame = await box(page, 'e-admin-panel > iframe')
  const shown = (await toast.boundingBox())!
  expect(shown.x).toBeGreaterThanOrEqual(panel.x)
  expect(shown.x + shown.width).toBeLessThanOrEqual(panel.x + panel.width)
  expect(shown.y).toBeGreaterThanOrEqual(frame.y)
  expect(shown.y + shown.height).toBeLessThanOrEqual(panel.y + panel.height)
  const onTop = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.closest('[role="status"]')?.textContent,
    [shown.x + shown.width / 2, shown.y + shown.height / 2],
  )
  expect(onTop).toBe('Saved')

  await page.clock.runFor(4_900)
  expect(await toast.count()).toBe(1)
  await page.clock.runFor(100)
  expect(await toast.count()).toBe(0)

  await app.evaluate("ebdfy.toast('Saved')")
  await expect.poll(() => toast.textContent()).toBe('Saved')
  await page.clock.runFor(3_000)
  await app.evaluate("ebdfy.toast('Sent')")
  await expect.poll(() => toast.textContent()).toBe('Sent')
  expect(await toast.count()).toBe(1)
  await page.clock.runFor(4_900)
  expect(await toast.count()).toBe(1)
  await page.clock.runFor(100)
  expect(await toast.count()).toBe(0)
  expect(errors).toEqual([])
})

test('an error toast stays past 5 s until its Dismiss is pressed', async () => {
  const { page } = await open(appPage("ebdfy.title('Orders')"), { clock: true })
  await expect.poll(() => title(page)).toBe('Orders')
  const app = await appFrame(page)
  const refused = page.locator('e-admin-panel').getByText('Refused')

  await app.evaluate("ebdfy.toast('Refused', { error: true })")
  await refused.waitFor()
  await page.clock.runFor(10_000)
  expect(await refused.isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Dismiss' }).click()
  expect(await refused.count()).toBe(0)
})

test("a toast's action button runs the app's onAction", async () => {
  const { page } = await open(appPage("ebdfy.title('Orders')"))
  await expect.poll(() => title(page)).toBe('Orders')
  const app = await appFrame(page)

  await app.evaluate(
    "ebdfy.toast('Order archived', { action: { label: 'Undo', onAction: () => (document.body.dataset.undone = 'yes') } })",
  )
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(() => app.evaluate('document.body.dataset.undone')).toBe('yes')
  expect(await page.getByRole('status').count()).toBe(0)
})

test('the loading bar shows until the app is ready, and while it says it is busy', async () => {
  const { page } = await open(appPage('', false))
  const bar = page.locator('e-admin-panel').getByRole('progressbar', { name: 'Loading' })
  await expect.poll(() => bar.isVisible()).toBe(true)

  const app = await appFrame(page)
  await app.addScriptTag({ type: 'module', url: '/ui/v2.js' })
  await expect.poll(() => bar.isVisible()).toBe(false)
  await app.evaluate('ebdfy.loading(true)')
  await expect.poll(() => bar.isVisible()).toBe(true)
  await app.evaluate('ebdfy.loading(false)')
  await expect.poll(() => bar.isVisible()).toBe(false)
})

test('?hang shows "This app isn\'t responding" inside the panel at 15 s, and Reload waits again', async () => {
  const { page, errors, loads } = await open('', { url: '/playground?hang', clock: true })
  const iframe = page.locator('e-admin-panel > iframe')
  expect(await iframe.getAttribute('src')).toBe(`${pages.sampleApp}/hang?store=demo`)
  const toggle = page.locator('[slot="actions"]').getByRole('link', { name: 'Stop hanging' })
  expect(await toggle.getAttribute('href')).toBe('/playground')
  const notice = page.locator('e-admin-panel').getByRole('alert')

  await page.clock.runFor(14_900)
  expect(await notice.count()).toBe(0)
  await page.clock.runFor(100)
  await notice.waitFor()
  expect(await notice.textContent()).toContain("This app isn't responding")
  const panel = await box(page, 'e-admin-panel')
  const header = await box(page, 'e-admin-panel > header')
  const shown = (await notice.boundingBox())!
  expect(shown.x).toBeGreaterThanOrEqual(panel.x)
  expect(shown.y).toBeGreaterThanOrEqual(header.y + header.height)
  expect(shown.y + shown.height).toBeLessThanOrEqual(panel.y + panel.height)

  const reloads: string[] = []
  page.on('request', (request) => reloads.push(request.url()))
  await page.getByRole('button', { name: 'Reload' }).click()
  expect(await notice.count()).toBe(0)
  await expect.poll(() => reloads).toContain(`${pages.sampleApp}/hang?store=demo`)
  await page.clock.runFor(14_900)
  expect(await notice.count()).toBe(0)
  await page.clock.runFor(100)
  await notice.waitFor()

  // The orders page never loads first.
  expect(loads).toEqual([])
  expect(errors).toEqual([])
})

test('with the normal app no notice shows at 16 s, and the actions offer "Hang the app"', async () => {
  const { page } = await open(appPage("ebdfy.title('Orders')"), { clock: true })
  await expect.poll(() => title(page)).toBe('Orders')
  const hang = page.locator('[slot="actions"]').getByRole('link', { name: 'Hang the app' })
  expect(await hang.getAttribute('href')).toBe('/playground?hang')

  await page.clock.runFor(16_000)
  expect(await page.getByRole('alert').count()).toBe(0)
})

test('a title from another origin, or from a window that is not the app, changes nothing', async () => {
  const { page } = await open(appPage("ebdfy.title('Orders')"))
  await expect.poll(() => title(page)).toBe('Orders')
  const app = await appFrame(page)

  await page.route(`${pages.sampleApp}/other`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<script>parent.postMessage({ type: 'title', payload: { title: 'Another frame', actions: [], call: 1 } }, '*')</script>`,
    }),
  )
  await page.evaluate((src) => {
    postMessage({ type: 'title', payload: { title: 'The Admin page', actions: [], call: 1 } }, '*')
    const other = document.createElement('iframe')
    other.src = src
    document.body.append(other)
    return new Promise((loaded) => other.addEventListener('load', loaded))
  }, `${pages.sampleApp}/other`)

  // The app's toast comes after both, so once it shows they have been heard.
  await app.evaluate("ebdfy.toast('Saved')")
  await expect.poll(() => page.getByRole('status').textContent()).toBe('Saved')
  expect(await title(page)).toBe('Orders')
})

test('in Bangla the notice reads অ্যাপটি সাড়া দিচ্ছে না', async () => {
  const { page } = await open('', { url: '/playground?hang', clock: true })
  await page.evaluate(() => (document.documentElement.lang = 'bn'))
  await page.clock.runFor(15_000)
  const notice = page.locator('e-admin-panel').getByRole('alert')
  await notice.waitFor()
  expect(await notice.textContent()).toContain('অ্যাপটি সাড়া দিচ্ছে না')
})

test('a toast showing moves neither the panel nor the iframe', async () => {
  const { page } = await open(appPage("ebdfy.title('Orders'); ebdfy.toast('Saved')"))
  await expect.poll(() => page.getByRole('status').textContent()).toBe('Saved')
  const panel = await box(page, 'e-admin-panel')
  const header = await box(page, 'e-admin-panel > header')
  const frame = await box(page, 'e-admin-panel > iframe')
  expect(panel.x).toBeCloseTo(228, 0)
  expect(panel.x + panel.width).toBeCloseTo(1430, 0)
  expect(panel.y).toBeCloseTo(58, 0)
  expect(panel.y + panel.height).toBeCloseTo(890, 0)
  expect(frame.x).toBeCloseTo(panel.x, 0)
  expect(frame.x + frame.width).toBeCloseTo(panel.x + panel.width, 0)
  expect(frame.y).toBeCloseTo(header.y + header.height, 0)
  expect(frame.y + frame.height).toBeCloseTo(panel.y + panel.height, 0)
})

// v2-host.js is a deferred module, so on a slow CDN it can arrive after the app has loaded. The app
// only says ready once, so the chrome must be listening before the app's frame starts loading.
test('when the chrome script arrives after the app is ready, the app still counts as ready', async () => {
  const { page } = await pages.open('', 1440, desktop)
  const host = /\/ui\/v2-host\.js$/
  await page.route(host, async (route) => {
    await new Promise((done) => setTimeout(done, 2000))
    await route.continue()
  })
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => title(page), { timeout: 15_000 }).toBe('Orders')
  const bar = page.locator('e-admin-panel').getByRole('progressbar', { name: 'Loading' })
  await expect.poll(() => bar.isVisible()).toBe(false)
})

// The app wears the Admin's theme, so it follows when the device turns dark or the Admin forces one.
test("the app follows the Admin's theme when the device or the Admin changes it", async () => {
  const { page } = await pages.open('', 1440, { ...desktop, colorScheme: 'light' })
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => title(page), { timeout: 15_000 }).toBe('Orders')
  const app = page.frames().find((frame) => isApp(frame.url()))!
  const theme = () => app.evaluate(() => document.documentElement.dataset.theme)
  await expect.poll(theme).toBe('light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(theme).toBe('dark')
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'))
  await expect.poll(theme).toBe('light')
})
