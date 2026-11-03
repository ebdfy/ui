import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

type Page = Awaited<ReturnType<typeof pages.open>>['page']

// The order is drawn once its words are in, after v1.js has defined every element on it.
async function openOrder(width: number, lang: 'bn' | 'en') {
  const { page, errors } = await pages.open(`${pages.sampleApp}/order-1039`, width)
  await page.locator('#order eb-heading:defined').first().waitFor({ timeout: 15_000 })
  await page.locator(`.languages eb-button[data-lang="${lang}"]`).click()
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe(lang)
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

const box = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const { top, bottom, left, right } = el.getBoundingClientRect()
      return { top, bottom, left, right }
    })

test('on a phone in Bangla order #1039 shows ৳১,৮০০ at 22/32 first, the risk banner, then the customer', async () => {
  const { page, errors } = await openOrder(360, 'bn')
  const amount = page.locator('#order eb-heading[level="2"]').first()
  expect(await amount.textContent()).toBe('৳১,৮০০')
  expect(
    await amount.evaluate((el) => {
      const style = getComputedStyle(el.shadowRoot!.querySelector('h2')!)
      return [style.fontSize, style.lineHeight]
    }),
  ).toEqual(['22px', '32px'])
  const status = page.locator('#order eb-badge').first()
  expect([await status.getAttribute('tone'), await status.textContent()]).toEqual(['attention', 'নতুন'])
  const banner = page.locator('#order eb-banner[tone="danger"]')
  expect(await banner.textContent()).toBe('এই নম্বরের ৫টি অর্ডারের ৩টি ফেরত এসেছে। বিকাশে ৳১২০ অগ্রিম নিন।')
  const customer = page.locator('#order eb-card', { has: page.locator('eb-avatar') })
  expect(await customer.innerText()).toContain('মো. হাসান')
  expect(await customer.innerText()).toContain('01911-004471')
  // The amount comes first, under the title bar; the banner sits between it and the customer.
  const [hero, warning, card] = [
    await box(page, '#order eb-heading[level="2"]'),
    await box(page, '#order eb-banner'),
    await box(page, '#order eb-card:has(eb-avatar)'),
  ]
  expect(hero.bottom).toBeLessThanOrEqual(warning.top)
  expect(warning.bottom).toBeLessThanOrEqual(card.top)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  expect(errors).toEqual([])
})

test('order #1039 lists its three items and the delivery, which add up to its total', async () => {
  const { page } = await openOrder(360, 'en')
  const items = page.locator('#order eb-card[heading="Items"]')
  const text = await items.innerText()
  for (const words of ['Panjabi', 'Cream · L · 2 × ৳500', '৳1,000', 'Tupi', '৳290', 'Attar', '৳450']) {
    expect(text).toContain(words)
  }
  expect(text).toContain('Delivery, inside Dhaka')
  expect(text).toContain('৳60')
  expect(await items.locator('eb-thumbnail').count()).toBe(3)
  expect(await page.locator('#order eb-heading[level="2"]').first().textContent()).toBe('৳1,800')
})

test('on a phone the bar at the foot holds Ask for advance and Confirm order side by side', async () => {
  const { page, errors } = await openOrder(360, 'en')
  const buttons = page.locator('eb-bottom-bar eb-button')
  expect(await buttons.allTextContents()).toEqual(['Ask for advance', 'Confirm order'])
  expect(await buttons.evaluateAll((els) => els.map((el) => el.getAttribute('variant')))).toEqual([
    'secondary',
    'primary',
  ])
  const [ask, confirm] = [
    await box(page, 'eb-bottom-bar eb-button'),
    await box(page, 'eb-bottom-bar eb-button >> nth=1'),
  ]
  expect(ask.top).toBe(confirm.top)
  expect(ask.right).toBeLessThanOrEqual(confirm.left)
  await page.locator('eb-bottom-bar eb-button', { hasText: 'Confirm order' }).click()
  expect(errors).toEqual([])
})

test('every word on order #1039 is drawn by an eb-* element, never by bare markup', async () => {
  const { page } = await openOrder(360, 'bn')
  const bare = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const loose: string[] = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const parent = node.parentElement!
      if (text && !parent.localName.startsWith('eb-') && !parent.closest('script, style')) loose.push(text)
    }
    return loose
  })
  expect(bare).toEqual([])
})

test('in the playground order #1039 is an entry in the app nav and titles the bar in Bangla', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1039' }).click({ timeout: 15_000 })
  await app.locator('#order eb-heading:defined').first().waitFor({ timeout: 15_000 })
  await expect.poll(() => page.locator('eb-admin-chrome [part="title"]').textContent()).toBe('Order #1039')
  await app.locator('.languages eb-button[data-lang="bn"]').click()
  await expect.poll(() => page.locator('eb-admin-chrome [part="title"]').textContent()).toBe('অর্ডার #1039')
  expect(errors).toEqual([])
})
