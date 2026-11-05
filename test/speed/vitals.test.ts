// Web Vitals: LCP, CLS and INP for a tap, as a mid Android phone on slow 4G sees v2: a 360 x 780
// screen, the CPU four times slower, a 150 ms round trip, 1.6 Mbps down and 750 Kbps up.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, type Browser, type BrowserContext, type Frame, type Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { budgets, over, report, type Line } from './budgets.ts'
import { startSite } from './site.ts'

const webVitalsBuild = join(import.meta.dirname, '../../node_modules/web-vitals/dist/web-vitals.iife.js')
const roundTrip = 150

let site: Awaited<ReturnType<typeof startSite>>
let browser: Browser
let unthrottledWork: number

interface Vitals {
  lcp?: number
  cls?: number
  inp?: number
}

// A fixed piece of work, timed in the page, to tell a throttled CPU from a free one. Chromium throttles
// by pausing the page's thread now and then, so the work runs long enough to span many pauses.
const work = () => {
  const start = performance.now()
  let sum = 0
  for (let i = 0; i < 3e7; i++) sum += i % 7
  return sum >= 0 ? performance.now() - start : 0
}

beforeAll(async () => {
  site = await startSite()
  browser = await chromium.launch()
  const page = await browser.newPage()
  // A busy machine only adds time, so the fastest of three runs is the free CPU's time.
  unthrottledWork = Math.min(await page.evaluate(work), await page.evaluate(work), await page.evaluate(work))
  await page.close()
}, 180_000)

afterAll(async () => {
  await browser?.close()
  await site?.close()
})

async function phone(lang?: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 }, hasTouch: true })
  if (lang)
    await context.addInitScript((chosen) => {
      // The Admin's language, which the app follows, and the app's own for its first paint.
      localStorage.setItem('ebdfy-playground-lang', chosen)
      localStorage.setItem('ebdfy-sample-lang', chosen)
    }, lang)
  // Every frame gets web-vitals before any of its own scripts, and keeps the latest value of each metric.
  // Playwright runs each init script in a scope of its own, so the build's `var webVitals` is made global.
  await context.addInitScript({ content: `${readFileSync(webVitalsBuild, 'utf8')}\nglobalThis.webVitals = webVitals` })
  await context.addInitScript(() => {
    const seen: Vitals = {}
    Object.assign(globalThis, { ebdfyVitals: seen })
    const { onLCP, onCLS, onINP } = (globalThis as unknown as { webVitals: typeof import('web-vitals') }).webVitals
    onLCP(({ value }) => (seen.lcp = value), { reportAllChanges: true })
    onCLS(({ value }) => (seen.cls = value), { reportAllChanges: true })
    // The web-vitals README: events faster than durationThreshold (default 40 ms) are not reported,
    // only the first-input entry is. 16 ms, the Event Timing floor, counts every event of the tap.
    onINP(({ value }) => (seen.inp = value), { reportAllChanges: true, durationThreshold: 16 })
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: roundTrip,
    downloadThroughput: 1.6e6 / 8,
    uploadThroughput: 750e3 / 8,
  })
  return { context, page }
}

// Load, network idle and a second more, so LCP and CLS have settled before the first input ends LCP.
async function settle(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
}

const vitals = (frame: Frame) =>
  frame.evaluate(() => ({ ...(globalThis as unknown as { ebdfyVitals: Vitals }).ebdfyVitals }))

// The throttling is real in this frame: its document took at least the round trip, and the fixed
// work took at least twice as long as it does unthrottled.
async function expectThrottled(frame: Frame) {
  const fetched = await frame.evaluate(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    return navigation ? navigation.responseEnd - navigation.requestStart : 0
  })
  const worked = await frame.evaluate(work)
  console.log(
    `throttled ${frame.url()}: document ${Math.round(fetched)} ms, work ${Math.round(worked)} ms against ${Math.round(unthrottledWork)} ms free`,
  )
  expect(fetched).toBeGreaterThanOrEqual(roundTrip)
  expect(worked).toBeGreaterThanOrEqual(2 * unthrottledWork)
}

function lines(where: string, { lcp, cls, inp }: Vitals): Line[] {
  const measured: Line[] = [
    { what: `LCP, ${where}`, value: lcp ?? Number.NaN, budget: budgets.lcp, unit: 'ms' },
    { what: `CLS, ${where}`, value: cls ?? Number.NaN, budget: budgets.cls, unit: '' },
  ]
  if (inp !== undefined) measured.push({ what: `INP, ${where}`, value: inp, budget: budgets.inp, unit: 'ms' })
  return measured
}

async function buttonPage(where: string, slowSave: boolean): Promise<Line[]> {
  const { context, page } = await phone()
  await settle(page, `${site.ui}/components/button`)
  await expectThrottled(page.mainFrame())
  const before = await vitals(page.mainFrame())
  const save = page.getByRole('button', { name: 'Save' }).first()
  if (slowSave) {
    await save.evaluate((button) =>
      button.addEventListener('click', () => {
        const end = performance.now() + 300
        while (performance.now() < end);
      }),
    )
  }
  await save.tap()
  await page.waitForTimeout(1000)
  const after = await vitals(page.mainFrame())
  await context.close()
  expect(after.inp).toBeDefined()
  return lines(where, { lcp: before.lcp, cls: after.cls, inp: after.inp })
}

test('the Button page is within its LCP, CLS and INP budgets', async () => {
  const measured = await buttonPage('button page', false)
  console.log(report(measured))
  expect(measured.every(({ value }) => Number.isFinite(value))).toBe(true)
  expect(over(measured)).toEqual([])
})

test('a 300 ms Save handler puts the Button page over its INP budget', async () => {
  const measured = await buttonPage('button page, slowed Save', true)
  console.log(report(measured))
  expect(over(measured).map(({ what }) => what)).toEqual(['INP, button page, slowed Save'])
})

test.for(['en', 'bn'])('the playground orders list in %s is within its LCP, CLS and INP budgets', async (lang) => {
  const { context, page } = await phone(lang)
  await settle(page, `${site.ui}/playground`)
  const app = page.frames().find((frame) => frame.url().startsWith(site.sampleApp))
  expect(app).toBeDefined()
  if (!app) return
  await expectThrottled(page.mainFrame())
  await expectThrottled(app)
  const playground = await vitals(page.mainFrame())
  const before = await vitals(app)
  // The tap a merchant makes: Save in the app, which asks the Admin for its toast.
  await page
    .frameLocator('e-admin-panel iframe')
    .getByRole('button', { name: lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save' })
    .tap()
  await page.waitForTimeout(1000)
  const after = await vitals(app)
  await context.close()
  expect(after.inp).toBeDefined()
  const measured = [
    ...lines(`playground, ${lang}`, playground),
    ...lines(`orders app, ${lang}`, { lcp: before.lcp, cls: after.cls, inp: after.inp }),
  ]
  console.log(report(measured))
  expect(measured.every(({ value }) => Number.isFinite(value))).toBe(true)
  expect(over(measured)).toEqual([])
})
