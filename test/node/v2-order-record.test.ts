// The sample app's order #1042 read as a record, built from kit parts: a header with a back arrow, its
// status and payment badges and a line of facts; lines with thumbnails; payment rows ending in what is
// due; a timeline with a comment box; the customer as a person; and on a phone a dock with Call and
// Confirm.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function order(width: number, lang: 'en' | 'bn' = 'en', number = 1042) {
  const { page, errors } = await pages.open('', width)
  await page.goto(`${pages.sampleApp}/orders/${number}?lang=${lang}`)
  await page.locator('#tags-card > h2').waitFor()
  await page.evaluate(() => document.fonts.ready)
  return { page, errors }
}

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!

test('at 1440 px #1042 is 1040 px wide and centred, with a 320 px side column', async () => {
  const { page, errors } = await order(1440)
  const record = await box(page, 'e-page')
  expect(record.width).toBe(1040)
  const body = await page.evaluate(() => document.body.clientWidth)
  expect(Math.abs(record.x - (body - record.x - record.width))).toBeLessThanOrEqual(1)
  expect((await box(page, '#customer-card')).width).toBe(320)
  expect(errors).toEqual([])
})

test('the header has a back arrow to the orders list, Order #1042 with New and Unpaid, and its facts', async () => {
  const { page } = await order(1440)
  const back = page.locator('e-page > a[slot="back"]')
  expect(await back.getAttribute('href')).toBe('/orders')
  expect(await back.getAttribute('aria-label')).toBe('All orders')
  expect(await back.locator('e-icon').getAttribute('name')).toBe('arrow-left')
  const title = await box(page, 'e-page > h1')
  expect(await page.locator('e-page > h1').textContent()).toBe('Order #1042')
  const arrow = await box(page, 'e-page > a[slot="back"]')
  expect(arrow.x + arrow.width).toBeLessThanOrEqual(title.x)
  const badges = page.locator('e-page > [slot="status"] e-badge')
  expect(await badges.allTextContents()).toEqual(['New', 'Unpaid'])
  expect(await badges.evaluateAll((all) => all.map((badge) => badge.getAttribute('tone')))).toEqual(['new', 'warn'])
  for (const badge of await badges.all()) {
    const at = (await badge.boundingBox())!
    expect(Math.abs(at.y + at.height / 2 - (title.y + title.height / 2))).toBeLessThanOrEqual(2)
    expect(at.x).toBeGreaterThan(title.x + title.width - 1)
  }
  const facts = page.locator('e-page > [slot="facts"]')
  expect(await facts.textContent()).toContain('11:24 AM')
  expect(await facts.textContent()).toContain('Facebook')
  expect((await facts.boundingBox())!.y).toBeGreaterThanOrEqual(title.y + title.height)
})

test('in Bangla the header keeps #1042 in Latin digits and says the time with its time of day', async () => {
  const { page } = await order(1440, 'bn')
  expect(await page.locator('e-page > h1').textContent()).toBe('অর্ডার #1042')
  expect(await page.locator('e-page > a[slot="back"]').getAttribute('aria-label')).toBe('সব অর্ডার')
  expect(await page.locator('e-page > [slot="status"] e-badge').allTextContents()).toEqual(['নতুন', 'অপরিশোধিত'])
  expect(await page.locator('e-page > [slot="facts"]').textContent()).toContain('সকাল ১১:২৪')
})

test("#1042's Items card shows 2 lines, each with a 40 px thumbnail, × and its price, and its amount at the end", async () => {
  const { page, errors } = await order(1440)
  const lines = page.locator('#items-card e-line-item')
  expect(await lines.count()).toBe(2)
  const card = await box(page, '#items-card')
  const rights: number[] = []
  for (const line of await lines.all()) {
    const thumb = (await line.locator('e-thumbnail').boundingBox())!
    expect([thumb.width, thumb.height]).toEqual([40, 40])
    expect(await line.locator('[slot="price"]').textContent()).toMatch(/^1 × ৳[\d,]+$/)
    const amount = (await line.locator('[slot="amount"]').boundingBox())!
    rights.push(amount.x + amount.width)
  }
  expect(rights[0]).toBe(rights[1])
  // At the card's right padding edge: 20 px of padding inside a 1 px border.
  expect(Math.abs(card.x + card.width - rights[0]! - 21)).toBeLessThanOrEqual(1)
  const amounts = await lines.locator('[slot="amount"]').allTextContents()
  const sum = amounts.reduce((total, amount) => total + Number(amount.replace(/[৳,]/g, '')), 0)
  expect(sum).toBe(1810)
  expect(errors).toEqual([])
})

test('in Bangla a line reads its quantity and price in Bangla digits', async () => {
  const { page } = await order(360, 'bn')
  expect(await page.locator('#items-card e-line-item [slot="price"]').first().textContent()).toMatch(/^১ × ৳[০-৯,]+$/)
})

