import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

type Page = Awaited<ReturnType<typeof pages.open>>['page']

const rowsLoaded = (page: Page) => page.locator('eb-row').first().waitFor({ timeout: 15_000 })
// A header cell shows the eb-column assigned to its slot.
const headings = (page: Page) =>
  page
    .locator('eb-table [role="columnheader"] slot')
    .evaluateAll((slots) => slots.map((slot) => (slot as HTMLSlotElement).assignedElements()[0]?.textContent ?? ''))
const scrollWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth)

test('at 360 px in Bangla the orders are cards with their status and courier badges', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 360)
  await rowsLoaded(page)
  await page.locator('eb-button', { hasText: 'বাংলা' }).click()
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('bn')
  const first = page.locator('eb-row').first()
  await first.locator('[part="card"]').waitFor()
  expect(await page.locator('eb-table [role="table"]').count()).toBe(0)
  const text = await first.innerText()
  for (const words of ['#1042', 'রহিম উদ্দিন', '৳১,২৫০', 'নতুন']) expect(text).toContain(words)
  expect(await page.locator('eb-row', { hasText: '#1040' }).locator('eb-courier-status eb-badge').innerText()).toBe(
    'কুরিয়ারে',
  )
  expect(await scrollWidth(page)).toBeLessThanOrEqual(360)
  expect(errors).toEqual([])
})

test('at 1280 px the orders are a table under Order, Customer, Area, Status, Payment and Total', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/`, 1280)
  await rowsLoaded(page)
  await expect.poll(() => headings(page)).toEqual(['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total'])
  expect(await page.locator('eb-row').count()).toBe(5)
  const courier = page.locator('eb-row', { hasText: '#1040' }).locator('eb-courier-status eb-badge')
  await expect.poll(() => courier.innerText()).toBe('With courier')
  expect(await scrollWidth(page)).toBeLessThanOrEqual(1280)
})

test('the orders are cards at 599 px and a table at 600 and 700 px, never scrolling sideways', async () => {
  for (const [width, role] of [
    [599, 'list'],
    [600, 'table'],
    [700, 'table'],
  ] as const) {
    const { page } = await pages.open(`${pages.sampleApp}/`, width)
    await rowsLoaded(page)
    expect(await page.locator(`eb-table [role="${role}"]`).count(), `${width}`).toBe(1)
    for (const lang of ['English', 'বাংলা']) {
      await page.locator('eb-button', { hasText: lang }).click()
      expect(await scrollWidth(page), `${width} ${lang}`).toBeLessThanOrEqual(width)
    }
  }
})

test('while the orders load the list shows 4 skeleton rows, and its top stays put when 5 rows arrive', async () => {
  const { page } = await pages.open('', 360)
  await page.goto(`${pages.sampleApp}/`, { waitUntil: 'commit' })
  const skeletons = page.locator('eb-table [part="skeleton"]')
  await skeletons.first().waitFor()
  expect(await skeletons.count()).toBe(4)
  const top = await page.locator('eb-table').evaluate((table) => table.getBoundingClientRect().top)
  await rowsLoaded(page)
  expect(await page.locator('eb-row').count()).toBe(5)
  expect(await skeletons.count()).toBe(0)
  expect(await page.locator('eb-table').evaluate((table) => table.getBoundingClientRect().top)).toBe(top)
})

test('the drafts page has no orders and says so, with its action', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/drafts`, 360)
  const empty = page.locator('eb-empty-state')
  await empty.waitFor({ timeout: 15_000 })
  expect(await empty.getAttribute('heading')).toBe('No orders yet')
  const action = empty.locator('eb-button[slot="action"]')
  expect(await action.innerText()).toBe('Add order')
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect(errors).toEqual([])
})

test("the sample app's 4 pages show in the playground nav, and a tap opens one", async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360)
  const entries = page.locator('eb-admin-chrome [part="app-nav"] a')
  await expect
    .poll(() => entries.allInnerTexts(), { timeout: 15_000 })
    .toEqual(['Orders', 'Order #1001', 'Order #1039', 'Drafts'])
  expect(await page.locator('eb-admin-chrome [part="app-nav"]').getAttribute('aria-label')).toBe('Sample app')
  expect(await entries.first().getAttribute('aria-current')).toBe('page')
  await entries.nth(1).click()
  const app = page.frameLocator('eb-admin-chrome iframe')
  await expect.poll(() => app.locator('eb-text-area[name="note"] textarea').inputValue()).toBe('Call before delivery.')
  expect(await entries.nth(1).getAttribute('aria-current')).toBe('page')
  expect(await page.locator('eb-admin-chrome [part="title"]').textContent()).toBe('Order #1001')
  expect(errors).toEqual([])
})

// The orders Show path: status a busy seller can scan, the open order, a selection and its bulk bar,
// and a risk flag that names itself.
const rowOf = (page: Page, number: number) => page.locator('eb-row', { hasText: `#${number}` })

test('at 1280 px the orders read Order, Customer, Area, Status, Payment and Total, #1039 open', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 1280)
  await rowsLoaded(page)
  await expect.poll(() => headings(page)).toEqual(['Order', 'Customer', 'Area', 'Status', 'Payment', 'Total'])
  expect(await page.locator('eb-row').count()).toBe(5)
  expect(await rowOf(page, 1042).locator('eb-badge').getAttribute('tone')).toBe('attention')
  expect(await rowOf(page, 1042).locator('eb-badge').innerText()).toBe('New')
  expect(await rowOf(page, 1041).locator('eb-badge').innerText()).toBe('Confirmed')
  expect(await rowOf(page, 1040).locator('eb-courier-status eb-badge').innerText()).toBe('With courier')
  const returned = rowOf(page, 1038).locator('eb-courier-status eb-badge')
  expect([await returned.innerText(), await returned.getAttribute('tone')]).toEqual(['Returned', 'critical'])
  expect(await rowOf(page, 1041).innerText()).toContain('bKash ৳120')
  expect(await rowOf(page, 1042).innerText()).toContain('COD')
  const open = await page
    .locator('eb-row')
    .evaluateAll((rows) => rows.filter((row) => row.hasAttribute('open')).map((row) => row.textContent))
  expect(open).toHaveLength(1)
  expect(open[0]).toContain('#1039')
  expect(errors).toEqual([])
})

