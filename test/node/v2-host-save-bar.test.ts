// The Admin's save bar in the frame's top band: an edit to the Store form raises it, putting the value
// back or Discard lowers it, and it comes and goes without moving anything.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, lang: 'en' | 'bn' = 'en', width = 1440, height = 900) {
  const opened = await pages.open('', width, { viewport: { width, height } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-phone-field input').waitFor()
  return opened
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const phone = (page: Page) => page.locator('e-phone-field input')
const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!

test('an edit to Phone raises "Unsaved changes" in a 620 px pill in the top band', async () => {
  const { page, errors } = await open('/playground/settings/store')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  await phone(page).fill('01819556681')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await bar(page).locator('.e-save-bar-message > span:visible').textContent()).toBe('Unsaved changes')
  // In the navy band, 8 px from the top, once it has dropped in.
  await expect.poll(async () => (await bar(page).boundingBox())?.y).toBe(8)
  expect(await bar(page).boundingBox()).toMatchObject({ width: 620, height: 40 })
  expect(await bar(page).getByRole('button').allTextContents()).toEqual(['Discard', 'Save'])
  expect(errors).toEqual([])
})

test('in Bangla the bar reads its own words', async () => {
  const { page } = await open('/playground/settings/store', 'bn')
  await phone(page).fill('01819556681')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await bar(page).locator('.e-save-bar-message > span:visible').textContent()).toBe('অসংরক্ষিত পরিবর্তন')
  expect(await bar(page).getByRole('button').allTextContents()).toEqual(['পরিবর্তন বাদ দিন', 'সংরক্ষণ করুন'])
  // The longest message and both words fit in the pill uncut.
  expect(
    await bar(page).evaluate((element) =>
      [...element.querySelectorAll('p, button')].every((part) => part.scrollWidth <= part.clientWidth),
    ),
  ).toBe(true)
})

test('at 360 px the bar fills the 56 px band with a 44 px × named Discard and a Save with its word', async () => {
  const { page } = await open('/playground/settings/store', 'en', 360, 800)
  const store = await box(page, 'e-admin-frame > [slot="store"]')
  const actions = await box(page, 'e-admin-frame > [slot="actions"]')
  await phone(page).fill('01819556681')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await expect.poll(() => bar(page).boundingBox()).toEqual({ x: 0, y: 0, width: 360, height: 56 })
  const discard = bar(page).getByRole('button', { name: 'Discard', exact: true })
  expect(await discard.boundingBox()).toMatchObject({ width: 44, height: 44 })
  expect(await bar(page).getByRole('button', { name: 'Save', exact: true }).textContent()).toBe('Save')
  // The store and the icons give way unseen, where they were.
  expect(await page.locator('e-admin-frame > [slot="store"]').isVisible()).toBe(false)
  expect(await page.locator('e-admin-frame > [slot="actions"] > .e-search-button').isVisible()).toBe(false)
  expect(await box(page, 'e-admin-frame > [slot="store"]')).toEqual(store)
  expect(await box(page, 'e-admin-frame > [slot="actions"]')).toEqual(actions)
})

test('typing the saved value back lowers the bar', async () => {
  const { page } = await open('/playground/settings/store')
  await phone(page).fill('01819556681')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await phone(page).fill('01819556680')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test("the bar's Discard puts Phone back to its saved value and lowers the bar", async () => {
  const { page } = await open('/playground/settings/store')
  await phone(page).fill('01819556681')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(await phone(page).inputValue()).toBe('01819556680')
})

test('a dirty form that leaves the panel lowers the bar', async () => {
  const { page } = await open('/playground/settings/store')
  await phone(page).fill('01819556681')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await page.evaluate(() => document.querySelector('form[data-save-bar]')!.remove())
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

for (const width of [1440, 360]) {
  test(`at ${width} px the bar comes and goes with a CLS of at most 0.02`, async () => {
    const { page } = await open('/playground/settings/store', 'en', width, 800)
    await page.evaluate(() => {
      const shifts = { total: 0 }
      Object.assign(globalThis, { shifts })
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number })[]) shifts.total += entry.value
      }).observe({ type: 'layout-shift' })
    })
    await phone(page).fill('01819556681')
    await expect.poll(() => bar(page).isVisible()).toBe(true)
    await bar(page).getByRole('button', { name: 'Discard' }).click()
    await expect.poll(() => bar(page).isVisible()).toBe(false)
    await phone(page).fill('01819556682')
    await expect.poll(() => bar(page).isVisible()).toBe(true)
    // A frame for the observer to report the last shift.
    await page.evaluate(() => new Promise(requestAnimationFrame))
    const total = await page.evaluate(() => (globalThis as unknown as { shifts: { total: number } }).shifts.total)
    expect(total).toBeLessThanOrEqual(0.02)
  })
}

test('every page with the frame lets the keyboard shrink it, so the top band stays on screen', async () => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const site = new URL('../../site/ui/', import.meta.url)
  const files = readdirSync(site, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'))
  const framed = files.filter((file) => readFileSync(new URL(file, site), 'utf8').includes('<e-admin-frame'))
  expect(framed.length).toBeGreaterThan(10)
  for (const file of framed) {
    const meta = /<meta name="viewport" content="([^"]*)"/.exec(readFileSync(new URL(file, site), 'utf8'))?.[1]
    expect(meta, file).toContain('interactive-widget=resizes-content')
  }
})

test('in a 360 by 480 window the bar stays whole on screen while Phone has focus', async () => {
  const { page } = await open('/playground/settings/store', 'en', 360, 480)
  await phone(page).fill('01819556681')
  await phone(page).focus()
  await expect.poll(() => bar(page).boundingBox()).toEqual({ x: 0, y: 0, width: 360, height: 56 })
  expect(
    await bar(page).evaluate(
      (element) => document.elementFromPoint(180, 28) !== null && element.contains(document.elementFromPoint(300, 28)),
    ),
  ).toBe(true)
})
