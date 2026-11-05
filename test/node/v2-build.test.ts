// The CDN serves v2 alone: v2.css and v2.js for apps, v2-host.css and v2-host.js for the Admin
// chrome, with no Lit in either script, and every CSS rule in layer e.
import { mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { transform } from 'lightningcss'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { buildSite } from '../../scripts/build.ts'
import { production } from '../../scripts/pages.ts'
import { startPages } from './pages.ts'

const site = mkdtempSync(join(tmpdir(), 'ebdfy-v2-build-'))
const out = join(site, 'cdn/ui')

beforeAll(async () => {
  await buildSite(site, production)
}, 120_000)

test('the CDN folder holds v2 and no v1 script', () => {
  const files = readdirSync(out)
  expect(files).toEqual(expect.arrayContaining(['v2.js', 'v2-host.js', 'v2.css', 'v2-host.css']))
  expect(files.filter((file) => file === 'host.js' || /^v1(\..*)?\.js$/.test(file))).toEqual([])
})

const root = fileURLToPath(new URL('../../', import.meta.url))

// Every text file under the folder, as its path from the package root.
const textFiles = (folder: string) =>
  readdirSync(join(root, folder), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|css|html|js|mjs|json|svg|txt)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length))

test('no source, site or script names a v1 eb-* element or --eb- token', () => {
  const found = ['src', 'site', 'scripts'].flatMap(textFiles).flatMap((file) =>
    readFileSync(join(root, file), 'utf8')
      .split('\n')
      .flatMap((line, i) => (/\beb-[a-z]|--eb-/.test(line) ? [`${file}:${i + 1}`] : [])),
  )
  expect(found).toEqual([])
})

test('icons.svg sits beside v2.js, with a symbol for the truck', () => {
  expect(readFileSync(join(out, 'icons.svg'), 'utf8')).toContain('<symbol id="e-icon-truck"')
})

test('areas.json sits beside v2.js, with Mirpur under Dhaka', () => {
  expect(readFileSync(join(out, 'areas.json'), 'utf8')).toContain('["Mirpur", "মিরপুর"]')
})

// The name and layer of each top-level rule, as a browser would read the sheet.
function topLevel(css: string): string[] {
  const found: string[] = []
  transform({
    filename: 'v2.css',
    code: Buffer.from(css),
    visitor: {
      StyleSheet(sheet) {
        for (const rule of sheet.rules) {
          const names = 'value' in rule && rule.value && typeof rule.value === 'object' ? rule.value : {}
          if (rule.type === 'layer-block') found.push(`layer ${(names as { name?: string[] }).name?.join('.')}`)
          else if (rule.type === 'layer-statement')
            found.push(`layers ${(names as { names: string[][] }).names.join(',')}`)
          else found.push(rule.type)
        }
      },
    },
  })
  return found
}

test('a rule outside layer e is caught', () => {
  expect(topLevel('@layer e; @layer e { a { color: red } } b { color: blue }')).toEqual([
    'layers e',
    'layer e',
    'style',
  ])
})

test.for(['v2', 'v2-host'])('%s.css holds every rule in layer e', (name) => {
  const css = readFileSync(join(out, `${name}.css`), 'utf8')
  expect(css).not.toContain('@import')
  const rules = topLevel(css)
  expect(rules.length).toBeGreaterThan(0)
  expect(rules.filter((rule) => rule !== 'layers e' && rule !== 'layer e')).toEqual([])
})

test.for(['v2', 'v2-host'])('%s.js is built with no Lit in it', (name) => {
  const js = readFileSync(join(out, `${name}.js`), 'utf8')
  expect(js).not.toContain('litHtmlVersions')
  // The marker this test reads is the one lit-html carries.
  const lit = createRequire(realpathSync(join(root, 'node_modules/lit/package.json')))
  expect(readFileSync(lit.resolve('lit-html'), 'utf8')).toContain('litHtmlVersions')
})

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('in development the Button page loads v2.css from the source, in layer e, and v2.js with its bridge', async () => {
  const { page, errors } = await pages.open('')
  const css = page.waitForResponse((response) => response.url().endsWith('/ui/v2.css'))
  await page.goto(`${pages.ui}/components/button`)
  const response = await css
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('text/css')
  await page.waitForFunction(() => typeof (globalThis as { ebdfy?: { title?: unknown } }).ebdfy?.title === 'function')
  // Every top-level rule of the sheet is layer e, as a statement or a block.
  const layers = await page.evaluate(() =>
    [...document.styleSheets]
      .filter((sheet) => sheet.href?.endsWith('/ui/v2.css'))
      .flatMap((sheet) =>
        [...sheet.cssRules].map((rule) =>
          rule instanceof CSSLayerStatementRule
            ? rule.nameList.join()
            : rule instanceof CSSLayerBlockRule
              ? rule.name
              : rule.constructor.name,
        ),
      ),
  )
  expect(layers.length).toBeGreaterThan(0)
  expect(layers.filter((name) => name !== 'e')).toEqual([])
  expect(errors).toEqual([])
})

// Dev answers v2.css as the build bundles it, url()s as written, and serves the fonts beside it, so a
// page's font preload names the same URL in dev as on the CDN.
test('in development v2.css keeps its url()s as written and the fonts answer beside it', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`)
  const sheet = await page.evaluate(async () => (await fetch('/ui/v2.css')).text())
  expect(sheet).not.toContain('/@fs/')
  expect(sheet).not.toContain('@import')
  const font = await page.evaluate(async () => {
    const response = await fetch('/ui/fonts/noto-sans-bengali-bangla.woff2')
    return { status: response.status, type: response.headers.get('content-type') }
  })
  expect(font).toEqual({ status: 200, type: 'font/woff2' })
})

test('a v2 page gets v2’s docs frame, never v1’s: no eb-* tag, v1 sheet or v1.js', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`)
  expect(await page.locator('h1').textContent()).toBe('Button')
  expect(await page.locator('nav.pages[aria-label="Components"]').count()).toBeGreaterThan(0)
  expect(
    await page.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.localName.startsWith('eb-')).length),
  ).toBe(0)
  // v1's docs sheet was /docs.css, where v2's now is, so the page names exactly v2's two sheets.
  const sheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(sheets).toEqual(['/ui/v2.css', '/docs.css'])
  expect(await page.locator('script[src*="v1.js"]').count()).toBe(0)
})

test("the v2 playground frames the sample app's v2 page, which loads v2.js", async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`)
  const app = page.frameLocator('iframe')
  await expect.poll(() => app.locator('h1').textContent()).toBe('Orders')
  const frame = page.frames().find((candidate) => candidate.url().startsWith(`${pages.sampleApp}/`))
  await frame!.waitForFunction(() => typeof (globalThis as { ebdfy?: unknown }).ebdfy === 'object')
  expect(errors).toEqual([])
})
