// A page that loads v2.js from a blob: URL, as a Design canvas does through an import map, has no
// folder beside the script for icons.svg or areas.json. It names their URLs in meta tags, and the
// icons and the district picker's upazilas still arrive.
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type Browser, chromium } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { buildEntry, copySprite } from '../../scripts/build.ts'

const out = mkdtempSync(join(tmpdir(), 'ebdfy-v2-blob-'))
let server: Server
let origin: string
let browser: Browser

// The canvas fetches v2.js and runs it from a blob: URL; named says whether it names the files.
const canvas = (named: boolean) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
${named ? '<meta name="ebdfy-icons" content="/icons.svg"><meta name="ebdfy-areas" content="/areas.json">' : ''}
</head><body><e-icon name="truck"></e-icon><e-district-picker district="dhaka"></e-district-picker>
<script type="module">
const source = await (await fetch('/v2.js')).text()
await import(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })))
window.ran = true
</script></body></html>`

beforeAll(async () => {
  await buildEntry('v2', out)
  await copySprite(out)
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    if (path === '/canvas') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      return res.end(canvas(new URL(req.url ?? '/', 'http://x').searchParams.has('named')))
    }
    try {
      const body = readFileSync(join(out, path.slice(1)))
      const type = path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.svg')
          ? 'image/svg+xml'
          : 'application/json'
      res.writeHead(200, { 'content-type': type })
      res.end(body)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  browser = await chromium.launch()
}, 120_000)

afterAll(async () => {
  await browser?.close()
  await new Promise((done) => server?.close(done))
})

async function open(named: boolean) {
  const page = await browser.newPage()
  await page.goto(`${origin}/canvas${named ? '?named' : ''}`)
  await page.waitForFunction(() => (window as unknown as { ran?: boolean }).ran)
  return page
}

const upazilas = (page: Awaited<ReturnType<typeof open>>) =>
  page.evaluate(() => document.querySelectorAll('e-district-picker select')[1]?.querySelectorAll('option').length ?? 0)

test('a canvas that names the sprite and the areas file draws icons and lists upazilas', async () => {
  const page = await open(true)
  await page.locator('e-icon[name="truck"] svg use').waitFor({ state: 'attached' })
  expect(await page.locator('e-icon[name="truck"] svg use').getAttribute('href')).toBe('#e-icon-truck')
  await expect.poll(() => upazilas(page)).toBeGreaterThan(5)
  await page.close()
})

test('the same canvas naming nothing has no icon, as a blob: URL has no folder beside it', async () => {
  const page = await open(false)
  await page.waitForLoadState('networkidle')
  expect(await page.locator('e-icon svg').count()).toBe(0)
  expect(await upazilas(page)).toBeLessThanOrEqual(1)
  await page.close()
})
