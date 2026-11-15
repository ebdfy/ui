// The sample app's v2 orders list as an index table: view tabs with counts, search, a removable date
// chip, Add filter, the sort and the pager narrow its 120 orders, in English and in Bangla, and the
// day's numbers sit above it.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(width = 1280, query = '', touch = false) {
  const opened = await pages.open(`${pages.sampleApp}/orders${query}`, width, touch ? { hasTouch: true } : {})
  // The list is the page's once v2.js has built the search field's input.
  await opened.page.getByRole('searchbox').waitFor()
  return opened
}

const rows = (page: Page) => page.locator('e-table > e-row:not([head])')
const numbers = (page: Page) => rows(page).locator('a').allTextContents()
const statuses = (page: Page) => rows(page).locator('e-badge').allTextContents()
const pager = (page: Page) => page.locator('e-pagination').getAttribute('label')

test('the tab New shows the count 12 and, chosen, lists only new orders, ten to a page', async () => {
  const { page, errors } = await open()
  const tab = page.getByRole('tab', { name: 'New 12' })
  await tab.click()
  expect(await tab.getAttribute('aria-selected')).toBe('true')
  expect(await statuses(page)).toEqual(Array(10).fill('New'))
  expect(await pager(page)).toBe('1–10 of 12')
  await page.getByRole('button', { name: 'Next page' }).click()
  expect(await statuses(page)).toEqual(['New', 'New'])
  expect(await pager(page)).toBe('11–12 of 12')
  expect(await page.getByRole('button', { name: 'Next page' }).isDisabled()).toBe(true)
  await page.getByRole('tab', { name: 'All 120' }).click()
  expect(await numbers(page)).toEqual([
    '#1042',
    '#1041',
    '#1040',
    '#1039',
    '#1038',
    '#1037',
    '#1036',
    '#1035',
    '#1034',
    '#1033',
  ])
  expect(await pager(page)).toBe('1–10 of 120')
  expect(errors).toEqual([])
})

test('each tab lists only its own status', async () => {
  const { page } = await open()
  for (const [name, status] of [
    ['Confirmed 18', 'Confirmed'],
    ['With courier 54', 'With courier'],
    ['Delivered 30', 'Delivered'],
    ['Returned 6', 'Returned'],
  ] as const) {
    await page.getByRole('tab', { name }).click()
    const shown = await statuses(page)
    expect(shown.length).toBe(Math.min(10, Number(name.split(' ').pop())))
    expect(new Set(shown)).toEqual(new Set([status]))
  }
})

test('typing Rahima in the search leaves one row, #1042', async () => {
  const { page } = await open()
  await page.getByRole('searchbox', { name: 'Search orders' }).pressSequentially('Rahima')
  expect(await numbers(page)).toEqual(['#1042'])
  expect(await pager(page)).toBe('1–1 of 1')
})

test('an order number finds its order, written in Bangla digits too', async () => {
  const { page } = await open()
  await page.getByRole('searchbox').fill('#1037')
  expect(await numbers(page)).toEqual(['#1037'])
  await page.getByRole('searchbox').fill('১০৩৯')
  expect(await numbers(page)).toEqual(['#1039'])
})

test('removing the chip Date: Last 30 days fires e-filter-remove naming date', async () => {
  const { page } = await open()
  await page.evaluate(() => {
    const w = window as unknown as { removed: unknown[] }
    w.removed = []
    document.addEventListener('e-filter-remove', (event) => w.removed.push((event as CustomEvent).detail))
  })
  await page.getByRole('button', { name: 'Remove Date: Last 30 days' }).click()
  expect(await page.evaluate(() => (window as unknown as { removed: unknown[] }).removed)).toEqual([{ name: 'date' }])
  expect(await page.locator('[slot="filter"]').count()).toBe(0)
  // Every order is from the last 30 days, so the list stays as it was.
  expect(await pager(page)).toBe('1–10 of 120')
})

