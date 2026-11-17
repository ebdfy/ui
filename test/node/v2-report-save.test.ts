// A report saves with the Admin's bar: a new one shows it before any change, an edited one says
// Unsaved report, Discard puts back the choices and the result drawn from them, and a phone puts
// Build it first.
import type { Page, Request } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, width = 1440, lang = 'en') {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((language) => localStorage.setItem('ebdfy-playground-lang', language), lang)
  const asked: string[] = []
  opened.page.on('request', (request: Request) => {
    if (request.url().includes('/dev/reports/result')) asked.push(new URL(request.url()).search.slice(1))
  })
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-select[name="metric"] select').waitFor()
  return { ...opened, asked }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const total = (page: Page) => page.locator('e-report-result e-row[total] > span').allTextContents()

test('a new report shows "Not saved yet" with "Save report" before any change', async () => {
  const { page } = await open('/playground/reports/new')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await said(page)).toBe('Not saved yet')
  expect(await bar(page).getByRole('button').allTextContents()).toEqual(['Discard', 'Save report'])
})

test('on report 7 a change of metric shows "Unsaved report"; Discard puts Net sales back and redraws its rows', async () => {
  const { page, asked } = await open('/playground/reports/7')
  await page.waitForTimeout(300)
  expect(await bar(page).isVisible()).toBe(false)
  await page.locator('e-select[name="metric"] select').selectOption('ORDERS')
  await expect.poll(() => said(page)).toBe('Unsaved report')
  await expect.poll(() => total(page)).toEqual(['Total', '233'])
  // A removed chip comes back with Discard too.
  await page.locator('e-report-filter[name="channel"] > [data-part="remove"]').click()
  await expect.poll(() => total(page)).toEqual(['Total', '474'])
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect(await page.locator('e-select[name="metric"] select').inputValue()).toBe('NET_SALES')
  await expect.poll(() => total(page)).toEqual(['Total', '233', '৳4,52,562'])
  expect(asked.at(-1)).toBe(
    'metric=NET_SALES&groupBy=DISTRICT&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS&view=TABLE',
  )
  expect(await page.locator('e-report-filter[name="channel"]').isVisible()).toBe(true)
  expect(await page.locator('e-report-filter[name="channel"] > [data-part="edit"]').getAttribute('aria-label')).toBe(
    'Channel is Facebook, Messenger. Change the Channel filter',
  )
  // The bar slides away.
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('pressing Discard puts back Chart or Table with the view field', async () => {
  const { page } = await open('/playground/reports/7')
  await page.locator('e-button-group e-button[value="CHART"]').click()
  await expect.poll(() => page.locator('e-report-result e-chart').count()).toBe(1)
  await expect.poll(() => said(page)).toBe('Unsaved report')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => page.locator('e-report-result e-table').count()).toBe(1)
  expect(await page.locator('e-button-group e-button[value="TABLE"]').getAttribute('pressed')).toBe('')
  expect(await page.locator('e-button-group e-button[value="CHART"] > button').getAttribute('aria-pressed')).toBe(
    'false',
  )
})

test('at 360 px an edited report reads the short "Not saved yet"', async () => {
  const { page } = await open('/playground/reports/7', 360)
  await page.locator('e-select[name="metric"] select').selectOption('ORDERS')
  await expect.poll(() => said(page)).toBe('Not saved yet')
})

test('pressing Save with an empty name is refused under Name; with "Facebook by district" the toast reads "Report saved"', async () => {
  const { page } = await open('/playground/reports/new')
  await bar(page).getByRole('button', { name: 'Save report' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  expect(await page.locator('e-text-field[name="name"] [data-e-error]').isVisible()).toBe(true)
  await page.locator('e-text-field[name="name"] input').fill('Facebook by district')
  await page.locator('e-select[name="groupBy"] select').selectOption('DISTRICT')
  await bar(page).getByRole('button', { name: 'Save report' }).click()
  await expect.poll(() => page.locator('e-admin-panel > .e-toast').textContent()).toBe('Report saved')
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Facebook by district')
  expect(await page.locator('e-select[name="groupBy"] select').inputValue()).toBe('DISTRICT')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test("the name's maxlength of 60 reaches its input, so a name of 61 letters is cut to 60 as typed", async () => {
  const { page } = await open('/playground/reports/new')
  const name = page.locator('e-text-field[name="name"] input')
  expect(await name.getAttribute('maxlength')).toBe('60')
  await name.pressSequentially('a'.repeat(61))
  expect(await name.inputValue()).toBe('a'.repeat(60))
})

for (const lang of ['en', 'bn']) {
  test(`at 360 px in ${lang} Build it comes before the result, and nothing is wider than the screen`, async () => {
    const { page } = await open('/playground/reports/new', 360, lang)
    const build = await page.locator('[data-part="build"]').boundingBox()
    const result = await page.locator('[data-part="result"]').boundingBox()
    expect(build?.y).toBeLessThan(result?.y ?? 0)
    const wide = await page.evaluate(() =>
      [...document.querySelectorAll('e-report-builder *')]
        .filter((element) => element.getBoundingClientRect().right > innerWidth)
        .map((element) => element.localName),
    )
    expect(wide).toEqual([])
    // An e-button is the target its border draws, around its native button.
    const targets = page.locator(
      'e-report-builder select, e-report-builder input:not([type="hidden"]):not([hidden]), e-report-builder e-button, e-report-builder button:not(e-button > button)',
    )
    for (const control of await targets.all()) {
      if (!(await control.isVisible())) continue
      expect(Math.round((await control.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
    }
    // The bar's Discard and Save are targets of the same size.
    await expect.poll(() => bar(page).isVisible()).toBe(true)
    const buttons = await bar(page).getByRole('button').all()
    expect(buttons.length).toBe(2)
    // A layout height reads as 43.999999 on some machines, so it is rounded as the other tests do.
    for (const button of buttons) expect(Math.round((await button.boundingBox())!.height)).toBeGreaterThanOrEqual(44)
  })
}
