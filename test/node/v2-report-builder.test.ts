// The report builder on the playground's new report: each change to a choice asks the result address
// and puts the answer in place, a later change winning over an earlier answer, a failed answer
// keeping the rows it had.
import type { Page, Request } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(width = 1440) {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  const asked: string[] = []
  opened.page.on('request', (request: Request) => {
    if (request.url().includes('/dev/reports/result')) asked.push(new URL(request.url()).search.slice(1))
  })
  await opened.page.goto(`${pages.ui}/playground/reports/new`)
  await opened.page.locator('e-select[name="groupBy"] select').waitFor()
  return { ...opened, asked }
}

const pick = (page: Page, name: string, value: string) =>
  page.locator(`e-select[name="${name}"] select`).selectOption(value)

// Ticks a filter's values as Add filter's Done does, by the boxes the form posts.
const filter = (page: Page, name: string, values: string[]) =>
  page.evaluate(
    ([field, ticked]) => {
      const boxes = [...document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${field}"]`)]
      for (const box of boxes) box.checked = ticked.includes(box.value)
      boxes[0]?.dispatchEvent(new Event('change', { bubbles: true }))
    },
    [name, values] as const,
  )

const rows = (page: Page) =>
  page.locator('e-report-result e-row:not([head]):not([total]) > span:first-child').allTextContents()
const total = (page: Page) => page.locator('e-report-result e-row[total] > span').allTextContents()

const facebookByDistrict = async (page: Page) => {
  await pick(page, 'groupBy', 'DISTRICT')
  await filter(page, 'channel', ['FACEBOOK', 'MESSENGER'])
}

test('net sales by district for Facebook and Messenger lists districts with a totals row of 233 orders', async () => {
  const { page, asked, errors } = await open()
  await facebookByDistrict(page)
  await expect.poll(() => total(page)).toEqual(['Total', '233', '৳4,52,562'])
  expect((await rows(page)).slice(0, 3)).toEqual(['Dhaka', 'Chattogram', 'Gazipur'])
  expect(asked.at(-1)).toBe(
    'metric=NET_SALES&groupBy=DISTRICT&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS&view=TABLE',
  )
  expect(errors).toEqual([])
})

test('pressing Chart draws the same rows as bars, each labelled, with the totals line kept, and asks with view=CHART', async () => {
  const { page, asked } = await open()
  await facebookByDistrict(page)
  await expect.poll(() => total(page)).toEqual(['Total', '233', '৳4,52,562'])
  await page.locator('e-button-group e-button[value="TABLE"]').click()
  await page.locator('e-button-group e-button[value="CHART"]').click()
  const bars = page.locator('e-report-result e-chart > e-chart-bar')
  await expect.poll(() => bars.count()).toBe(12)
  expect(await page.locator('e-report-result e-chart > e-chart-bar[tick]').count()).toBe(12)
  expect(await bars.first().getAttribute('label')).toBe('Dhaka')
  expect(await page.locator('e-report-result [data-part="total"]').textContent()).toBe('Total: 233 orders, ৳4,52,562')
  expect(asked.at(-1)).toBe(
    'metric=NET_SALES&groupBy=DISTRICT&channel=FACEBOOK&channel=MESSENGER&range=LAST_30_DAYS&view=CHART',
  )
  expect(await page.locator('input[name="view"]').inputValue()).toBe('CHART')
})

test('typing the name asks nothing', async () => {
  const { page, asked } = await open()
  await page.locator('e-text-field[name="name"] input').fill('Facebook by district')
  await page.locator('e-text-field[name="name"] input').press('Tab')
  await page.waitForTimeout(200)
  expect(asked).toEqual([])
})

test('a later change wins over an earlier answer held until after it, and the old rows stay under a loading bar', async () => {
  const { page } = await open()
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/dev/reports/result?*groupBy=CHANNEL*', async (route) => {
    await held
    await route.continue()
  })
  await pick(page, 'groupBy', 'CHANNEL')
  await page.waitForTimeout(50)
  await pick(page, 'groupBy', 'DISTRICT')
  await expect.poll(() => rows(page).then((names) => names[0])).toBe('Dhaka')
  release()
  await page.waitForTimeout(300)
  expect((await rows(page))[0]).toBe('Dhaka')
  expect(await page.locator('e-report-builder [data-part="loading"]').count()).toBe(0)

  // A held answer leaves the rows it replaces in place, under the loading bar.
  let releaseAgain = () => {}
  const heldAgain = new Promise<void>((resolve) => (releaseAgain = resolve))
  await page.route('**/dev/reports/result?*groupBy=PAYMENT_METHOD*', async (route) => {
    await heldAgain
    await route.continue()
  })
  await pick(page, 'groupBy', 'PAYMENT_METHOD')
  const loading = page.locator('e-report-builder [data-part="loading"]')
  await expect.poll(() => loading.isVisible()).toBe(true)
  expect(await loading.getAttribute('role')).toBe('progressbar')
  expect((await rows(page))[0]).toBe('Dhaka')
  releaseAgain()
  await expect.poll(() => rows(page).then((names) => names[0])).toBe('Cash on delivery')
})