test('the Add filter button adds the payment filter, which keeps cash on delivery, and rests once all are in use', async () => {
  const { page } = await open()
  const add = page.getByRole('button', { name: 'Add filter' })
  await add.click()
  expect(await page.locator('[slot="filter"]').allTextContents()).toEqual([
    'Date: Last 30 days',
    'Payment: Cash on delivery',
  ])
  expect(await add.isDisabled()).toBe(true)
  const payments = await rows(page).locator('> :nth-child(6)').allTextContents()
  expect(new Set(payments)).toEqual(new Set(['Cash on delivery']))
  await page.getByRole('button', { name: 'Remove Payment: Cash on delivery' }).click()
  expect(await add.isDisabled()).toBe(false)
  expect(await pager(page)).toBe('1–10 of 120')
})

test('choosing Oldest first starts at #923, and the last page lists #1033 before #1042', async () => {
  const { page } = await open()
  await page.getByRole('combobox', { name: 'Sort' }).selectOption({ label: 'Oldest first' })
  expect((await numbers(page))[0]).toBe('#923')
  for (let turn = 0; turn < 11; turn++) await page.getByRole('button', { name: 'Next page' }).click()
  expect(await pager(page)).toBe('111–120 of 120')
  const last = await numbers(page)
  expect(last[0]).toBe('#1033')
  expect(last.at(-1)).toBe('#1042')
  expect(last.indexOf('#1033')).toBeLessThan(last.indexOf('#1042'))
})

test('in Bangla the tab count reads ১২ and #1033’s total reads ৳১,১২,৪০০', async () => {
  const { page } = await open(1280, '?lang=bn')
  await expect.poll(() => page.getByRole('tab', { name: 'নতুন ১২' }).count()).toBe(1)
  const row = rows(page).filter({ has: page.getByRole('link', { name: '#1033', exact: true }) })
  expect(await row.locator('> :last-child').textContent()).toBe('৳১,১২,৪০০')
  // The rows the list draws read Bangla too, the order number kept in Latin digits.
  await page.getByRole('tab', { name: 'নতুন ১২' }).click()
  expect(await pager(page)).toBe('১–১০, মোট ১২')
  expect(new Set(await statuses(page))).toEqual(new Set(['নতুন']))
  expect((await numbers(page))[0]).toBe('#1042')
})

test('a list drawn in English turns Bangla when the page switches, rows and pager too', async () => {
  const { page } = await open()
  await page.getByRole('tab', { name: 'New 12' }).click()
  await page.evaluate(() => (window as unknown as { speak: (lang: string) => void }).speak('bn'))
  expect(new Set(await statuses(page))).toEqual(new Set(['নতুন']))
  expect(await pager(page)).toBe('১–১০, মোট ১২')
  expect(await page.getByRole('button', { name: 'পরের পাতা' }).count()).toBe(1)
})

