// v2's docs frame: a sidebar of every component in its group, pages that are whole in their first
// frame, examples whose Copy gives their exact code, and an API section
// from the manifest. All of it reads with JavaScript off.
import { readFileSync } from 'node:fs'

import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { codeOf, firstExample } from '../../scripts/docs-examples.ts'
import { v2Groups } from '../../scripts/docs-v2.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// Each e-* tag v2.css did not draw: it keeps the browser's inline default, or has no box at all. A
// row shown as display: contents has no box by design, and a tag the layout hides needs none.
const unstyled = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('*')]
      .filter((element) => element.localName.startsWith('e-') && element.checkVisibility())
      .map((element) => ({
        name: element.localName,
        display: getComputedStyle(element).display,
        height: element.getBoundingClientRect().height,
      }))
      .filter(({ display, height }) => display === 'inline' || (display !== 'contents' && height === 0))
      .map(({ name, display, height }) => `${name}: ${display}, ${height} px tall`),
  )

test('the sidebar lists the 53 components in the spec’s groups, the current one marked', async () => {
  expect(v2Groups.map((group) => group.name)).toEqual([
    'Actions',
    'Layout',
    'Text and status',
    'Forms',
    'Data',
    'Overlays and feedback',
    'Helpers',
    'Bangladesh',
  ])
  const all = v2Groups.flatMap((group) => group.pages)
  expect(all).toHaveLength(53)
  expect(all.map((page) => page.title)).toEqual(
    expect.arrayContaining(['Index table', 'Metrics', 'Settings section', 'Setup guide', 'Modal', 'Table']),
  )
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280)
  const sidebar = page.getByRole('navigation', { name: 'Components' })
  expect(await sidebar.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual([
    '/',
    ...all.map((one) => one.path),
  ])
  expect(await sidebar.locator('[aria-current="page"]').textContent()).toBe('Button')
})

// The fade itself is checked on the built site (test/speed/first-frame.test.ts): Vite's dev client
// aborts a cross-document view transition.
test('moving from Button to Card with v2.js blocked shows every tag drawn', async () => {
  const { page } = await pages.open('', 1280)
  await page.route('**/ui/v2.js', (route) => route.abort())
  await page.goto(`${pages.ui}/components/button`)
  expect(await unstyled(page)).toEqual([])
  await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Card', exact: true }).click()
  await page.waitForURL('**/components/card')
  expect(await page.locator('h1').textContent()).toBe('Card')
  expect(await page.locator('e-card').count()).toBeGreaterThan(1)
  expect(await unstyled(page)).toEqual([])
})

// The language switch's words come from docs.js alone; only the taka amounts need the kit's format.
test('in Bangla with v2.js blocked the Card page throws nothing and still switches its words', async () => {
  const { page, errors } = await pages.open('', 1280)
  await page.route('**/ui/v2.js', (route) => route.abort())
  await page.goto(`${pages.ui}/components/card`)
  await page.evaluate(() => localStorage.setItem('ebdfy-docs-v2-lang', 'bn'))
  await page.reload()
  await page.locator('[data-bn]').first().waitFor()
  expect(
    await page
      .locator('[data-bn]')
      .first()
      .evaluate((tag) => tag.textContent === tag.dataset.bn),
  ).toBe(true)
  expect(errors.filter((error) => !error.startsWith('Failed to load resource'))).toEqual([])
})

test('a browser that skips the transition still lands on the styled page', async () => {
  // A browser without the fade (the dev server aborts it) lands on the styled page all the same.
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280, { reducedMotion: 'reduce' })
  await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Card', exact: true }).click()
  await page.waitForURL('**/components/card')
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)).not.toBe(
    'rgba(0, 0, 0, 0)',
  )
  expect(await unstyled(page)).toEqual([])
})

test.for([360, 1280])('with JavaScript off at %i px the pages read and link to each other', async (width) => {
  const { page } = await pages.open('', width, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/button`)
  expect(await page.locator('h1').textContent()).toBe('Button')
  expect(await page.locator('figure.example').count()).toBeGreaterThan(2)
  expect(await page.locator('figure.example e-button').first().isVisible()).toBe(true)
  expect(await page.locator('section.api dt').count()).toBeGreaterThan(2)
  // A phone opens the page list without a script.
  if (width < 1024) await page.getByText('Pages', { exact: true }).click()
  await page.getByRole('navigation', { name: 'Components' }).getByRole('link', { name: 'Card', exact: true }).click()
  await page.waitForURL('**/components/card')
  expect(await page.locator('h1').textContent()).toBe('Card')
  expect(await unstyled(page)).toEqual([])
})

test('an example’s Copy puts its exact code on the clipboard', async () => {
  const { page } = await pages.open('', 1280, { permissions: ['clipboard-read', 'clipboard-write'] })
  await page.goto(`${pages.ui}/components/card`)
  const source = readFileSync(new URL('../../site/ui/components/card.html', import.meta.url), 'utf8')
  await page.locator('figure.example').first().getByRole('button', { name: 'Copy' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(codeOf(firstExample(source)))
})

test('the Button page’s API names each tone e-button allows', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280)
  const api = page.locator('section.api')
  expect(await api.locator('h3').textContent()).toBe('e-button')
  expect(await api.locator('dt', { hasText: 'tone' }).textContent()).toContain("'primary' | 'plain'")
})

test('the overview lists every group and every component', async () => {
  const { page } = await pages.open(`${pages.ui}/`, 360)
  const main = page.locator('main')
  for (const group of v2Groups) expect(await main.getByRole('heading', { name: group.name }).count()).toBe(1)
  expect(await main.getByRole('link').count()).toBe(v2Groups.flatMap((group) => group.pages).length)
})

// The docs page's own heading styles stay out of the examples, so a heading the script builds sits
// where the CSS drew it.
test('an example whose heading the script builds does not move when v2.js runs', async () => {
  const read = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.example e-empty-state, .example e-card[heading]')].map((tag) =>
        Math.round(tag.getBoundingClientRect().height),
      ),
    )
  for (const path of ['/components/empty-state', '/components/card']) {
    // Each page holds v2.js back until the first read, so that read sees the CSS alone.
    const { page } = await pages.open('', 1440)
    let release = () => {}
    const held = new Promise<void>((done) => (release = done))
    await page.route(/\/ui\/v2\.js/, async (route) => {
      await held
      await route.continue()
    })
    const loaded = page.goto(`${pages.ui}${path}`)
    await page.waitForSelector('.example')
    const before = await read(page)
    expect(before.length).toBeGreaterThan(0)
    release()
    await loaded
    await page.waitForFunction(() => customElements.get('e-empty-state') && customElements.get('e-card'))
    expect(await read(page), path).toEqual(before)
  }
})
