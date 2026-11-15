// v2's docs search and language switch: ⌘K on an Apple device and Ctrl K elsewhere opens a search over
// the pages' titles, a title that starts with the words comes first, and Enter opens it. বাংলা puts
// the docs in Bangla, kept for the next page. Without JavaScript neither shows.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
const mac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'

const shown = (page: Awaited<ReturnType<typeof pages.open>>['page']) =>
  page.locator('#finder [role="option"]:not([hidden])').allTextContents()

test('on Linux Ctrl K opens the search, "table" puts Table first, and Enter opens it', async () => {
  const { page, errors } = await pages.open('', 1280, { userAgent: linux })
  await page.goto(`${pages.ui}/components/button`)
  await page.waitForFunction(() => document.querySelector('.bar .search:not([hidden])'))
  await page.keyboard.press('Control+k')
  const box = page.getByRole('combobox', { name: 'Search pages' })
  await expect.poll(() => box.evaluate((input) => input === document.activeElement)).toBe(true)
  // Choice list comes before List in the page order; the title that starts with the words wins.
  await box.fill('list')
  expect(await shown(page)).toEqual(['List', 'Choice list'])
  await box.fill('table')
  expect(await shown(page)).toEqual(['Table', 'Index table'])
  expect(await page.locator('#finder [aria-selected="true"]').textContent()).toBe('Table')
  await box.press('Enter')
  await page.waitForURL('**/components/table')
  // Vite's dev client aborts a cross-document view transition, which the built site runs (test/speed).
  expect(errors.filter((error) => !error.includes('ViewTransition opt-in disabled'))).toEqual([])
})

test('⌘K opens it on a Mac, and Ctrl K does not', async () => {
  const { page } = await pages.open('', 1280, { userAgent: mac })
  await page.goto(`${pages.ui}/components/button`)
  await page.waitForFunction(() => document.querySelector('.bar .search:not([hidden])'))
  await page.keyboard.press('Control+k')
  expect(await page.locator('#finder').evaluate((dialog: HTMLDialogElement) => dialog.open)).toBe(false)
  await page.keyboard.press('Meta+k')
  expect(await page.locator('#finder').evaluate((dialog: HTMLDialogElement) => dialog.open)).toBe(true)
})

test('the Search button opens it on a phone; Escape closes it and the button has the focus again', async () => {
  const { page } = await pages.open(`${pages.ui}/components/card`, 360)
  const search = page.getByRole('button', { name: 'Search' })
  await search.click()
  const box = page.getByRole('combobox', { name: 'Search pages' })
  await box.fill('zzz')
  expect(await shown(page)).toEqual([])
  expect(await page.locator('#finder .none').isVisible()).toBe(true)
  await box.press('Escape')
  await expect.poll(() => search.evaluate((button) => button === document.activeElement)).toBe(true)
})

test('with JavaScript off neither the search nor the language switch shows', async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/card`)
  expect(await page.locator('.bar .search').isVisible()).toBe(false)
  expect(await page.locator('.bar e-button-group').isVisible()).toBe(false)
})

test('বাংলা puts the docs in Bangla, and the next page opens in Bangla before its first paint', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 360)
  await page.getByRole('button', { name: 'বাংলা' }).click()
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('bn')
  // The language the page had as its body began, before any module ran.
  await page.addInitScript(() =>
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') sessionStorage.setItem('first', document.documentElement.lang)
    }),
  )
  await page.goto(`${pages.ui}/components/card`)
  expect(await page.evaluate(() => sessionStorage.getItem('first'))).toBe('bn')
  expect(await page.getByRole('button', { name: 'বাংলা' }).getAttribute('aria-pressed')).toBe('true')
  await page.getByRole('button', { name: 'English' }).click()
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en')
})

test('on Card, বাংলা turns an example into Bangla words and ৳১,২৫,০০০, and English gives ৳1,25,000', async () => {
  const { page } = await pages.open(`${pages.ui}/components/card`, 1440)
  // The examples that follow the page's language; the one written in Bangla already shows it.
  const shown = () => page.locator('figure.example:not([lang]) .demo').allTextContents()
  expect((await shown()).join(' ')).toContain('৳1,25,000')
  await page.getByRole('button', { name: 'বাংলা' }).click()
  const bangla = (await shown()).join(' ')
  expect(bangla).toContain('৳১,২৫,০০০')
  expect(bangla).not.toContain('৳1,25,000')
  expect(bangla).toMatch(/[অ-হ]/)
  await page.getByRole('button', { name: 'English' }).click()
  const english = (await shown()).join(' ')
  expect(english).toContain('৳1,25,000')
  expect(english).not.toMatch(/[অ-হ]/)
})

// The pressed language button is the marked one in both schemes: it differs from the bar it sits on,
// and the one not pressed has the bar's own background.
test.for(['light', 'dark'] as const)('in %s the pressed language button stands out from the bar', async (scheme) => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1440, { colorScheme: scheme })
  await page.waitForFunction(() => document.querySelector('.bar .tools:not([hidden])'))
  const read = () =>
    page.evaluate(() => {
      const back = (selector: string) => getComputedStyle(document.querySelector(selector)!).backgroundColor
      return {
        bar: back('.bar'),
        pressed: back('.bar e-button[pressed]'),
        unpressed: back('.bar e-button[value]:not([pressed])'),
      }
    })
  for (const choice of ['English', 'বাংলা']) {
    await page.getByRole('button', { name: choice }).click()
    // Move off the buttons so a hover does not colour the unpressed one.
    await page.mouse.move(700, 400)
    // A button eases to its new colour, so the check waits out the transition.
    const { bar } = await read()
    await expect.poll(async () => (await read()).unpressed).toBe(bar)
    expect((await read()).pressed).not.toBe(bar)
  }
})
