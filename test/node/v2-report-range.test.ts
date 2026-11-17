// The report builder's date range: the presets, and From and To only for Custom, whose span over 366
// days is refused under To before any request.
import type { Page, Request } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(width = 1440) {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  const asked: string[] = []
  opened.page.on('request', (request: Request) => {
    if (request.url().includes('/dev/reports/result')) asked.push(new URL(request.url()).search.slice(1))
  })
  await opened.page.goto(`${pages.ui}/playground/reports/new`)
  await opened.page.locator('e-select[name="range"] select').waitFor()
  return { ...opened, asked }
}

const day = (page: Page, name: string) => page.locator(`e-date-field[name="${name}"]`)

for (const width of [1440, 360]) {
  test(`at ${width} px From and To are hidden for Last 30 days and show for Custom`, async () => {
    const { page } = await open(width)
    expect(await page.locator('e-select[name="range"] option').allTextContents()).toEqual([
      'Today',
      'Yesterday',
      'Last 7 days',
      'Last 30 days',
      'Last 90 days',
      'Custom',
    ])
    expect(await day(page, 'from').isVisible()).toBe(false)
    expect(await day(page, 'to').isVisible()).toBe(false)
    await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
    expect(await day(page, 'from').isVisible()).toBe(true)
    expect(await day(page, 'to').isVisible()).toBe(true)
    const [from, to] = await Promise.all([day(page, 'from').boundingBox(), day(page, 'to').boundingBox()])
    expect((to?.x ?? 0) + (to?.width ?? 0)).toBeLessThanOrEqual(width)
    expect(from?.height).toBeGreaterThan(0)
  })
}

test('a custom range from 1 Nov to 13 Nov 2026 asks with range=CUSTOM&from=2026-11-01&to=2026-11-13', async () => {
  const { page, asked } = await open()
  await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
  await day(page, 'from').locator('input').fill('2026-11-01')
  await day(page, 'to').locator('input').fill('2026-11-13')
  await expect
    .poll(() => asked.at(-1))
    .toBe('metric=NET_SALES&groupBy=DAY&range=CUSTOM&from=2026-11-01&to=2026-11-13&view=TABLE')
  await expect.poll(() => page.locator('e-report-result e-row:not([head]):not([total])').count()).toBe(13)
  expect(await day(page, 'from').locator('[data-e-date]').textContent()).toBe('1 Nov 2026')
})

test('366 days counting both ends asks; 367 says "Pick at most 366 days" under To and asks nothing', async () => {
  const { page, asked } = await open()
  await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
  await day(page, 'from').locator('input').fill('2026-01-01')
  await day(page, 'to').locator('input').fill('2027-01-01')
  await expect
    .poll(() => asked.at(-1))
    .toBe('metric=NET_SALES&groupBy=DAY&range=CUSTOM&from=2026-01-01&to=2027-01-01&view=TABLE')
  const before = asked.length
  await day(page, 'to').locator('input').fill('2027-01-02')
  await expect.poll(() => day(page, 'to').getAttribute('error')).toBe('Pick at most 366 days')
  expect(await day(page, 'to').locator('[data-e-error]').textContent()).toBe('Pick at most 366 days')
  await page.waitForTimeout(300)
  expect(asked.length).toBe(before)
  // A To back within the limit asks again, and the error goes.
  await day(page, 'to').locator('input').fill('2026-12-31')
  await expect.poll(() => asked.length).toBe(before + 1)
  expect(await day(page, 'to').getAttribute('error')).toBeNull()
})

test('a custom range with no days picked yet asks nothing, and a To before From says so', async () => {
  const { page, asked } = await open()
  const before = asked.length
  await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
  await page.waitForTimeout(300)
  expect(asked.length).toBe(before)
  await day(page, 'from').locator('input').fill('2026-11-13')
  await day(page, 'to').locator('input').fill('2026-11-01')
  await expect.poll(() => day(page, 'to').getAttribute('error')).toBe('Pick a day on or after From')
  expect(asked.length).toBe(before)
})

test('Save report refuses a custom range over 366 days and posts nothing; Last 30 days then saves', async () => {
  const { page } = await open()
  const posts: string[] = []
  page.on('request', (request: Request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })
  await page.locator('e-text-field[name="name"] input').fill('Long')
  await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
  await day(page, 'from').locator('input').fill('2026-01-01')
  await day(page, 'to').locator('input').fill('2027-03-01')
  const bar = page.locator('e-admin-frame > .e-save-bar')
  await bar.getByRole('button', { name: 'Save report' }).click()
  await expect
    .poll(() => bar.locator('.e-save-bar-message > span:visible').textContent())
    .toBe('Not saved: 1 field needs a fix')
  expect(await day(page, 'to').locator('[data-e-error]').textContent()).toBe('Pick at most 366 days')
  expect(posts).toEqual([])
  await page.locator('e-select[name="range"] select').selectOption('LAST_30_DAYS')
  await bar.getByRole('button', { name: 'Save report' }).click()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Report saved')
})

test('once the refused range is put right, by a nearer To or by a preset, the bar reads "Not saved yet" again', async () => {
  const { page } = await open()
  const bar = page.locator('e-admin-frame > .e-save-bar')
  const said = () => bar.locator('.e-save-bar-message > span:visible').textContent()
  await page.locator('e-text-field[name="name"] input').fill('Long')
  await page.locator('e-select[name="range"] select').selectOption('CUSTOM')
  await day(page, 'from').locator('input').fill('2026-01-01')
  await day(page, 'to').locator('input').fill('2027-03-01')
  await bar.getByRole('button', { name: 'Save report' }).click()
  await expect.poll(said).toBe('Not saved: 1 field needs a fix')
  await day(page, 'from').locator('input').fill('2026-12-01')
  await expect.poll(said).toBe('Not saved yet')
  // To before From is refused the same way, and a preset puts it right.
  await day(page, 'from').locator('input').fill('2027-04-01')
  await bar.getByRole('button', { name: 'Save report' }).click()
  await expect.poll(said).toBe('Not saved: 1 field needs a fix')
  await page.locator('e-select[name="range"] select').selectOption('LAST_7_DAYS')
  await expect.poll(said).toBe('Not saved yet')
})