test('the Payment card ends in a Total row at 600 weight and an amber "To collect ৳1,930 on delivery"', async () => {
  const { page } = await order(1440)
  const rows = page.locator('#payment-card e-summary-row')
  expect(await rows.evaluateAll((all) => all.map((row) => row.firstElementChild!.textContent))).toEqual([
    'Subtotal',
    'Delivery',
    'Total',
  ])
  const total = rows.last()
  expect(await total.getAttribute('total')).toBe('')
  expect(await total.evaluate((row) => getComputedStyle(row).fontWeight)).toBe('600')
  expect(await total.locator('> :last-child').textContent()).toBe('৳1,930')
  const due = page.locator('#payment-card e-due')
  expect(await due.textContent()).toBe('To collect ৳1,930 on delivery')
  expect(await due.getAttribute('tone')).toBe('warning')
})

test('a paid order says so in green', async () => {
  const { page } = await order(1440, 'en', 1041)
  expect(await page.locator('e-page > [slot="status"] e-badge').allTextContents()).toEqual(['Confirmed', 'Paid'])
  const due = page.locator('#payment-card e-due')
  expect(await due.getAttribute('tone')).toBe('success')
  expect(await due.textContent()).toBe('Paid ৳3,200 by bKash')
})

// #1042 framed by the playground, as the Admin shows it, with the Admin's save bar.
async function framed(width = 1440, number = 1042) {
  const opened = await pages.open('', width, { viewport: { width, height: 800 } })
  await opened.page.context().addInitScript(() => {
    localStorage.setItem('ebdfy-playground-lang', 'en')
    localStorage.setItem('ebdfy-sample-lang', 'en')
  })
  await opened.page.goto(`${pages.ui}/playground/orders/${number}`)
  const frame = (await (await opened.page.locator('e-admin-panel > iframe').elementHandle())!.contentFrame())!
  await frame.locator('#tags-card e-chip > button').first().waitFor()
  await frame.waitForFunction(() => 'ebdfy' in globalThis)
  return { ...opened, app: frame }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')

test("#1042's timeline shows Today, then steps with an actor and a 12-hour time on a rail, and a comment as a block", async () => {
  const { page } = await order(1440)
  const timeline = page.locator('#timeline-card e-timeline')
  expect(await timeline.locator('e-timeline-day').first().textContent()).toBe('Today')
  const steps = timeline.locator('e-timeline-item')
  expect(await steps.count()).toBeGreaterThanOrEqual(3)
  for (const step of await steps.all()) {
    expect((await step.locator('[slot="actor"]').textContent())!.length).toBeGreaterThan(0)
    expect(await step.locator('[slot="time"]').textContent()).toMatch(/^\d{1,2}:\d\d (AM|PM)$/)
  }
  expect(await steps.last().textContent()).toContain('Rahima Akter placed the order on Facebook')
  expect(await steps.last().locator('[slot="time"]').textContent()).toBe('11:24 AM')
  const comment = timeline.locator('e-timeline-item[kind="comment"]').first()
  const actor = (await comment.locator('[slot="actor"]').boundingBox())!
  const body = (await comment.locator('[slot="body"]').boundingBox())!
  expect(body.y).toBeGreaterThanOrEqual(actor.y + actor.height)
})

test('the composer shows RA in lime and a visible Comment label; posting adds the comment first', async () => {
  const { page, errors } = await order(1440)
  const composer = page.locator('#timeline-card form[slot="composer"]')
  expect(await composer.locator('e-avatar').getAttribute('initials')).toBe('RA')
  expect(await composer.locator('e-avatar').getAttribute('tone')).toBe('lime')
  const label = composer.locator('label')
  expect(await label.textContent()).toBe('Comment')
  expect(await label.isVisible()).toBe(true)
  await composer.getByLabel('Comment').fill('Called, will confirm')
  await composer.getByRole('button', { name: 'Post' }).click()
  const first = page.locator('#timeline-card e-timeline-item').first()
  expect(await first.locator('[slot="body"]').textContent()).toBe('Called, will confirm')
  expect(await first.locator('[slot="actor"]').textContent()).toBe('Rafiq Ahmed')
  expect(await composer.getByLabel('Comment').inputValue()).toBe('')
  expect(errors).toEqual([])
})

test("typing a comment does not raise the Admin's save bar, and posting it does not either", async () => {
  const { page, app } = await framed()
  await app.locator('#timeline-card').getByLabel('Comment').fill('Called, will confirm')
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(await bar(page).isVisible()).toBe(false)
  await app.locator('#timeline-card').getByRole('button', { name: 'Post' }).click()
  await expect
    .poll(() => app.locator('#timeline-card e-timeline-item [slot="body"]').first().textContent())
    .toBe('Called, will confirm')
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(await bar(page).isVisible()).toBe(false)
})

test("removing a tag raises the Admin's bar, and Discard puts the chip back and lowers it", async () => {
  const { page, app } = await framed()
  const chips = app.locator('#tags-card e-chip')
  expect(await chips.allTextContents()).toEqual(['Facebook', 'Repeat customer'])
  await app.getByRole('button', { name: 'Remove Facebook' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await chips.allTextContents()).toEqual(['Repeat customer'])
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => chips.allTextContents()).toEqual(['Facebook', 'Repeat customer'])
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test("#1042's Customer card shows RA in a 32 px avatar, the name, a history line and a phone that calls and copies", async () => {
  const { page } = await order(1440)
  const card = page.locator('#customer-card')
  const avatar = card.locator('e-person e-avatar')
  expect(await avatar.getAttribute('initials')).toBe('RA')
  expect((await avatar.boundingBox())!.width).toBe(32)
  expect(await card.locator('e-person').textContent()).toContain('Rahima Akter')
  expect(await card.locator('e-person [slot="meta"]').textContent()).toBe('12 orders · ৳18,460 spent')
  const phone = card.locator('e-contact a')
  expect(await phone.getAttribute('href')).toBe('tel:01707071042')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await card.getByRole('button', { name: 'Copy 01707071042' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('01707071042')
})

test("the Risk card's meter fills its share", async () => {
  const { page } = await order(1440)
  const meter = page.locator('#risk-card e-meter')
  const [track, fill] = await meter.evaluate((el) => [
    el.getBoundingClientRect().width,
    Number.parseFloat(getComputedStyle(el, '::before').width),
  ])
  expect(fill / track!).toBeCloseTo(Number(await meter.getAttribute('value')) / 100, 2)
})

test('at 360 px the Customer card comes before Items, the timeline is the last card, and the dock holds Call and Confirm', async () => {
  const { page, errors } = await order(360)
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll('e-card')]
      .map((card) => ({ id: card.id, top: card.getBoundingClientRect().top }))
      .sort((one, other) => one.top - other.top)
      .map((card) => card.id),
  )
  expect(tops[0]).toBe('customer-card')
  expect(tops.indexOf('customer-card')).toBeLessThan(tops.indexOf('items-card'))
  expect(tops.at(-1)).toBe('timeline-card')
  const dock = page.locator('e-bottom-bar[dock]')
  expect(await dock.locator('e-button:visible').allTextContents()).toEqual(['Call', 'Confirm'])
  for (const button of await dock.locator('e-button').all()) {
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  expect(Math.round((await dock.boundingBox())!.y + (await dock.boundingBox())!.height)).toBe(800)
  expect(await page.locator('e-page > e-button[slot="actions"]').isVisible()).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  expect(errors).toEqual([])
})

test("in the playground at 360 px the dock sits above the Admin's tab bar", async () => {
  const { page } = await framed(360)
  const frame = (await page.locator('e-admin-panel > iframe').boundingBox())!
  const tabs = (await page.locator('nav[slot="tabs"]').boundingBox())!
  const app = page.frameLocator('e-admin-panel > iframe')
  const dock = (await app.locator('e-bottom-bar[dock]').boundingBox())!
  expect(dock.y + dock.height).toBeLessThanOrEqual(tabs.y + 1)
  expect(dock.y + dock.height).toBeLessThanOrEqual(frame.y + frame.height + 1)
  expect(await app.locator('e-bottom-bar[dock] e-button:visible').allTextContents()).toEqual(['Call', 'Confirm'])
})

test('for #1034, whose customer gave no phone, the dock holds only Confirm and no contact row is drawn', async () => {
  const { page } = await order(360, 'en', 1034)
  expect(await page.locator('e-bottom-bar[dock] e-button:visible').allTextContents()).toEqual(['Confirm'])
  expect(await page.locator('#customer-card e-contact').isVisible()).toBe(false)
  expect(await page.locator('#customer-card e-contact').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
})

test('a confirmed order has no dock Confirm, and its dock keeps Call', async () => {
  const { page } = await order(360, 'en', 1041)
  expect(await page.locator('e-bottom-bar[dock] e-button:visible').allTextContents()).toEqual(['Call'])
})

test("in the playground the contact's copy button puts the number on the clipboard", async () => {
  const { page, app } = await framed()
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await app.locator('#customer-card').getByRole('button', { name: 'Copy 01707071042' }).click()
  await expect.poll(() => app.locator('#customer-card e-contact button').getAttribute('aria-label')).toBe('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('01707071042')
})

test("the Admin's Save keeps the tags as they are, on the same page, and says so", async () => {
  const { page, app } = await framed()
  const url = app.url()
  await app.getByRole('button', { name: 'Remove Facebook' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Saved')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(app.url()).toBe(url)
  expect(await app.locator('#tags-card e-chip').allTextContents()).toEqual(['Repeat customer'])
})
