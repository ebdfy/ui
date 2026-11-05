// The sample app's v2 orders list inside the v2 playground: the app names its page through the
// bridge, its Save shows the Admin's toast, and at 360 px nothing scrolls sideways, in both languages.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const words = {
  en: { title: 'Orders', save: 'Save', saved: 'Saved' },
  bn: { title: 'অর্ডার', save: 'সংরক্ষণ করুন', saved: 'সংরক্ষিত' },
}

async function open(lang: 'en' | 'bn', width: number) {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground`)
  return opened
}

test.for(['en', 'bn'] as const)(
  'in %s the title bar reads the app title and Save shows the toast for 5 s',
  async (lang) => {
    const { page, errors } = await open(lang, 1440)
    await expect
      .poll(() => page.locator('e-admin-panel header h1').textContent(), { timeout: 15_000 })
      .toBe(words[lang].title)
    await page.frameLocator('e-admin-panel iframe').getByRole('button', { name: words[lang].save }).click()
    const toast = page.locator('e-admin-panel').getByRole('status')
    await expect.poll(() => toast.textContent()).toBe(words[lang].saved)
    const shown = Date.now()
    await expect.poll(() => toast.count(), { timeout: 8000 }).toBe(0)
    expect(Date.now() - shown).toBeGreaterThan(4000)
    expect(errors).toEqual([])
  },
)

test.for(['en', 'bn'] as const)('in %s at 360 px neither the Admin nor the app scrolls sideways', async (lang) => {
  const { page } = await open(lang, 360)
  await expect
    .poll(() => page.locator('e-admin-panel header h1').textContent(), { timeout: 15_000 })
    .toBe(words[lang].title)
  const app = page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
  await app.waitForFunction(() => document.querySelector('e-button > button') !== null)
  // Nothing shown sticks out past the frame's width or scrolls inside it, the table included.
  const wide = (frame: typeof app) =>
    frame.evaluate(() => {
      const width = document.documentElement.clientWidth
      const shown = [...document.querySelectorAll('body *')].filter((element) => element.checkVisibility())
      // The view tabs may scroll inside e-tabs, which clips them; e-tabs itself stays inside.
      const clipped = (element: Element) => element.parentElement?.closest('e-tabs') !== null
      const past = shown
        .filter((element) => !clipped(element) && element.getBoundingClientRect().right > width + 0.5)
        .map((element) => element.localName)
      const scrolling = shown
        .filter(
          (element) =>
            element.localName !== 'e-tabs' && element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0,
        )
        .map((element) => element.localName)
      return { scroll: document.documentElement.scrollWidth - width, past, scrolling }
    })
  expect(await wide(page.mainFrame())).toEqual({ scroll: 0, past: [], scrolling: [] })
  expect(await wide(app)).toEqual({ scroll: 0, past: [], scrolling: [] })
})