test("an answer of 500 keeps the rows and says the report couldn't load, and Try again asks once more", async () => {
  const { page, asked } = await open()
  await pick(page, 'groupBy', 'DISTRICT')
  await expect.poll(() => rows(page).then((names) => names[0])).toBe('Dhaka')
  await page.route('**/dev/reports/result?*', (route) => route.fulfill({ status: 500, body: 'Down' }))
  await pick(page, 'metric', 'ORDERS')
  const failed = page.locator('e-report-builder e-banner[tone="critical"]')
  await expect.poll(() => failed.isVisible()).toBe(true)
  expect(await failed.locator('p').textContent()).toBe("The report couldn't load")
  expect((await rows(page))[0]).toBe('Dhaka')
  expect(await total(page)).toEqual(['Total', '474', '৳9,87,156'])
  await page.unroute('**/dev/reports/result?*')
  const before = asked.length
  await failed.getByRole('button', { name: 'Try again' }).click()
  await expect.poll(() => total(page)).toEqual(['Total', '474'])
  expect(asked.length).toBe(before + 1)
  expect(await failed.count()).toBe(0)
})

// Each bar label's box as drawn, read through the DevTools protocol, which reaches ::before.
async function labelBoxes(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
  interface Node {
    nodeId: number
    localName?: string
    pseudoType?: string
    children?: Node[]
    pseudoElements?: Node[]
  }
  const labels: [number, number][] = []
  const walk = (node: Node) => {
    if (node.localName === 'e-chart-bar') {
      const before = node.pseudoElements?.find((one) => one.pseudoType === 'before')
      if (before) labels.push([node.nodeId, before.nodeId])
    }
    for (const child of node.children ?? []) walk(child)
  }
  walk(root as Node)
  const boxOf = async (nodeId: number) => {
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId })
    const xs = model.border.filter((_, at) => at % 2 === 0)
    const ys = model.border.filter((_, at) => at % 2 === 1)
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }
  const boxes = []
  for (const [bar, label] of labels) boxes.push({ ...(await boxOf(label)), bar: await boxOf(bar) })
  await cdp.detach()
  return boxes
}

const groups = [
  ['DAY', 'LAST_7_DAYS'],
  ['CHANNEL', 'LAST_30_DAYS'],
  ['DISTRICT', 'LAST_30_DAYS'],
  ['PAYMENT_METHOD', 'LAST_30_DAYS'],
  ['PRODUCT', 'LAST_30_DAYS'],
  ['COURIER', 'LAST_30_DAYS'],
] as const

for (const width of [1440, 360]) {
  for (const lang of ['en', 'bn']) {
    test(`at ${width} px in ${lang} every chart's bar labels show whole, apart and inside the chart`, async () => {
      const { page } = await open(width)
      if (lang === 'bn') {
        await page.evaluate(() => localStorage.setItem('ebdfy-playground-lang', 'bn'))
        await page.reload()
      }
      await page.locator('e-button-group e-button[value="CHART"]').click()
      for (const [group, range] of groups) {
        const answered = page.waitForResponse(
          (answer) => answer.url().includes(`groupBy=${group}&`) && answer.url().includes(`range=${range}&`),
        )
        await pick(page, 'range', range)
        await pick(page, 'groupBy', group)
        await answered
        await expect.poll(() => page.locator('e-report-builder [data-part="loading"]').count()).toBe(0)
        await page.locator('e-report-result').scrollIntoViewIfNeeded()
        const chart = await page.locator('e-report-result e-chart').boundingBox()
        const ticked = await page.locator('e-report-result e-chart-bar[tick]').count()
        const boxes = await labelBoxes(page)
        expect(boxes.length, group).toBe(ticked)
        for (const [at, box] of boxes.entries()) {
          expect(box.left, `${group} ${at}`).toBeGreaterThanOrEqual((chart?.x ?? 0) - 0.5)
          expect(box.right, `${group} ${at}`).toBeLessThanOrEqual((chart?.x ?? 0) + (chart?.width ?? 0) + 0.5)
          expect(box.bottom, `${group} ${at}`).toBeLessThanOrEqual((chart?.y ?? 0) + (chart?.height ?? 0) + 0.5)
          // Under the axis, and under its own bar.
          expect(box.top, `${group} ${at}`).toBeGreaterThanOrEqual(box.bar.bottom)
          expect((box.left + box.right) / 2, `${group} ${at}`).toBeCloseTo((box.bar.left + box.bar.right) / 2, 0)
        }
        // Each label against the next: no two overlap.
        const overlaps = boxes
          .slice(1)
          .map((next, at) => Math.min(boxes[at]?.right ?? 0, next.right) - Math.max(boxes[at]?.left ?? 0, next.left))
        expect(Math.max(0, ...overlaps), group).toBeLessThanOrEqual(0.5)
      }
    })
  }
}
