// The report builder's filters: Add filter picks a dimension and ticks its values, Done adds one chip
// whose values post as repeated fields, a chip opens its values again and its x removes it.
import type { Page, Request } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(width = 1440, lang = 'en') {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((language) => localStorage.setItem('ebdfy-playground-lang', language), lang)
  const asked: string[] = []
  const posts: string[] = []
  opened.page.on('request', (request: Request) => {
    if (request.url().includes('/dev/reports/result')) asked.push(new URL(request.url()).search.slice(1))
    if (request.method() === 'POST') posts.push(request.url())
  })
  await opened.page.goto(`${pages.ui}/playground/reports/new`)
  await opened.page.locator('e-select[name="groupBy"] select').waitFor()
  return { ...opened, asked, posts }
}

const picker = (page: Page) => page.locator('e-modal[data-part="picker"] > dialog')

// The chip as it reads on screen: v2.css draws its label and the words of its ticked values.
const chips = (page: Page) =>
  page.locator('e-report-filter').evaluateAll((filters) => {
    const drawn = (element: Element, pseudo: string) => {
      const content = getComputedStyle(element, pseudo).content
      return content.startsWith('"') ? (JSON.parse(content) as string) : ''
    }
    return filters
      .filter((filter) => getComputedStyle(filter).display !== 'none')
      .map((filter) =>
        [...filter.children]
          .filter((child) => child.localName === 'span' && getComputedStyle(child).display !== 'none')
          .reduce(
            (text, child, at) => `${text}${at ? ' ' : ''}${child.textContent?.trim()}${drawn(child, '::after')}`,
            drawn(filter, '::before'),
          ),
      )
  })

async function addFilter(page: Page, dimension: string, values: string[]) {
  await page.locator('[data-part="add-filter"]').click()
  await picker(page).getByRole('button', { name: dimension, exact: true }).click()
  for (const value of values) await picker(page).getByRole('checkbox', { name: value, exact: true }).check()
  await picker(page).locator('footer').getByRole('button').click()
}

test('picking Add filter, Channel, Facebook and Messenger, Done: one chip reads "Channel is Facebook, Messenger"', async () => {
  const { page, asked, posts, errors } = await open()
  await addFilter(page, 'Channel', ['Facebook', 'Messenger'])
  expect(await chips(page)).toEqual(['Channel is Facebook, Messenger'])
  expect(await picker(page).isVisible()).toBe(false)
  await expect
    .poll(() => asked.at(-1))
    .toBe('metric=NET_SALES&groupBy=DAY&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS&view=TABLE')
  const edit = page.locator('e-report-filter[name="channel"] > [data-part="edit"]')
  expect(await edit.getAttribute('aria-label')).toBe('Channel is Facebook, Messenger. Change the Channel filter')
  // Pressing Add filter, a dimension, the ticks and Done saved nothing.
  expect(posts).toEqual([])
  expect(errors).toEqual([])
})

test('in Bangla the chip reads "চ্যানেল: ফেসবুক, মেসেঞ্জার" and its values post in English', async () => {
  const { page, asked } = await open(1440, 'bn')
  await addFilter(page, 'চ্যানেল', ['ফেসবুক', 'মেসেঞ্জার'])
  expect(await chips(page)).toEqual(['চ্যানেল: ফেসবুক, মেসেঞ্জার'])
  await expect.poll(() => asked.at(-1)).toContain('&channel=FACEBOOK&channel=MESSENGER&')
  const body = await page.evaluate(() => [...new FormData(document.querySelector('form')!).getAll('channel')])
  expect(body).toEqual(['FACEBOOK', 'MESSENGER'])
})

test('removing the chip drops both channel fields from the next result request, and saves nothing', async () => {
  const { page, asked, posts } = await open()
  await addFilter(page, 'Channel', ['Facebook', 'Messenger'])
  await expect.poll(() => asked.at(-1)).toContain('channel=FACEBOOK')
  await page.locator('e-report-filter[name="channel"] > [data-part="remove"]').click()
  await expect.poll(() => asked.at(-1)).toBe('metric=NET_SALES&groupBy=DAY&range=LAST_30_DAYS&view=TABLE')
  expect(await chips(page)).toEqual([])
  expect(
    await page.locator('[data-part="add-filter"] button').evaluate((button) => button === document.activeElement),
  ).toBe(true)
  expect(posts).toEqual([])
})

test('after a Channel chip Add filter offers District, Payment method and Courier, and a chip opens its values again', async () => {
  const { page, posts } = await open()
  await addFilter(page, 'Channel', ['Facebook', 'Messenger'])
  await page.locator('[data-part="add-filter"]').click()
  expect(await picker(page).locator('[data-part="list"] > button').allTextContents()).toEqual([
    'District',
    'Payment method',
    'Courier',
  ])
  await picker(page).getByRole('button', { name: 'Close' }).click()
  await page.locator('e-report-filter[name="channel"] > [data-part="edit"]').click()
  expect(await picker(page).locator('h2').textContent()).toBe('Channel')
  expect(await picker(page).getByRole('checkbox', { name: 'Facebook', exact: true }).isChecked()).toBe(true)
  // Enter in the list is the list's, not the form's Save.
  await picker(page).getByRole('checkbox', { name: 'WhatsApp' }).check()
  await page.keyboard.press('Enter')
  await picker(page).locator('footer').getByRole('button').click()
  expect(await chips(page)).toEqual(['Channel is Facebook, Messenger, WhatsApp'])
  expect(posts).toEqual([])
})

test('every dimension used, Add filter goes', async () => {
  const { page } = await open()
  await addFilter(page, 'Channel', ['Facebook'])
  await addFilter(page, 'District', ['Dhaka'])
  await addFilter(page, 'Payment method', ['bKash'])
  expect(await page.locator('[data-part="add-filter"]').isVisible()).toBe(true)
  await addFilter(page, 'Courier', ['Pathao'])
  expect(await page.locator('[data-part="add-filter"]').isVisible()).toBe(false)
})

for (const lang of ['en', 'bn']) {
  test(`at 360 px in ${lang} each chip and its x are at least 44 px tall`, async () => {
    const { page } = await open(360, lang)
    await addFilter(page, lang === 'en' ? 'Channel' : 'চ্যানেল', lang === 'en' ? ['Facebook'] : ['ফেসবুক'])
    await addFilter(
      page,
      lang === 'en' ? 'Payment method' : 'পেমেন্ট পদ্ধতি',
      lang === 'en' ? ['Cash on delivery', 'bKash'] : ['বিকাশ'],
    )
    const boxes = await page
      .locator('e-report-filter:has(:checked), e-report-filter:has(:checked) > button')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()))
    expect(boxes.length).toBe(6)
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44)
    for (const box of boxes) expect(box.right).toBeLessThanOrEqual(360 - 16)
  })
}
