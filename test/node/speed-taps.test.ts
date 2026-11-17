// Every element the speed checks tap or wait for is on its page, so a page that drops one fails here,
// in the fast suite, and not first in the speed checks before a release.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { taps } from '../speed/taps.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('in the playground the sample orders list links to order #1042, which has its items card and back link', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`)
  await expect.poll(() => page.frames().some((frame) => frame.url().startsWith(`${pages.sampleApp}/`))).toBe(true)
  const app = page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
  await expect.poll(() => taps.orderLink(app).count()).toBe(1)
  await taps.orderLink(app).click()
  await expect.poll(() => taps.itemsCard(app).count()).toBe(1)
  expect(await taps.orderBack(app).count()).toBe(1)
})

test.for([
  { lang: 'en', store: 'Store', staff: 'Staff' },
  { lang: 'bn', store: 'স্টোর', staff: 'স্টাফ' },
])(
  'the Settings > Store page in $lang has its heading, More with Staff on a phone and Staff in the menu',
  async (names) => {
    for (const width of [360, 1440]) {
      const { page } = await pages.open('', width)
      await page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), names.lang)
      await page.goto(`${pages.ui}/playground/settings/store`)
      await expect.poll(() => taps.heading(page).textContent()).toBe(names.store)
      if (width < 1040) {
        await taps.more(page).click()
        await expect.poll(() => taps.inMore(page, names.staff).isVisible()).toBe(true)
      } else {
        await expect.poll(() => taps.inMenu(page, names.staff).isVisible()).toBe(true)
      }
    }
  },
)

test("the Button page's sidebar links to Card", async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1440)
  expect(await taps.cardLink(page).count()).toBe(1)
})
