// The orders list's Show path, in the v2 playground: the sample app's orders page shows its metrics and an index
// table, rows ticked by a person raise the bulk actions, a search with no rows offers its way back,
// and on a phone the rows are cards that open their order inside the Admin.
import type { FrameLocator } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const words = {
  en: {
    title: 'Orders',
    metric: 'Orders today 38 +12%',
    tabs: ['All 120', 'New 12', 'Confirmed 18', 'With courier 54', 'Delivered 30', 'Returned 6'],
    search: 'Search orders',
    chip: 'Remove Date: Last 30 days',
    add: 'Add filter',
    sort: 'Sort',
    tick: (n: number) => `Select #${n}`,
    selected: '2 selected',
    bulk: ['Confirm', 'Book courier', 'Print labels'],
    none: 'No orders match',
    clear: 'Clear search',
  },
  bn: {
    title: 'অর্ডার',
    metric: 'আজকের অর্ডার ৩৮ +১২%',
    tabs: ['সব ১২০', 'নতুন ১২', 'কনফার্মড ১৮', 'কুরিয়ারে ৫৪', 'ডেলিভারি হয়েছে ৩০', 'ফেরত এসেছে ৬'],
    search: 'অর্ডার খুঁজুন',
    chip: 'তারিখ: গত ৩০ দিন সরান',
    add: 'ফিল্টার যোগ করুন',
    sort: 'সাজান',
    tick: (n: number) => `অর্ডার #${n} নির্বাচন করুন`,
    selected: '২টি নির্বাচিত',
    bulk: ['কনফার্ম করুন', 'কুরিয়ার বুক করুন', 'লেবেল প্রিন্ট করুন'],
    none: 'কোনো অর্ডার মেলেনি',
    clear: 'খোঁজা মুছুন',
  },
}

async function playground(lang: 'en' | 'bn', width: number) {
  const opened = await pages.open('', width, width < 600 ? { hasTouch: true } : {})
  await opened.page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-sample-lang', chosen)
    localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}/playground`)
  await expect
    .poll(() => opened.page.locator('e-admin-panel header h1').textContent(), { timeout: 15_000 })
    .toBe(words[lang].title)
  const app = opened.page.frameLocator('e-admin-panel iframe')
  await app.getByRole('searchbox').waitFor()
  return { ...opened, app }
}

const rows = (app: FrameLocator) => app.locator('e-table > e-row:not([head])')

test.for(['en', 'bn'] as const)('in %s at 1440 px the orders page shows the Show path, step by step', async (lang) => {
  const t = words[lang]
  const { page, app, errors } = await playground(lang, 1440)
  // Four metrics, view tabs with counts, search, a removable date chip, Add filter and a sort.
  const metrics = app.locator('e-metrics > *')
  expect(await metrics.count()).toBe(4)
  expect((await metrics.first().textContent())!.replace(/\s+/g, ' ').trim()).toBe(t.metric)
  for (const name of t.tabs) expect(await app.getByRole('tab', { name }).isVisible()).toBe(true)
  expect(await app.getByRole('searchbox', { name: t.search }).isVisible()).toBe(true)
  expect(await app.getByRole('button', { name: t.chip }).isVisible()).toBe(true)
  expect(await app.getByRole('button', { name: t.add }).isVisible()).toBe(true)
  expect(await app.getByRole('combobox', { name: t.sort }).isVisible()).toBe(true)

  // Tick two rows: "2 selected" with Confirm, Book courier and Print labels replaces the toolbar.
  await app.getByRole('checkbox', { name: t.tick(1042) }).click()
  await app.getByRole('checkbox', { name: t.tick(1041) }).click()
  await expect.poll(() => app.getByRole('status').textContent()).toBe(t.selected)
  for (const name of t.bulk) expect(await app.getByRole('button', { name, exact: true }).isVisible()).toBe(true)
  expect(await app.getByRole('searchbox').isVisible()).toBe(false)
  for (const n of [1042, 1041]) await app.getByRole('checkbox', { name: t.tick(n) }).click()

  // Search zzz: "No orders match" shows with Clear search, and the pager goes.
  await app.getByRole('searchbox').fill('zzz')
  expect(await app.getByRole('heading', { name: t.none }).isVisible()).toBe(true)
  expect(await app.locator('e-pagination').isVisible()).toBe(false)
  await app.getByRole('button', { name: t.clear }).click()
  expect(await rows(app).count()).toBe(10)
  expect(errors).toEqual([])
  await page.close()
})

test.for(['en', 'bn'] as const)(
  'in %s at 360 px the rows are cards with checkboxes, and a card opens its order',
  async (lang) => {
    const t = words[lang]
    const { page, app } = await playground(lang, 360)
    const first = rows(app).first()
    expect(await first.evaluate((row) => getComputedStyle(row).display)).toBe('grid')
    // A person ticks two cards by tapping their checkboxes, and the bulk actions show.
    await app.getByRole('checkbox', { name: t.tick(1042) }).tap()
    await app.getByRole('checkbox', { name: t.tick(1041) }).tap()
    await expect.poll(() => app.getByRole('status').textContent()).toBe(t.selected)
    for (const name of t.bulk) expect(await app.getByRole('button', { name, exact: true }).isVisible()).toBe(true)
    for (const n of [1042, 1041]) await app.getByRole('checkbox', { name: t.tick(n) }).tap()

    // A tap on the card, away from its number, opens the order inside the Admin with the store kept.
    const box = (await first.boundingBox())!
    await first.tap({ position: { x: box.width / 2, y: box.height - 14 } })
    await page.waitForURL(/\/playground\/orders\/1042$/)
    const frame = page.frames().find((one) => one.url().startsWith(`${pages.sampleApp}/orders/`))
    expect(frame?.url()).toBe(`${pages.sampleApp}/orders/1042?store=demo`)
  },
)