test('selecting two orders shows the bulk bar reading 2 selected, and Clear selection empties it', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 1280)
  await rowsLoaded(page)
  const bar = page.locator('eb-bulk-bar')
  expect(await bar.evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
  await page.getByRole('checkbox', { name: 'Select #1042', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select #1041', exact: true }).click()
  await expect.poll(() => bar.locator('[role="status"]').innerText()).toBe('2 selected')
  expect(await page.getByRole('checkbox', { name: 'Select all', exact: true }).getAttribute('aria-checked')).toBe(
    'mixed',
  )
  expect(await bar.locator('eb-button').allInnerTexts()).toEqual(['Confirm', 'Book courier', 'Print labels'])
  const box = await bar.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(800)
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await expect.poll(() => bar.evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
  expect(await page.locator('eb-row[selected]').count()).toBe(0)
  expect(errors).toEqual([])
})

test('pressing Confirm turns the selected New orders Confirmed and clears the selection', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/`, 1280)
  await rowsLoaded(page)
  await page.getByRole('checkbox', { name: 'Select #1042', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select #1039', exact: true }).click()
  await page.locator('eb-bulk-bar eb-button', { hasText: 'Confirm' }).click()
  await expect.poll(() => rowOf(page, 1042).locator('eb-badge').innerText()).toBe('Confirmed')
  expect(await rowOf(page, 1039).locator('eb-badge').innerText()).toBe('Confirmed')
  expect(await page.locator('eb-row[selected]').count()).toBe(0)
  expect(await page.locator('eb-bulk-bar').evaluate((el) => el.getBoundingClientRect().height)).toBe(0)
})

test('the risk flag on #1039 is named High return risk and says so on hover and on focus', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 1280)
  await rowsLoaded(page)
  const flag = page.getByRole('img', { name: 'High return risk', exact: true })
  expect(await flag.count()).toBe(1)
  expect(await rowOf(page, 1039).getByRole('img', { name: 'High return risk' }).count()).toBe(1)
  const tip = rowOf(page, 1039).locator('eb-tooltip [role="tooltip"]')
  await flag.hover()
  await expect.poll(() => tip.isVisible()).toBe(true)
  expect(await tip.innerText()).toBe('High return risk')
  await page.mouse.move(0, 0)
  await expect.poll(() => tip.isVisible()).toBe(false)
  await flag.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect.poll(() => tip.isVisible()).toBe(true)
  await page.locator('eb-button', { hasText: 'বাংলা' }).click()
  expect(await page.getByRole('img', { name: 'ফেরতের ঝুঁকি বেশি', exact: true }).count()).toBe(1)
  expect(errors).toEqual([])
})

test('at 360 px in Bangla each card shows name, amount, number, area, payment and status, and #1039 its risk', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`, 360)
  await rowsLoaded(page)
  await page.locator('eb-button', { hasText: 'বাংলা' }).click()
  await expect.poll(() => page.locator('html').getAttribute('lang')).toBe('bn')
  const card = rowOf(page, 1039)
  await card.locator('[part="card"]').waitFor()
  const text = await card.innerText()
  for (const words of ['মো. হাসান', '৳১,৮০০', '#1039', 'সাভার, ঢাকা', 'COD', 'নতুন', '৫টি অর্ডারের ৩টি ফেরত এসেছে']) {
    expect(text).toContain(words)
  }
  expect(await rowOf(page, 1041).innerText()).toContain('বিকাশ ৳১২০')
  const banner = card.locator('eb-banner')
  const below = await card.evaluate((row) => {
    const note = row.querySelector('eb-banner')!.getBoundingClientRect()
    const amount = [...row.children][5]!.getBoundingClientRect()
    return note.top > amount.bottom
  })
  expect(below).toBe(true)
  expect(await banner.getAttribute('tone')).toBe('danger')
  // One digit system per string: the order number stays Latin, every other string on the card is Bangla.
  const strings = await card.evaluate((row) =>
    [...row.children]
      .flatMap((cell) => (cell.textContent ?? '').split(/\s{2,}/))
      .map((s) => s.trim())
      .filter(Boolean),
  )
  expect(strings.filter((s) => /[0-9]/.test(s) && /[০-৯]/.test(s))).toEqual([])
  expect(strings.filter((s) => /[0-9]/.test(s))).toEqual(['#1039'])
  expect(errors).toEqual([])
})

test('after the switch to Bangla the pagination names itself in Bangla', async () => {
  const { page } = await pages.open(`${pages.sampleApp}/`, 360)
  await rowsLoaded(page)
  await page.locator('eb-button', { hasText: 'বাংলা' }).click()
  const nav = page.locator('eb-pagination nav')
  await expect.poll(() => nav.getAttribute('aria-label')).toBe('পাতা')
  expect(
    await page.locator('eb-pagination button').evaluateAll((b) => b.map((el) => el.getAttribute('aria-label'))),
  ).toEqual(['আগের পাতা', 'পরের পাতা'])
})
