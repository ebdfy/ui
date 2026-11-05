// Size: v2.css and v2.js gzipped against their budgets, and every byte the first Admin screen fetches,
// the playground with the sample app's orders list, against 120 KB.
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { chromium, type Browser } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { budgets, over, report, type Line } from './budgets.ts'
import { startSite } from './site.ts'

let site: Awaited<ReturnType<typeof startSite>>
let browser: Browser

beforeAll(async () => {
  site = await startSite()
  browser = await chromium.launch()
}, 180_000)

afterAll(async () => {
  await browser?.close()
  await site?.close()
})

const gz = (bytes: Buffer | string) => gzipSync(bytes, { level: 9 }).length

export function kitSizes(css: Buffer | string, js: Buffer | string): Line[] {
  return [
    { what: 'v2.css, gzipped', value: gz(css), budget: budgets.css, unit: 'bytes' },
    { what: 'v2.js, gzipped', value: gz(js), budget: budgets.js, unit: 'bytes' },
  ]
}

const built = (name: string) => readFileSync(join(site.out, 'cdn/ui', name))

test('v2.css and v2.js are within their budgets', () => {
  const lines = kitSizes(built('v2.css'), built('v2.js'))
  console.log(report(lines))
  expect(over(lines)).toEqual([])
})

test('a v2.js padded by 40 KB is over its budget', () => {
  // Random text, which gzip cannot shrink much, as a large dependency would not shrink.
  const padding = `/*${randomBytes(30 * 1000).toString('base64')}*/`
  expect(padding.length).toBeGreaterThanOrEqual(40 * 1000)
  const lines = kitSizes(built('v2.css'), Buffer.concat([built('v2.js'), Buffer.from(padding)]))
  expect(over(lines).map(({ what }) => what)).toEqual(['v2.js, gzipped'])
})

test('a v2.css padded by 30 KB is over its budget', () => {
  const padding = `/*${randomBytes(25 * 1000).toString('base64')}*/`
  const lines = kitSizes(Buffer.concat([built('v2.css'), Buffer.from(padding)]), built('v2.js'))
  expect(over(lines).map(({ what }) => what)).toEqual(['v2.css, gzipped'])
})

// Every response the playground and its framed orders page fetch, by its bytes on the wire. Noto Sans
// Bengali is left out: the phones this counts for draw Bangla in their own copy. The test
// server caches nothing, so v2.css and Manrope count once for the Admin and again for the app's frame,
// where a phone's cache would answer the second; the count errs high, never low.
test.for(['en', 'bn'])('the first Admin screen in %s is within 120 KB', async (lang) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
  await context.addInitScript((chosen) => {
    // The Admin's language, which the app follows, and the app's own for its first paint.
    localStorage.setItem('ebdfy-playground-lang', chosen)
    localStorage.setItem('ebdfy-sample-lang', chosen)
  }, lang)
  const page = await context.newPage()
  const fetched: { url: string; bytes: number }[] = []
  page.on('requestfinished', async (request) => {
    const { responseBodySize } = await request.sizes()
    fetched.push({ url: request.url(), bytes: responseBodySize })
  })
  await page.goto(`${site.ui}/playground`, { waitUntil: 'networkidle' })
  await context.close()
  const counted = fetched.filter(({ url }) => !url.includes('noto-sans-bengali'))
  const lines: Line[] = counted.map(({ url, bytes }) => ({
    what: `  ${new URL(url).pathname}`,
    value: bytes,
    budget: Number.POSITIVE_INFINITY,
    unit: 'bytes',
  }))
  const total: Line = {
    what: `first Admin screen, ${lang}, ${counted.length} responses`,
    value: counted.reduce((sum, { bytes }) => sum + bytes, 0),
    budget: budgets.firstScreen,
    unit: 'bytes',
  }
  console.log(report([total, ...lines]))
  expect(counted.map(({ url }) => new URL(url).pathname)).toEqual(
    expect.arrayContaining([
      '/playground',
      '/ui/v2.css',
      '/ui/v2-host.js',
      '/orders',
      '/ui/v2.js',
      '/ui/icons.svg',
      '/ui/fonts/manrope-latin-wght-normal.woff2',
    ]),
  )
  expect(over([total])).toEqual([])
})
