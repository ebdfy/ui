import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// A merchant picks Bangla on the orders page, opens an order and the drafts, then reloads.
test('in the playground the chosen language stays on the next page and after a reload', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  const title = page.locator('eb-admin-chrome [part="title"]')
  const entry = (name: string) => page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: name })
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Orders')
  await app.getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => app.locator('html').getAttribute('lang')).toBe('bn')

  await entry('Order #1039').click()
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('অর্ডার #1039')
  expect(await app.locator('html').getAttribute('lang')).toBe('bn')
  expect(await app.getByRole('button', { name: 'বাংলা' }).getAttribute('aria-pressed')).toBe('true')

  await entry('Drafts').click()
  await expect
    .poll(() => app.locator('eb-empty-state:defined').getAttribute('heading'), { timeout: 15_000 })
    .toBe('এখনো কোনো খসড়া নেই')

  await page.reload()
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('অর্ডার')
  expect(await app.locator('html').getAttribute('lang')).toBe('bn')
  expect(await app.getByRole('button', { name: 'বাংলা' }).getAttribute('aria-pressed')).toBe('true')

  // English again holds the same way.
  await app.getByRole('button', { name: 'English' }).click()
  await entry('Order #1039').click()
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Order #1039')
  expect(errors).toEqual([])
})

test.for([
  ['en', 'No drafts yet', 'Add order'],
  ['bn', 'এখনো কোনো খসড়া নেই', 'অর্ডার যোগ করুন'],
] as const)('in %s Drafts says it has none, with Add order as its primary action', async ([lang, heading, action]) => {
  const { page, errors } = await pages.open('', 360)
  await page.addInitScript((chosen) => localStorage.setItem('ebdfy-sample-lang', chosen), lang)
  await page.goto(`${pages.sampleApp}/drafts`)
  const empty = page.locator('eb-empty-state:defined')
  await expect.poll(() => empty.getAttribute('heading'), { timeout: 15_000 }).toBe(heading)
  expect(await empty.isVisible()).toBe(true)
  expect(await page.locator('html').getAttribute('lang')).toBe(lang)
  const button = empty.locator('eb-button[slot="action"]')
  expect(await button.innerText()).toBe(action)
  expect(await button.getAttribute('variant')).toBe('primary')
  expect(errors).toEqual([])
})

// Order #1001 drops the card's repeat of its title, and draws its words, its title bar and its
// Book courier sheet in the chosen language.
test.for([
  ['en', 'Order #1001', ['Book courier', 'More'], 'Phone', 'Book'],
  ['bn', 'অর্ডার #1001', ['কুরিয়ার বুক করুন', 'আরও'], 'ফোন', 'বুক করুন'],
] as const)(
  'in %s order #1001 has its words, its title actions and its sheet in that language',
  async ([lang, title, actions, phone, book]) => {
    const { page, errors } = await pages.open('', 360)
    await page.addInitScript((chosen) => localStorage.setItem('ebdfy-sample-lang', chosen), lang)
    await page.goto(`${pages.ui}/playground?page=/order`)
    const app = page.frameLocator('eb-admin-chrome iframe')
    await expect
      .poll(() => page.locator('eb-admin-chrome [part="title"]').textContent(), { timeout: 15_000 })
      .toBe(title)
    const buttons = page.locator('eb-admin-chrome [part="title-action"]')
    await expect.poll(() => buttons.allInnerTexts()).toEqual(actions)
    expect(await app.locator('eb-card[heading]').count()).toBe(0)
    expect(await app.locator('eb-menu').count()).toBe(0)
    await expect.poll(() => app.locator('eb-phone-field:defined').getAttribute('label')).toBe(phone)
    await buttons.first().click()
    const sheet = page.frameLocator('eb-admin-chrome dialog[part="modal"] iframe')
    await expect.poll(() => sheet.locator('#book').innerText(), { timeout: 15_000 }).toBe(book)
    expect(errors).toEqual([])
  },
)

// The save bar keeps the values the page opened with in its own language, so an edit undone lowers
// the bar and Discard brings back the Bangla, not the English the page's markup holds.
test('in Bangla order #1001 opens clean, lowers the bar when an edit is undone, and discards back to Bangla', async () => {
  const { page, errors } = await pages.open('', 1280)
  await page.addInitScript(() => localStorage.setItem('ebdfy-sample-lang', 'bn'))
  await page.goto(`${pages.ui}/playground?page=/order`)
  const app = page.frameLocator('eb-admin-chrome iframe')
  const bar = page.locator('eb-admin-chrome [part="save-bar"]')
  const name = app.locator('eb-text-field[name="name"] input')
  const note = app.locator('eb-text-area[name="note"] textarea')
  await expect.poll(() => name.inputValue(), { timeout: 15_000 }).toBe('রহিম উদ্দিন')
  expect(await bar.count()).toBe(0)

  const phone = app.locator('eb-phone-field[name="phone"] input')
  await phone.fill('0170707159')
  await bar.waitFor()
  await phone.fill('01707071591')
  await bar.waitFor({ state: 'detached' })

  await note.fill('গেটে রেখে যাবেন।')
  await bar.waitFor()
  await page.locator('eb-admin-chrome [part="discard"]').click()
  await bar.waitFor({ state: 'detached' })
  expect(await name.inputValue()).toBe('রহিম উদ্দিন')
  expect(await note.inputValue()).toBe('ডেলিভারির আগে ফোন করুন।')
  expect(errors).toEqual([])
})
