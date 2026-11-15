// An app still on the frozen 2.0 script, which sends only saveBar { visible } and presses its form's
// buttons on the Admin's word, gets the same bar. The script is @ebdfy/ui 2.0.0's v2.js from npm,
// kept gzipped beside this test. A built script talks only to the Admin's real hosts, so the test
// serves the playground as ui.ebdfy.com and the app as sample-app.ebdfy.com.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

const frozen = gunzipSync(readFileSync(new URL('fixtures/ui-2.0.0-v2.js.gz', import.meta.url)))
const ui = 'https://ui.ebdfy.com'
const sampleApp = 'https://sample-app.ebdfy.com'

// An app page on 2.0: a settings form the bar watches, whose submits it counts.
const appPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="ebdfy-app" content="sample" />
    <link rel="stylesheet" href="/ui/v2.css" />
    <script type="module" src="/ui/v2.0.js"></script>
  </head>
  <body>
    <form data-save-bar>
      <e-text-field name="note" label="Note" value="first"></e-text-field>
    </form>
    <script>
      document.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault()
        globalThis.submits = (globalThis.submits ?? 0) + 1
      })
    </script>
  </body>
</html>`

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(): Promise<{ page: Page; app: Frame }> {
  const { page } = await pages.open('', 1440, { viewport: { width: 1440, height: 900 } })
  const context = page.context()
  await context.addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  // The playground as ui.ebdfy.com, its pages naming the app at sample-app.ebdfy.com.
  await context.route(`${ui}/**`, async (route) => {
    const url = new URL(route.request().url())
    // Vite tells a page from its script of the same name by the fetch's destination, which a
    // fetch made for a routed request does not carry.
    const headers = route.request().headers()
    if (route.request().resourceType() === 'document') headers['sec-fetch-dest'] = 'document'
    const response = await route.fetch({ url: `${pages.ui}${url.pathname}${url.search}`, headers })
    const type = response.headers()['content-type'] ?? ''
    if (!type.includes('html')) return route.fulfill({ response })
    const body = (await response.text()).replaceAll(pages.sampleApp, sampleApp).replaceAll(pages.ui, ui)
    return route.fulfill({ status: response.status(), contentType: type, body })
  })
  await context.route(`${sampleApp}/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/frozen') return route.fulfill({ contentType: 'text/html', body: appPage })
    if (url.pathname === '/ui/v2.0.js') return route.fulfill({ contentType: 'text/javascript', body: frozen })
    return route.fulfill({ response: await route.fetch({ url: `${pages.sampleApp}${url.pathname}${url.search}` }) })
  })
  await page.goto(`${ui}/playground?page=/frozen`)
  const app = (await (await page.locator('e-admin-panel > iframe').elementHandle())!.contentFrame())!
  await app.locator('e-text-field input').waitFor()
  return { page, app }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const note = (app: Frame) => app.locator('e-text-field input')

test('the kept script is @ebdfy/ui 2.0.0 as npm has it', () => {
  expect(createHash('sha256').update(frozen).digest('hex')).toBe(
    '06cd483aeda4e482e648e247c106b2dd4684cf75e95bf03225f241dcd4793165',
  )
})

test("a page on the frozen v2.0.js raises the bar, and the host's Save submits its form", async () => {
  const { page, app } = await open()
  await note(app).fill('second')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await bar(page).locator('.e-save-bar-message > span:visible').textContent()).toBe('Unsaved changes')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { submits?: number }).submits)).toBe(1)
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test("the host's Discard puts a frozen page's field back", async () => {
  const { page, app } = await open()
  await note(app).fill('second')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => note(app).inputValue()).toBe('first')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})
