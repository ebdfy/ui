// A plain fetch() from an app in the v2 Admin to the app's own origin carries the staff member's ID
// token and language. A request to any other origin is left alone.
import type { Frame, Page, Request } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

declare const ebdfy: { user(): Promise<{ language: string }> }

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')

async function playground(): Promise<{ page: Page; app: Frame; seen: Request[]; mints: string[] }> {
  const { page } = await pages.open('', 1440, { viewport: { width: 1440, height: 900 } })
  const seen: Request[] = []
  const mints: string[] = []
  page.on('request', (request) => {
    seen.push(request)
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/dev/id-token') mints.push(request.url())
  })
  // Other origins answer here, so no test touches the network.
  await page.route(/^https?:\/\/example\.com\//, (route) =>
    route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' }),
  )
  await page.goto(`${pages.ui}/playground`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).not.toBe('Sample app')
  const app = page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
  await app.waitForFunction(() => 'ebdfy' in globalThis)
  await expect.poll(() => app.evaluate(() => ebdfy.user())).toEqual({ language: 'en' })
  return { page, app, seen, mints }
}

interface Call {
  authorization?: string
  // Passes fetch a Request object instead of a path and an init.
  asRequest?: boolean
}

// Runs one fetch to /api/orders in the app and returns what the server answered with the headers the
// browser sent.
async function send(app: Frame, seen: Request[], call: Call = {}) {
  const before = seen.length
  const answer = await app.evaluate(async ({ authorization, asRequest }) => {
    const init = authorization ? { headers: { Authorization: authorization } } : undefined
    const response = await (asRequest ? fetch(new Request('/api/orders', init)) : fetch('/api/orders', init))
    return { status: response.status, body: await response.text() }
  }, call)
  const sent = seen.slice(before).find((request) => request.frame() === app && !request.url().includes('/dev/'))
  return { ...answer, headers: await sent!.allHeaders() }
}

const claimsOf = (header: string) =>
  JSON.parse(Buffer.from(header.split('.')[1]!, 'base64url').toString()) as { store: string }

test("a fetch to the app's own origin carries the ID token and the staff language", async () => {
  const { app, seen } = await playground()
  const got = await send(app, seen)
  expect(got.headers.authorization).toMatch(/^Bearer /)
  expect(claimsOf(got.headers.authorization!.slice(7)).store).toBe('demo')
  expect(got.headers['accept-language']).toBe('en')
  expect(got.status).toBe(200)
  expect(JSON.parse(got.body)).toEqual({ store: 'demo', language: 'en' })
})

test('after the Admin turns বাংলা the same fetch carries accept-language bn', async () => {
  const { page, app, seen } = await playground()
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await page.locator('#e-user').getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => app.evaluate(() => ebdfy.user())).toEqual({ language: 'bn' })
  const got = await send(app, seen)
  expect(got.headers['accept-language']).toBe('bn')
  expect(JSON.parse(got.body)).toEqual({ store: 'demo', language: 'bn' })
})

test('a request to another origin is left alone', async () => {
  const { app, seen } = await playground()
  for (const url of ['https://example.com/x', '//example.com/x']) {
    const before = seen.length
    await app.evaluate((target) => fetch(target).then((response) => response.text()), url)
    const sent = seen.slice(before).find((request) => new URL(request.url()).host === 'example.com')!
    const headers = await sent.allHeaders()
    expect(headers.authorization).toBeUndefined()
    expect(headers['accept-language']).not.toBe('en')
  }
})

test('a request that brings its own Authorization keeps it', async () => {
  const { app, seen } = await playground()
  const init = await send(app, seen, { authorization: 'Bearer mine' })
  expect(init.headers.authorization).toBe('Bearer mine')
  expect(init.status).toBe(401)
  const request = await send(app, seen, { authorization: 'Bearer mine', asRequest: true })
  expect(request.headers.authorization).toBe('Bearer mine')
  expect(request.status).toBe(401)
})

test('a Request object is signed too', async () => {
  const { app, seen } = await playground()
  const got = await send(app, seen, { asRequest: true })
  expect(got.headers.authorization).toMatch(/^Bearer /)
  expect(got.status).toBe(200)
})

test('two fetches in a row mint one token', async () => {
  const { app, seen, mints } = await playground()
  await send(app, seen)
  await send(app, seen)
  expect(mints).toHaveLength(1)
})

test('the endpoint answers 401 without a token', async () => {
  const response = await fetch(`${pages.sampleApp}/api/orders`)
  expect(response.status).toBe(401)
  expect(await response.json()).toEqual({ error: expect.any(String) })
})

test('outside the Admin the fetch is not signed', async () => {
  const { page } = await pages.open('', 1440)
  const seen: Request[] = []
  page.on('request', (request) => seen.push(request))
  await page.goto(`${pages.sampleApp}/orders`)
  await page.waitForFunction(() => 'ebdfy' in globalThis)
  expect(await page.evaluate(() => fetch('/api/orders').then((response) => response.status))).toBe(401)
  const sent = seen.find((request) => new URL(request.url()).pathname === '/api/orders')!
  expect((await sent.allHeaders()).authorization).toBeUndefined()
})

test("a Request with a body to another origin passes through with its body and the caller's headers", async () => {
  const { page, app } = await playground()
  const bodies: (string | null)[] = []
  await page.route('https://example.com/post', (route) => {
    bodies.push(route.request().postData())
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: 'ok' })
  })
  const status = await app.evaluate(async () => {
    const response = await fetch(new Request('https://example.com/post', { method: 'POST', body: 'hello' }))
    return response.status
  })
  expect(status).toBe(200)
  expect(bodies).toEqual(['hello'])
})

test('an address that reads differently each time it is read is signed only for what is fetched', async () => {
  const { app, seen } = await playground()
  const before = seen.length
  await app.evaluate(async () => {
    let reads = 0
    const shifty = { toString: () => (reads++ === 0 ? '/api/orders' : 'https://example.com/shifty') }
    await fetch(shifty as unknown as string).catch(() => undefined)
  })
  const sent = seen.slice(before).find((request) => request.url().includes('example.com'))
  if (sent) expect((await sent.allHeaders()).authorization).toBeUndefined()
  const own = seen.slice(before).find((request) => request.url().includes('/api/orders'))
  expect(Boolean(sent) || Boolean(own)).toBe(true)
})
