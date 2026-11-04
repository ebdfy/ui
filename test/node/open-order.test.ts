import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// A click or a tap on an order's row opens that order: beside the list from 1040 px, on its own page
// below.
test('at 1280 px a click on the #1042 row shows #1042 in the pane and marks its row open', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 1280)
  const row = page.locator('eb-row', { hasText: '#1042' })
  await row.waitFor({ timeout: 15_000 })
  const pane = page.locator('.pane')
  await pane.locator('eb-heading:defined').first().waitFor()
  await row.click()
  await expect.poll(() => pane.locator('eb-heading[level="1"]').textContent()).toBe('#1042')
  expect(await pane.locator('eb-heading[level="2"]').textContent()).toBe('৳1,250')
  expect(await pane.locator('eb-card', { has: page.locator('eb-avatar') }).innerText()).toContain('Rahim Uddin')
  const open = () => page.locator('eb-row[open]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-number')))
  expect(await open()).toEqual(['1042'])
  // The list stays; only the pane changes.
  expect(new URL(page.url()).pathname).toBe('/')
  await page.locator('.languages eb-button[data-lang="bn"]').click()
  await expect.poll(() => pane.locator('eb-heading[level="2"]').textContent()).toBe('৳১,২৫০')
  expect(await pane.locator('eb-card', { has: page.locator('eb-avatar') }).innerText()).toContain('রহিম উদ্দিন')
  expect(await open()).toEqual(['1042'])
  expect(errors).toEqual([])
})

test('in the playground at 360 px a tap on the #1042 card opens order #1042, and Back returns to the list', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360, { hasTouch: true })
  const app = page.frameLocator('eb-admin-chrome iframe')
  const title = page.locator('eb-admin-chrome [part="title"]')
  const card = app.locator('eb-row', { hasText: '#1042' })
  await card.waitFor({ timeout: 15_000 })
  await card.tap()
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Order #1042')
  await app.locator('#order eb-heading:defined').first().waitFor({ timeout: 15_000 })
  expect(await app.locator('#order eb-heading[level="2"]').first().textContent()).toBe('৳1,250')
  expect(await app.locator('#order eb-card', { has: app.locator('eb-avatar') }).innerText()).toContain('Rahim Uddin')
  // The browser's Back: only the frame moved, which page.goBack() would wait on as a navigation of
  // the playground itself.
  await page.evaluate(() => history.back())
  await app.locator('eb-row', { hasText: '#1042' }).waitFor({ timeout: 15_000 })
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Orders')
  expect(errors).toEqual([])
})

// Inside the Admin a row's link keeps the store, so a new tab opens inside the Admin too, and #1039's
// is its nav entry's own address, which the Admin then marks current.
test('in the playground at 360 px a tap on the #1039 card keeps the store and marks its nav entry current', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360, { hasTouch: true })
  const app = page.frameLocator('eb-admin-chrome iframe')
  const card = app.locator('eb-row', { hasText: '#1039' })
  await card.waitFor({ timeout: 15_000 })
  expect(await app.locator('eb-row[data-number="1042"]').getAttribute('href')).toBe('/order-1039?store=demo&order=1042')
  await card.tap()
  const current = page.locator('eb-admin-chrome [part="app-nav"] a[aria-current="page"]')
  await expect.poll(() => current.allInnerTexts(), { timeout: 15_000 }).toEqual(['Order #1039'])
  expect(errors).toEqual([])
})

test('every order row links to its order, so it takes the pointer and the hover', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/`, 1280)
  await page.locator('eb-row').first().waitFor({ timeout: 15_000 })
  const links = await page
    .locator('eb-row')
    .evaluateAll((rows) => rows.map((row) => [row.getAttribute('data-number'), row.getAttribute('href')]))
  expect(links).toEqual([
    ['1042', '/order-1039?order=1042'],
    ['1041', '/order-1039?order=1041'],
    ['1040', '/order-1039?order=1040'],
    ['1039', '/order-1039'],
    ['1038', '/order-1039?order=1038'],
  ])
  const cursor = await page
    .locator('eb-row')
    .first()
    .evaluate((row) => getComputedStyle(row.shadowRoot!.querySelector('[part="row"]')!).cursor)
  expect(cursor).toBe('pointer')
})

// What a row opens is that order: its status as the list shows it, items that add up to its total,
// and only the actions that order still takes.
test('at 1280 px each opened order agrees with its row, adds up, and offers only what it still takes', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 1280)
  const pane = page.locator('.pane')
  await page.locator('eb-row', { hasText: '#1042' }).waitFor({ timeout: 15_000 })
  await pane.locator('eb-heading:defined').first().waitFor()
  const seen = []
  for (const number of ['1042', '1041', '1040', '1039', '1038']) {
    const row = page.locator(`eb-row[data-number="${number}"]`)
    await row.click()
    await expect.poll(() => pane.locator('eb-heading[level="1"]').textContent()).toBe(`#${number}`)
    const status = (root: Element) => {
      const el = root.querySelector('eb-badge, eb-courier-status')!
      return `${el.localName} ${el.getAttribute('status') ?? el.textContent!.trim()}`
    }
    const listed = await row.evaluate(status)
    const shown = await pane.locator('.pane-content').evaluate(status)
    const taka = (text: string) => Number(text.replace(/[^\d]/g, ''))
    const total = taka((await pane.locator('eb-heading[level="2"]').textContent())!)
    const lines = await pane
      .locator('eb-card[heading] .order-row > eb-text:last-child')
      .evaluateAll((els) => els.map((el) => el.textContent!))
    const actions = await pane.locator('.pane-actions eb-button').allInnerTexts()
    seen.push({ number, listed, shown, adds: lines.map(taka).reduce((a, b) => a + b, 0) === total, actions })
  }
  expect(seen).toEqual([
    {
      number: '1042',
      listed: 'eb-badge New',
      shown: 'eb-badge New',
      adds: true,
      actions: ['Ask for advance', 'Confirm order'],
    },
    { number: '1041', listed: 'eb-badge Confirmed', shown: 'eb-badge Confirmed', adds: true, actions: [] },
    {
      number: '1040',
      listed: 'eb-courier-status IN_TRANSIT',
      shown: 'eb-courier-status IN_TRANSIT',
      adds: true,
      actions: [],
    },
    {
      number: '1039',
      listed: 'eb-badge New',
      shown: 'eb-badge New',
      adds: true,
      actions: ['Ask for advance', 'Confirm order'],
    },
    {
      number: '1038',
      listed: 'eb-courier-status RETURNED',
      shown: 'eb-courier-status RETURNED',
      adds: true,
      actions: [],
    },
  ])
  expect(errors).toEqual([])
})
