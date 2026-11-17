// The playground's report pages: a new report and report 7, Admin pages drawn in the panel under
// Reports, whose result address and save the dev server answers as the Admin's Worker will.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// Every mark the menu and the tab bar carry, as [where, name, mark].
const marks = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[slot="menu"] a[aria-current], [slot="tabs"] a[aria-current]')].map((link) => [
      link.closest('[slot]')?.getAttribute('slot'),
      link.textContent,
      link.getAttribute('aria-current'),
    ]),
  )

// Reports is the area, in the menu and in More's sheet.
const underReports = [
  ['menu', 'Reports', 'true'],
  ['tabs', 'Reports', 'true'],
]

const cells = (page: Page, row: string) =>
  page.locator(`e-report-result e-row${row}`).first().locator('span').allTextContents()

test('/playground/reports/new is drawn in the panel under Reports, its name empty and its result in place', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground/reports/new`, 1440)
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('New report')
  expect(await page.locator('e-admin-panel > iframe').count()).toBe(0)
  expect(await marks(page)).toEqual(underReports)
  expect(await page.locator('e-text-field[name="name"] input').inputValue()).toBe('')
  // The last 30 days of every channel, a day a row: the Reports page's 474 orders and ৳9,87,156.
  expect(await page.locator('e-report-result e-row:not([head]):not([total])').count()).toBe(30)
  expect(await cells(page, '[total]')).toEqual(['Total', '474', '৳9,87,156'])
  expect(errors).toEqual([])
})

test('report 7 shows what it saved: its name, its choices and their result', async () => {
  const { page } = await pages.open(`${pages.ui}/playground/reports/7`, 1440)
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Facebook by district')
  expect(await page.locator('e-text-field[name="name"] input').inputValue()).toBe('Facebook by district')
  expect(await page.locator('e-select[name="groupBy"] select').inputValue()).toBe('DISTRICT')
  expect(
    await page
      .locator('input[name="channel"]:checked')
      .evaluateAll((ticks) => ticks.map((tick) => (tick as HTMLInputElement).value)),
  ).toEqual(['FACEBOOK', 'MESSENGER'])
  expect(await page.locator('form[data-save-bar]').getAttribute('data-save-new')).toBeNull()
  expect(await cells(page, ':not([head])')).toEqual(['Dhaka', '93', '৳1,81,025'])
  expect(await cells(page, '[total]')).toEqual(['Total', '233', '৳4,52,562'])
  expect(await marks(page)).toEqual(underReports)
})

test('the result address answers a table with its totals row, or a chart of the same rows', async () => {
  const query = 'metric=NET_SALES&groupBy=DISTRICT&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS'
  const { page } = await pages.open('', 1440)
  const table = await (await page.request.get(`${pages.ui}/dev/reports/result?${query}&view=TABLE`)).text()
  expect(table).toMatch(/^<e-report-result view="TABLE"><e-table/)
  expect(table).toContain('<e-row total><span data-bn="মোট">Total</span>')
  expect(table).toContain('data-bn="২৩৩">233</span>')
  const chart = await (await page.request.get(`${pages.ui}/dev/reports/result?${query}&view=CHART`)).text()
  expect(chart).toContain('total="৳4,52,562"')
  expect(chart.match(/<e-chart-bar /g)?.length).toBe(12)
  const refused = await page.request.get(`${pages.ui}/dev/reports/result?range=CUSTOM&from=2026-01-01&to=2027-01-02`)
  expect(refused.status()).toBe(400)
})

test('a save answers the saved report with its toast, and an empty name with its error', async () => {
  const { page } = await pages.open('', 1440)
  const saved = await page.request.post(`${pages.ui}/playground/reports/new`, {
    multipart: { name: 'Orders by channel', metric: 'ORDERS', groupBy: 'CHANNEL', range: 'TODAY', view: 'TABLE' },
    headers: { 'Ebdfy-Save-Bar': '1', 'Ebdfy-Panel': '1' },
  })
  expect(saved.status()).toBe(200)
  const html = await saved.text()
  expect(html).toMatch(/<e-admin-panel[^>]* toast="Report saved"/)
  expect(html).toContain('<h1>Orders by channel</h1>')
  expect(html).toContain('action="/playground/reports/7"')
  expect(html).toContain('data-save-message="Unsaved report"')
  expect(html).not.toContain('data-save-new')
  expect(html).toMatch(/<option value="ORDERS"[^>]* selected>/)
  expect(html).toContain('data-bn-label="চ্যানেলভিত্তিক অর্ডার"')
  const refused = await page.request.post(`${pages.ui}/playground/reports/new`, {
    multipart: { name: '  ', metric: 'NET_SALES' },
  })
  expect(refused.status()).toBe(422)
  expect(await refused.text()).toMatch(/<e-text-field name="name"[^>]* error="Enter a name for the report\."/)
})

test('a save keeps a name with $& as typed, refuses a range over 366 days, and answers 415 to a body no form sends', async () => {
  const { page } = await pages.open('', 1440)
  const post = (fields: { name: string; metric?: string; range: string; from?: string; to?: string }) =>
    page.request.post(`${pages.ui}/playground/reports/new`, { form: fields })
  const named = await (await post({ name: "Cost $& more $' end", metric: 'NET_SALES', range: 'TODAY' })).text()
  expect(named).toContain("<title>Cost $&amp; more $' end ·")
  expect(named.match(/<h1\b/g)?.length).toBe(1)
  expect(named).toContain("<h1>Cost $&amp; more $' end</h1>")
  expect(named).toContain('value="Cost $&amp; more $\' end"')
  const long = await post({ name: 'Long', range: 'CUSTOM', from: '2024-01-01', to: '2026-11-13' })
  expect(long.status()).toBe(422)
  expect(await long.text()).toMatch(/<e-date-field name="to"[^>]* error="Pick at most 366 days"/)
  const reversed = await post({ name: 'Back', range: 'CUSTOM', from: '2026-11-13', to: '2026-11-01' })
  expect(reversed.status()).toBe(422)
  expect(await reversed.text()).toMatch(/<e-date-field name="to"[^>]* error="Pick a day on or after From"/)
  const undated = await post({ name: 'Undated', range: 'CUSTOM' })
  expect(undated.status()).toBe(422)
  expect(await undated.text()).toMatch(/<e-date-field name="to"[^>]* error="Pick a From and a To day"/)
  // The name field takes 60 letters, so a longer name is no form's.
  const named61 = await post({ name: 'a'.repeat(61), range: 'TODAY' })
  expect(named61.status()).toBe(422)
  expect(await named61.text()).toMatch(/<e-text-field name="name"[^>]* error="Enter a name of at most 60 letters\."/)
  const json = await page.request.post(`${pages.ui}/playground/reports/new`, { data: { name: 'Json' } })
  expect(json.status()).toBe(415)
})

for (const width of [1440, 360]) {
  test(`at ${width} px a move from Reports to a report and back marks what a full load of each marks`, async () => {
    const { page } = await pages.open(`${pages.ui}/playground/reports`, width)
    const reports = await marks(page)
    for (const report of ['new', '7']) {
      await page.goto(`${pages.ui}/playground/reports/${report}`)
      const loaded = await marks(page)
      await page.goto(`${pages.ui}/playground/reports`)
      // A link to the report from the Reports page, which the saved reports list will hold.
      await page.evaluate((path) => {
        const link = document.createElement('a')
        link.href = path
        link.id = 'to-report'
        link.textContent = 'Open'
        document.querySelector('.reports-bar')?.append(link)
      }, `/playground/reports/${report}`)
      await page.locator('#to-report').click()
      await page.waitForURL(`**/playground/reports/${report}`)
      await page.waitForSelector('e-admin-panel e-report-builder')
      expect(await marks(page)).toEqual(loaded)
      await page.goBack()
      await page.waitForSelector('e-admin-panel e-arranged-cards')
      expect(await marks(page)).toEqual(reports)
    }
  })
}

test("with JavaScript off at 360 px the docs page's first builder draws its choices, its chip and its last result", async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/report-builder`)
  const demo = page.locator('figure.example .demo').first()
  const selects = await demo
    .locator('e-select')
    .evaluateAll((all) => all.map((one) => one.getBoundingClientRect().height))
  expect(selects.length).toBe(3)
  for (const height of selects) expect(height).toBeGreaterThanOrEqual(44)
  expect(
    await demo.locator('e-report-filter:visible').evaluateAll((all) => all.map((one) => one.getAttribute('name'))),
  ).toEqual(['channel'])
  expect(await demo.locator('e-report-result e-row[total] > span').allTextContents()).toEqual([
    'Total',
    '233',
    '৳4,52,562',
  ])
  expect(await demo.locator('e-report-result e-row[total]').first().locator('span').first().isVisible()).toBe(true)
  expect(await demo.locator('[data-part="custom"]').isVisible()).toBe(false)
})
