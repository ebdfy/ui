// Every v2 docs page, read the way a phone reads it: drawn whole before v2.js, with a Bangla example,
// its tags' API from the manifest, nothing wider than its box, and the same with JavaScript off. The manifest names every
// attribute v2.css styles on a tag, with every value it styles.
import { existsSync, readdirSync, readFileSync } from 'node:fs'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { v2DocsManifest } from '../../scripts/docs-api.ts'
import { v2Pages } from '../../scripts/docs-v2.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const fileOf = (path: string) => new URL(`../../site/ui${path}.html`, import.meta.url)
const src = new URL('../../src/', import.meta.url)

test('every component in the sidebar has its page', () => {
  expect(v2Pages.filter((page) => !existsSync(fileOf(page.path))).map((page) => page.path)).toEqual([])
})

test('every tag the kit defines or v2.css draws is documented on exactly one page', () => {
  const sources = readdirSync(new URL('v2/', src)).map((file) => readFileSync(new URL(`v2/${file}`, src), 'utf8'))
  const defined = sources.flatMap((source) =>
    [...source.matchAll(/customElements\.define\('(e-[a-z-]+)'/g)].map((m) => m[1]!),
  )
  const drawn = sources.flatMap((source) => [...source.matchAll(/^(e-[a-z-]+)(?=[\s,{:[>.])/gm)].map((m) => m[1]!))
  const kit = [...new Set([...defined, ...drawn])].sort()
  const documented = v2Pages.flatMap((page) => page.tags)
  expect(kit.filter((tag) => documented.filter((one) => one === tag).length !== 1)).toEqual([])
  expect(documented.filter((tag) => !kit.includes(tag))).toEqual([])
  const declared = v2DocsManifest().modules.flatMap((m) => (m.declarations ?? []).map((d) => d.tagName))
  expect(kit.filter((tag) => !declared.includes(tag))).toEqual([])
})

const everyPage = [{ path: '/', title: 'ebdfy design system' }, ...v2Pages]

test.for(everyPage)(
  '$title: with JavaScript off at 360 px it reads, and its links lead on',
  async ({ path, title }) => {
    const { page } = await pages.open('', 360, { javaScriptEnabled: false })
    await page.goto(`${pages.ui}${path}`)
    expect(await page.locator('h1').textContent()).toBe(title)
    expect(await page.locator('h1').isVisible()).toBe(true)
    for (const example of await page.locator('figure.example').all()) {
      expect(await example.locator('.demo').isVisible()).toBe(true)
      expect(await example.locator('pre').isVisible()).toBe(true)
    }
    if (path !== '/') expect(await page.locator('section.api h3').first().isVisible()).toBe(true)
    // Copy needs the script, so a page without it shows none.
    expect(await page.locator('button.copy:visible').count()).toBe(0)
    // Every e-table on the page shows its rows.
    for (const table of await page.locator('e-table').all()) {
      if (await table.isVisible()) expect((await table.boundingBox())?.height).toBeGreaterThan(0)
    }
    await page.getByText('Pages', { exact: true }).click()
    const next = v2Pages[v2Pages.findIndex((one) => one.path === path) + 1] ?? v2Pages[0]!
    await page.locator('.menu nav').getByRole('link', { name: next.title, exact: true }).click()
    await page.waitForURL(`**${next.path}`)
    expect(await page.locator('h1').textContent()).toBe(next.title)
  },
)

test.for(v2Pages)(
  '$title: drawn whole before v2.js, with a Bangla example and its API',
  async ({ path, title, tags }) => {
    const { page, errors } = await pages.open('', 360)
    await page.route('**/ui/v2.js', (route) => route.abort())
    await page.goto(`${pages.ui}${path}`)
    expect(await page.locator('h1').textContent()).toBe(title)
    expect(await page.locator('figure.example').count()).toBeGreaterThanOrEqual(2)
    expect(await page.locator('figure.example[lang="bn"]').count()).toBeGreaterThanOrEqual(1)
    expect(await page.locator('section.api h3').allTextContents()).toEqual(tags)
    const unstyled = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((element) => element.localName.startsWith('e-') && element.checkVisibility())
        .map((element) => ({
          name: element.localName,
          display: getComputedStyle(element).display,
          height: element.getBoundingClientRect().height,
          // e-link is inline on purpose, taking its sentence's size: it is drawn when its link has the
          // kit's 2 px underline offset, not the browser's own.
          link: getComputedStyle(element.querySelector('a') ?? element).textUnderlineOffset === '2px',
        }))
        // A row shown as display: contents has no box by design.
        .filter(
          ({ name, display, height, link }) =>
            (display === 'inline' && !(name === 'e-link' && link)) || (display !== 'contents' && height === 0),
        )
        .map(({ name, display, height }) => `${name}: ${display}, ${height} px tall`),
    )
    expect(unstyled).toEqual([])
    // The one error is the blocked v2.js itself.
    expect(errors).toEqual(['Failed to load resource: net::ERR_FAILED'])
  },
)

test.for(everyPage)(
  '$title: in Bangla at 360 px nothing is wider than its box, once v2.js has built it',
  async ({ path }) => {
    const { page, errors } = await pages.open(`${pages.ui}${path}`, 360)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => (document.documentElement.lang = 'bn'))
    await page.evaluate(() => document.fonts.ready)
    const wide = await page.evaluate(() => {
      const over = (element: Element) => element.scrollWidth > element.clientWidth + 1
      const found = [...document.querySelectorAll('.frame, .demo, main')]
        .filter(over)
        .map((element) => `${element.className || element.localName}: ${element.scrollWidth} > ${element.clientWidth}`)
      if (document.documentElement.scrollWidth > innerWidth) found.push(`page: ${document.documentElement.scrollWidth}`)
      return found
    })
    expect(wide).toEqual([])
    expect(errors).toEqual([])
  },
)

// Attributes the kit sets on its own tags for a state, which an app never writes.
const kitStates = new Set(['e-index-table[empty]', 'e-index-table[selecting]', 'e-row[selected]'])

test('the manifest names each attribute v2.css styles on a documented tag, with each value it styles', () => {
  const documented = new Set(v2Pages.flatMap((page) => page.tags))
  const declarations = v2DocsManifest().modules.flatMap((m) => m.declarations ?? [])
  const css = readdirSync(new URL('../../src/v2/', import.meta.url))
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(new URL(`../../src/v2/${file}`, import.meta.url), 'utf8'))
    .join('\n')
  // Each attribute a rule selects on a tag: written straight after it, e-x[a='v'], or in a list,
  // e-x:is([a='v'], [a='w']).
  const selected = [
    ...[...css.matchAll(/(?<![\w-])(e-[a-z-]+)\[([a-z-]+)(?:='([^']*)')?\]/g)].map(([, tag, name, value]) => ({
      tag,
      name,
      value,
    })),
    ...[...css.matchAll(/(?<![\w-])(e-[a-z-]+):(?:is|where|not)\(([^()]*)\)/g)].flatMap(([, tag, list = '']) =>
      [...list.matchAll(/\[([a-z-]+)(?:='([^']*)')?\]/g)].map(([, name, value]) => ({ tag, name, value })),
    ),
  ]
  const missing: string[] = []
  for (const { tag = '', name = '', value } of selected) {
    if (!documented.has(tag) || /^(data-|aria-)|^(slot|hidden|role|lang|dir|style|class)$/.test(name)) continue
    if (kitStates.has(`${tag}[${name}]`)) continue
    const attribute = declarations.find((d) => d.tagName === tag)?.attributes?.find((a) => a.name === name)
    if (!attribute) missing.push(`${tag}[${name}]`)
    else if (
      value !== undefined &&
      /'/.test(attribute.type?.text ?? '') &&
      !attribute.type?.text.includes(`'${value}'`)
    )
      missing.push(`${tag}[${name}='${value}'] in ${attribute.type?.text}`)
  }
  expect([...new Set(missing)]).toEqual([])
})
