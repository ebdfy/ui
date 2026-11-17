// Search opens from a button in the top band, which a phone keeps, and from Ctrl+K or ⌘K anywhere,
// inside an app's frame too. Its results are rows grouped under Orders, Products and Customers, and
// Esc puts focus back where it was.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, { lang = 'en', width = 1440 } = {}) {
  const opened = await pages.open('', width, { viewport: { width, height: 800 } })
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  return opened
}

const dialog = (page: Page) => page.locator('dialog.e-search')
const field = (page: Page) => dialog(page).locator('input[type="search"]')
const focusedIsField = (page: Page) =>
  page.evaluate(() => document.activeElement === document.querySelector('dialog.e-search input[type="search"]'))

test('pressing Ctrl+K on the orders page opens the search modal with focus in its field', async () => {
  const { page, errors } = await open('/playground/orders')
  await page.locator('e-admin-panel > iframe').waitFor()
  await page.keyboard.press('Control+k')
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  expect(await focusedIsField(page)).toBe(true)
  expect(errors).toEqual([])
})

test('typing 1042 lists Order #1042 under Orders, and Esc puts focus back', async () => {
  const { page } = await open('/playground/settings/store')
  const button = page.locator('[slot="actions"] > .e-search-button')
  await button.focus()
  await page.keyboard.press('Control+k')
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await field(page).fill('1042')
  const group = dialog(page).locator('.e-search-group', { hasText: 'Orders' })
  await expect.poll(() => group.count()).toBe(1)
  const row = dialog(page).getByRole('link', { name: /Order #1042/ })
  expect(await row.isVisible()).toBe(true)
  // The row sits under the Orders heading.
  expect(
    await group.evaluate((heading, link) => heading.compareDocumentPosition(link!) & 4, await row.elementHandle()),
  ).toBe(4)
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  expect(await button.evaluate((element) => element === document.activeElement)).toBe(true)
})

test('rows group under Products and Customers too', async () => {
  const { page } = await open('/playground/orders/drafts')
  await page.locator('[slot="actions"] > .e-search-button').click()
  await field(page).fill('ra')
  await expect
    .poll(() => dialog(page).locator('.e-search-group').allTextContents())
    .toEqual(['Orders', 'Products', 'Customers'])
})

test('with focus in a sample app field, Ctrl+K opens the same modal', async () => {
  const { page } = await open('/playground/orders')
  const app = page.frameLocator('e-admin-panel > iframe')
  const input = app.locator('input').first()
  await input.waitFor()
  await input.focus()
  await page.keyboard.press('Control+k')
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  expect(await focusedIsField(page)).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  // Focus is back in the app's field.
  expect(await input.evaluate((element) => element === document.activeElement)).toBe(true)
})

test('at 360 the search button is visible in the top band', async () => {
  const { page } = await open('/playground', { width: 360 })
  const button = page.locator('[slot="actions"] > .e-search-button')
  expect(await button.isVisible()).toBe(true)
  const box = await button.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(56)
  expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([44, 44])
})

test('on a touch phone a tap on the dimmed page around the modal closes it', async () => {
  const opened = await pages.open('', 360, { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true })
  const { page } = opened
  await page.goto(`${pages.ui}/playground/settings/store`)
  await page.locator('[slot="actions"] > .e-search-button').tap()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  // A tap on the modal itself keeps it open.
  await field(page).tap()
  expect(await dialog(page).isVisible()).toBe(true)
  await page.touchscreen.tap(180, 740)
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
})

test('a press in the field that ends on the dimmed page leaves the modal open', async () => {
  const { page } = await open('/playground/settings/store')
  await page.locator('[slot="actions"] > .e-search-button').click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  const box = (await field(page).boundingBox())!
  await page.mouse.move(box.x + 20, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(720, 760)
  await page.mouse.up()
  expect(await dialog(page).isVisible()).toBe(true)
  // A click that starts and ends on the dimmed page still closes it.
  await page.mouse.click(720, 760)
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
})

test('in Bangla the modal groups its rows in Bangla', async () => {
  const { page } = await open('/playground/settings/store', { lang: 'bn' })
  await page.locator('[slot="actions"] > .e-search-button').click()
  await field(page).fill('1042')
  await expect.poll(() => dialog(page).locator('.e-search-group').allTextContents()).toEqual(['অর্ডার'])
  expect(await field(page).getAttribute('placeholder')).toBe('অর্ডার, পণ্য, গ্রাহক খুঁজুন')
})

test.for([
  { lang: 'en', staff: 'Staff', group: 'Settings', asked: 'staff' },
  { lang: 'bn', staff: 'স্টাফ', group: 'সেটিংস', asked: 'স্টাফ' },
])(
  'in $lang, "$asked" finds Staff under Settings, and picking it closes the search and swaps in Staff',
  async (names) => {
    const { page, errors } = await open('/playground/settings/store', { lang: names.lang })
    await page.locator('e-phone-field input').waitFor()
    await page.evaluate(() => Object.assign(globalThis, { stayed: true }))
    await page.keyboard.press('Control+k')
    await field(page).fill(names.asked)
    await expect.poll(() => dialog(page).locator('.e-search-group', { hasText: names.group }).count()).toBe(1)
    await dialog(page).getByRole('link', { name: names.staff, exact: true }).click()
    await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe(names.staff)
    expect(await dialog(page).isVisible()).toBe(false)
    expect(new URL(page.url()).pathname).toBe('/playground/settings/staff')
    // The panel swapped under the frame: the page that loaded first is still here.
    expect(await page.evaluate(() => (globalThis as { stayed?: boolean }).stayed)).toBe(true)
    expect(errors).toEqual([])
  },
)
