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

test('in the playground order #1039 at 360 x 780 has a Back chevron, no tab bar, and at most 180 px of chrome', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360)
  await page.setViewportSize({ width: 360, height: 780 })
  const app = page.frameLocator('eb-admin-chrome iframe')
  const title = page.locator('eb-admin-chrome [part="title"]')
  const tabBar = () =>
    page
      .locator('eb-admin-chrome')
      .evaluate((el) => el.shadowRoot!.querySelector('nav:not([part])')!.getBoundingClientRect().height)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1039' }).click({ timeout: 15_000 })
  await app.locator('#order eb-heading:defined').first().waitFor({ timeout: 15_000 })
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Order #1039')
  await expect.poll(tabBar, { timeout: 15_000 }).toBe(0)
  const back = page.locator('eb-admin-chrome [part="title-back"]')
  expect(await back.getAttribute('aria-label')).toBe('Back')
  const chrome = await page.locator('eb-admin-chrome').evaluate((el) => {
    const frame = el.shadowRoot!.querySelector('.frame')!.getBoundingClientRect()
    return el.getBoundingClientRect().height - frame.height
  })
  expect(chrome).toBeLessThanOrEqual(180)
  // Back opens the orders list, whose screen has no bottom bar, so the tab bar returns.
  await back.click()
  await expect.poll(() => title.textContent(), { timeout: 15_000 }).toBe('Orders')
  await expect.poll(tabBar).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

// On a desktop the order uses the width: the order and its items on the left, the customer on the
// right, and its two actions in the Admin's title bar instead of a bar at the foot.
test('in the playground at 1280 px order #1039 is two columns with its actions in the title bar', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1039' }).click({ timeout: 15_000 })
  await app.locator('#order eb-heading:defined').first().waitFor({ timeout: 15_000 })
  const actions = page.locator('eb-admin-chrome [part="title-action"]')
  await expect.poll(() => actions.allInnerTexts(), { timeout: 15_000 }).toEqual(['Ask for advance', 'Confirm order'])
  expect(await app.locator('eb-bottom-bar').isVisible()).toBe(false)
  const box = (selector: string) =>
    app
      .locator(selector)
      .first()
      .evaluate((el) => el.getBoundingClientRect().toJSON())
  const [amount, items, customer] = [
    await box('#order eb-heading[level="2"]'),
    await box('#order eb-card[heading="Items"]'),
    await box('#order eb-card:has(eb-avatar)'),
  ]
  expect(customer.left).toBeGreaterThan(items.right)
  expect(customer.top).toBeLessThanOrEqual(amount.bottom)
  // 2fr and 1fr, less the gap.
  expect(items.width / customer.width).toBeGreaterThan(1.8)
  expect(items.width / customer.width).toBeLessThan(2.2)
  await actions.filter({ hasText: 'Confirm order' }).click()
  await expect
    .poll(() => page.locator('eb-admin-chrome [part="toast"] span').textContent())
    .toBe('Order #1039 confirmed')
  expect(errors).toEqual([])
})

test.for([
  [1023, 1, true],
  [640, 1, true],
  [639, 1, false],
] as const)('at %i px order #1039 is %i column and its bottom bar hidden: %s', async ([width, , hidden]) => {
  const { page, errors } = await openOrder(width, 'en')
  const customer = await box(page, '#order eb-card:has(eb-avatar)')
  const items = await box(page, '#order eb-card[heading="Items"]')
  expect(Math.round(customer.left)).toBe(Math.round(items.left))
  expect(await page.locator('eb-bottom-bar').isVisible()).toBe(!hidden)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  // The order's blocks stand 12 px apart.
  const gaps = await page.locator('#order-content').evaluate((content) => {
    const boxes = [...content.children].map((child) => child.getBoundingClientRect())
    return boxes.slice(1).map((next, i) => Math.round(next.top - boxes[i]!.bottom))
  })
  expect(new Set(gaps)).toEqual(new Set([12]))
  expect(errors).toEqual([])
})
