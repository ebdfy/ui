// The v2 sample app's Home page: a setup guide with five steps, two done, that stays gone once the
// person dismisses it.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')

async function home(lang: 'en' | 'bn' = 'en') {
  const opened = await pages.open('', 1440)
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground/home`)
  return opened
}

const app = (page: Page) => page.frameLocator('e-admin-panel iframe')

test('/playground/home opens Home with a guide that reads 2 of 5 and two steps ticked', async () => {
  const { page, errors } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const guide = app(page).locator('e-setup-guide')
  await expect.poll(() => guide.locator('[data-count]').textContent()).toBe('2 of 5')
  expect(await guide.getByRole('checkbox', { checked: true }).count()).toBe(2)
  expect(await guide.getByRole('checkbox').count()).toBe(5)
  expect(errors).toEqual([])
})

test('after Dismiss and a reload the guide is not on the page', async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  await app(page).getByRole('button', { name: 'Dismiss' }).click()
  expect(await app(page).locator('e-setup-guide').count()).toBe(0)
  await page.reload()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  expect(await app(page).locator('e-setup-guide').count()).toBe(0)
})

test('in Bangla the guide reads ৫টির মধ্যে ২টি', async () => {
  const { page } = await home('bn')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('হোম')
  await expect.poll(() => app(page).locator('e-setup-guide [data-count]').textContent()).toBe('৫টির মধ্যে ২টি')
})

test("another part's dismiss event, a banner's say, does not put the guide away", async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const frame = page.frames().find((one) => one.url().startsWith(`${pages.sampleApp}/home`))!
  await frame.evaluate(() => document.body.dispatchEvent(new CustomEvent('dismiss', { bubbles: true })))
  expect(await frame.evaluate(() => localStorage.getItem('ebdfy-sample-setup-dismissed'))).toBeNull()
  await page.reload()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  expect(await app(page).locator('e-setup-guide').count()).toBe(1)
})

test('home shows five to-do tiles that link to the orders, each count at 26 px', async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const tiles = app(page).locator('e-todo > a')
  await expect.poll(() => tiles.count()).toBe(5)
  expect(await tiles.locator('strong').allTextContents()).toEqual(['12', '18', '54', '6', '3'])
  for (const tile of await tiles.all()) {
    expect(await tile.getAttribute('href')).toBe('/orders')
    expect(await tile.locator('strong').evaluate((one) => getComputedStyle(one).fontSize)).toBe('26px')
  }
})

test("the Today card's metrics draw no border on their children", async () => {
  const { page } = await home()
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('Home')
  const stats = app(page).locator('e-card e-metrics > *')
  await expect.poll(() => stats.count()).toBe(3)
  for (const stat of await stats.all()) {
    expect(await stat.evaluate((one) => getComputedStyle(one).borderTopWidth)).toBe('0px')
  }
})

test('in Bangla the counts are Bangla digits and the success change reads +১২%', async () => {
  const { page } = await home('bn')
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).toBe('হোম')
  const frame = app(page)
  await expect.poll(() => frame.locator('e-todo > a strong').allTextContents()).toEqual(['১২', '১৮', '৫৪', '৬', '৩'])
  expect(await frame.locator('e-metrics [slot="change"][tone="success"]').textContent()).toBe('+১২%')
  expect(await frame.locator('e-metrics strong').allTextContents()).toEqual(['৩৮', '৳৪১,৫০০', '২.১%'])
})

test.for(['', '?lang=bn'])('loading v2.js moves no e-* box on Home (%j)', async (query) => {
  const { page } = await pages.open('', 1280)
  await page.route('**/ui/v2.js', (route) => route.abort())
  await page.goto(`${pages.sampleApp}/home${query}`)
  await page.evaluate(() => document.fonts.ready)
  // The script adds tags, so the second reading measures the tags the first found.
  const tagBoxes = () => {
    const w = window as unknown as { tags?: Element[] }
    w.tags ??= [...document.querySelectorAll('*')].filter((tag) => tag.localName.startsWith('e-'))
    return w.tags.map((tag) => {
      const { x, y, width, height } = tag.getBoundingClientRect()
      return { x, y, width, height, name: tag.localName, text: (tag.textContent ?? '').trim().slice(0, 20) }
    })
  }
  const before = await page.evaluate(tagBoxes)
  expect(before.filter((one) => one.name === 'e-todo' && one.height > 0)).toHaveLength(1)
  await page.unroute('**/ui/v2.js')
  await page.evaluate(() => {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = '/ui/v2.js'
    document.head.append(script)
  })
  await page.waitForFunction(() => document.querySelectorAll('e-setup-step > label').length > 0)
  await page.evaluate(() => document.fonts.ready)
  const after = await page.evaluate(tagBoxes)
  const moved = before.flatMap((one, index) =>
    (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(one[key] - after[index]![key]) > 1)
      .map((key) => `${one.name} ${one.text} ${key} ${one[key]} -> ${after[index]![key]}`),
  )
  expect(moved).toEqual([])
})