test('the metrics read Orders today 38 +12%, To confirm 12, With courier 54 and Return rate, 7 days 2.1%', async () => {
  const { page } = await open()
  const metrics = page.locator('e-metrics > *')
  expect((await metrics.allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim())).toEqual([
    'Orders today 38 +12%',
    'To confirm 12',
    'With courier 54',
    'Return rate, 7 days 2.1%',
  ])
  const tops = await metrics.evaluateAll((all) => all.map((one) => Math.round(one.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
})

test('at 360 px the four metrics sit in two rows of two, and in Bangla the first reads ৩৮ and +১২%', async () => {
  const { page } = await open(360, '?lang=bn')
  const metrics = page.locator('e-metrics > *')
  const boxes = await metrics.evaluateAll((all) =>
    all.map((one) => {
      const { top, left } = one.getBoundingClientRect()
      return { top: Math.round(top), left: Math.round(left) }
    }),
  )
  expect(boxes[0]!.top).toBe(boxes[1]!.top)
  expect(boxes[2]!.top).toBe(boxes[3]!.top)
  expect(boxes[2]!.top).toBeGreaterThan(boxes[0]!.top)
  expect([boxes[0]!.left, boxes[1]!.left]).toEqual([boxes[2]!.left, boxes[3]!.left])
  const first = metrics.first()
  expect(await first.locator('strong').textContent()).toBe('৩৮')
  expect(await first.locator('[slot="change"]').textContent()).toBe('+১২%')
})

test('ticking #1042 and #1041 shows "2 selected" with Confirm, Book courier and Print labels where the search was', async () => {
  const { page, errors } = await open()
  const search = await page.getByRole('searchbox').boundingBox()
  await page.getByRole('checkbox', { name: 'Select #1042' }).click()
  await page.getByRole('checkbox', { name: 'Select #1041' }).click()
  await expect.poll(() => page.getByRole('status').textContent()).toBe('2 selected')
  expect(await page.getByRole('searchbox').isVisible()).toBe(false)
  const bar = await page.locator('[slot="bulk"]').boundingBox()
  expect(Math.abs(bar!.y - search!.y)).toBeLessThanOrEqual(1)
  for (const name of ['Confirm', 'Book courier', 'Print labels'])
    expect(await page.getByRole('button', { name, exact: true }).isVisible()).toBe(true)
  // Two of the ten rows: the head checkbox reads mixed.
  expect(await page.getByRole('checkbox', { name: 'Select all shown orders' }).getAttribute('aria-checked')).toBe(
    'mixed',
  )
  expect(await rows(page).count()).toBe(10)
  expect(errors).toEqual([])
})

test('unticking both brings back the search field', async () => {
  const { page } = await open()
  for (const name of ['Select #1042', 'Select #1041']) await page.getByRole('checkbox', { name }).click()
  for (const name of ['Select #1042', 'Select #1041']) await page.getByRole('checkbox', { name }).click()
  expect(await page.getByRole('searchbox').isVisible()).toBe(true)
  expect(await page.locator('[slot="bulk"]').isVisible()).toBe(false)
  expect(await page.getByRole('checkbox', { name: 'Select all shown orders' }).getAttribute('aria-checked')).toBe(null)
})

test('the Confirm action confirms the new orders among those ticked and the counts follow', async () => {
  const { page } = await open()
  for (const name of ['Select #1042', 'Select #1041']) await page.getByRole('checkbox', { name }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  // #1042 was new and #1041 already confirmed: one changes.
  const status = (number: string) =>
    rows(page)
      .filter({ has: page.getByRole('link', { name: number, exact: true }) })
      .locator('e-badge')
      .textContent()
  expect(await status('#1042')).toBe('Confirmed')
  expect(await page.getByRole('tab', { name: 'New 11' }).count()).toBe(1)
  expect(await page.getByRole('tab', { name: 'Confirmed 19' }).count()).toBe(1)
  expect(await page.locator('e-metrics [data-count="new"]').textContent()).toBe('11')
  // Drawn again, the list has nothing ticked.
  expect(await page.getByRole('searchbox').isVisible()).toBe(true)
})

test('in Bangla two ticked rows read ২টি নির্বাচিত', async () => {
  const { page } = await open(1280, '?lang=bn')
  for (const name of ['অর্ডার #1042 নির্বাচন করুন', 'অর্ডার #1041 নির্বাচন করুন'])
    await page.getByRole('checkbox', { name }).click()
  await expect.poll(() => page.getByRole('status').textContent()).toBe('২টি নির্বাচিত')
  expect(await page.getByRole('button', { name: 'কুরিয়ার বুক করুন' }).isVisible()).toBe(true)
})

test('searching zzz shows "No orders match" with Clear search, and hides the pager', async () => {
  const { page, errors } = await open()
  await page.getByRole('searchbox').fill('zzz')
  expect(await page.getByRole('heading', { name: 'No orders match' }).isVisible()).toBe(true)
  expect(await page.getByRole('button', { name: 'Clear search' }).isVisible()).toBe(true)
  expect(await rows(page).count()).toBe(0)
  expect(await page.locator('e-pagination').isVisible()).toBe(false)
  expect(await page.getByRole('button', { name: 'Next page' }).isVisible()).toBe(false)
  expect(errors).toEqual([])
})

test('the Clear search button empties the field and lists 10 rows again', async () => {
  const { page } = await open()
  const search = page.getByRole('searchbox')
  await search.fill('zzz')
  await page.getByRole('button', { name: 'Clear search' }).click()
  expect(await search.inputValue()).toBe('')
  expect(await rows(page).count()).toBe(10)
  expect(await page.locator('e-pagination').isVisible()).toBe(true)
  expect(await pager(page)).toBe('1–10 of 120')
  expect(await page.getByRole('heading', { name: 'No orders match' }).isVisible()).toBe(false)
  expect(await search.evaluate((input) => input === document.activeElement)).toBe(true)
})

test('in Bangla a search with no rows reads কোনো অর্ডার মেলেনি', async () => {
  const { page } = await open(360, '?lang=bn')
  await page.getByRole('searchbox').fill('zzz')
  expect(await page.getByRole('heading', { name: 'কোনো অর্ডার মেলেনি' }).isVisible()).toBe(true)
  await page.getByRole('button', { name: 'খোঁজা মুছুন' }).click()
  expect(await rows(page).count()).toBe(10)
})

// Where a card's parts sit, to read it as a person does: line by line, start to end.
const card = (page: Page, index = 0) =>
  rows(page)
    .nth(index)
    .evaluate((row) => {
      const at = (selector: string) => {
        const part = row.querySelector(selector)!
        const { top, left, height } = part.getBoundingClientRect()
        return { text: part.textContent, top: Math.round(top + height / 2), left: Math.round(left) }
      }
      return {
        title: at('[card="title"]'),
        status: at('[card="status"]'),
        body: at('[card="body"]'),
        end: at('[card="end"]'),
        hidden: [...row.children].filter((cell) => !cell.checkVisibility()).map((cell) => cell.textContent),
      }
    })

test('at 360 x 800 the first row reads #1042 and ৳1,930, then Rahima Akter and New', async () => {
  const { page, errors } = await open(360)
  const first = await card(page)
  expect([first.title.text, first.end.text, first.body.text, first.status.text]).toEqual([
    '#1042',
    '৳1,930',
    'Rahima Akter',
    'New',
  ])
  // The number and the total on the first line, the customer and the status on the next.
  expect(Math.abs(first.title.top - first.end.top)).toBeLessThanOrEqual(2)
  expect(first.end.left).toBeGreaterThan(first.title.left)
  expect(Math.abs(first.body.top - first.status.top)).toBeLessThanOrEqual(2)
  expect(first.body.top).toBeGreaterThan(first.title.top)
  expect(first.status.left).toBeGreaterThan(first.body.left)
  // The checkbox waits for select mode; the channel and the items stay off the row.
  expect(first.hidden).toEqual(['', 'Facebook', '2 items'])
  expect(await page.locator('e-row[head]').isVisible()).toBe(false)
  expect(errors).toEqual([])
})

test('at 360 px after Select every row and its checkbox is a target at least 44 px tall', async () => {
  const { page } = await open(360)
  await page.getByRole('button', { name: 'Select', exact: true }).click()
  const sizes = await rows(page).evaluateAll((all) =>
    all.map((row) => {
      const box = row.querySelector('e-checkbox')!.getBoundingClientRect()
      return { card: row.getBoundingClientRect().height, width: box.width, height: box.height }
    }),
  )
  expect(sizes.length).toBe(10)
  for (const size of sizes) {
    expect(size.card).toBeGreaterThanOrEqual(44)
    expect(Math.min(size.width, size.height)).toBeGreaterThanOrEqual(44)
  }
})

test.for([
  [599, 'cards'],
  [600, 'table rows'],
] as const)('at %i px the orders are %s', async ([width, drawn]) => {
  const { page } = await open(width)
  const display = await rows(page)
    .first()
    .evaluate((row) => getComputedStyle(row).display)
  expect(display).toBe(drawn === 'cards' ? 'grid' : 'contents')
  expect(await page.locator('e-row[head]').isVisible()).toBe(drawn === 'table rows')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
})

test('at 360 px tapping a card, away from its number, opens that order', async () => {
  const { page } = await open(360)
  // Beside the total, on the customer's line: the link's cover, not the number, takes the tap.
  const box = (await rows(page).first().boundingBox())!
  await rows(page)
    .first()
    .click({ position: { x: box.width / 2, y: box.height - 14 } })
  await page.waitForURL(/\/orders\/1042$/)
  await expect.poll(() => page.locator('e-page').getAttribute('heading')).toBe('Order #1042')
})

test.for([
  ['New 12', 'New'],
  ['Confirmed 18', 'Confirmed'],
  ['With courier 54', 'With courier'],
  ['Delivered 30', 'Delivered'],
  ['Returned 6', 'Returned'],
] as const)('at 360 px the first card under %s opens its own order, %s', async ([tab, status]) => {
  const { page } = await open(360)
  await page.getByRole('tab', { name: tab }).click()
  const first = rows(page).first()
  const number = await first.locator('a').textContent()
  expect(await first.locator('e-badge').textContent()).toBe(status)
  const box = (await first.boundingBox())!
  await first.click({ position: { x: box.width - 30, y: box.height / 2 } })
  await page.waitForURL(new RegExp(`/orders/${number!.slice(1)}$`))
  await expect.poll(() => page.locator('e-page').getAttribute('heading')).toBe(`Order ${number}`)
  expect(await page.locator('e-page > [slot="status"] e-badge').first().textContent()).toBe(status)
})

test('at 360 px a person taps Select, ticks two rows by their checkboxes and the bulk actions show', async () => {
  const { page } = await open(360, '', true)
  await page.getByRole('button', { name: 'Select', exact: true }).tap()
  await page.getByRole('checkbox', { name: 'Select #1042' }).tap()
  await page.getByRole('checkbox', { name: 'Select #1041' }).tap()
  await expect.poll(() => page.getByRole('status').textContent()).toBe('2 selected')
  for (const name of ['Confirm', 'Book courier', 'Print labels'])
    expect(await page.getByRole('button', { name, exact: true }).isVisible()).toBe(true)
  // Ticking stays on the list: no card opened its order.
  expect(page.url()).toMatch(/\/orders$/)
  expect(await page.locator('e-row[selected]').count()).toBe(2)
})

test('a view left empty by a bulk action says No orders here, offers no Clear search, and keeps focus', async () => {
  const { page } = await open()
  await page.evaluate(() => {
    const w = window as unknown as { toasts: string[]; ebdfy: { toast: (message: string) => void } }
    w.toasts = []
    w.ebdfy.toast = (message) => w.toasts.push(message)
  })
  await page.getByRole('tab', { name: 'New 12' }).click()
  await page.getByRole('checkbox', { name: 'Select all shown orders' }).click()
  await page.getByRole('button', { name: 'Book courier', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Select all shown orders' }).click()
  await page.getByRole('button', { name: 'Book courier', exact: true }).click()
  expect(await page.getByRole('heading', { name: 'No orders here' }).isVisible()).toBe(true)
  expect(await page.getByRole('button', { name: 'Clear search' }).isVisible()).toBe(false)
  expect(await page.getByRole('searchbox').evaluate((input) => input === document.activeElement)).toBe(true)
  // A Confirm that changes nothing says why, rather than counting none.
  await page.getByRole('tab', { name: 'With courier 66' }).click()
  await page.getByRole('checkbox', { name: 'Select all shown orders' }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { toasts: string[] }).toasts)).toEqual([
    'Courier booked for 10 orders',
    'Courier booked for 2 orders',
    'None of these orders is new',
  ])
})

test('a search that matches nothing still says No orders match after a view went empty', async () => {
  const { page } = await open()
  await page.getByRole('searchbox').fill('zzz')
  expect(await page.getByRole('heading', { name: 'No orders match' }).isVisible()).toBe(true)
  await page.getByRole('searchbox').fill('')
  await page.getByRole('searchbox').fill('qqq')
  expect(await page.getByRole('button', { name: 'Clear search' }).isVisible()).toBe(true)
})
