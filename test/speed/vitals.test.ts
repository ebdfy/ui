// Web Vitals: LCP, CLS and INP for a tap, as a mid Android phone on slow 4G sees v2: a 360 x 780
// screen, the CPU four times slower, a 150 ms round trip, 1.6 Mbps down and 750 Kbps up. And a move
// between two app pages on that phone: how long after the tap the next page shows, and that the
// Admin's chrome stays where it was.
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

interface Shift {
  at: number
  value: number
}

// Both clocks read as times of day, so a tap in one document is compared with what another draws.
// Every frame keeps the time of its last tap where the page it moves to can read it, and every
// layout shift it sees, a tap just before it or not.
const followMoves = () => {
  addEventListener(
    'click',
    (event) => sessionStorage.setItem('ebdfy-tap', String(performance.timeOrigin + event.timeStamp)),
    true,
  )
  const shifts: Shift[] = []
  Object.assign(globalThis, { ebdfyShifts: shifts })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      shifts.push({ at: performance.timeOrigin + entry.startTime, value: (entry as unknown as Shift).value })
  }).observe({ type: 'layout-shift', buffered: true })
}

// What a move cost once the app's new page has settled: the time from the tap to its largest paint,
// its own CLS, and every shift of the chrome since the tap.
async function moveLines(where: string, page: Page, app: Frame): Promise<Line[]> {
  await app.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
  const { tap, shown, cls } = await app.evaluate(() => {
    const seen = (globalThis as unknown as { ebdfyVitals: Vitals }).ebdfyVitals
    return {
      tap: Number(sessionStorage.getItem('ebdfy-tap')),
      shown: performance.timeOrigin + (seen.lcp ?? Number.NaN),
      cls: seen.cls,
    }
  })
  const chrome = await page.evaluate(
    (since) =>
      (globalThis as unknown as { ebdfyShifts: Shift[] }).ebdfyShifts
        .filter(({ at }) => at >= since)
        .reduce((sum, { value }) => sum + value, 0),
    tap,
  )
  await expectThrottled(app)
  return [
    { what: `tap to ${where}`, value: shown - tap, budget: budgets.move, unit: 'ms' },
    { what: `CLS, ${where}`, value: cls ?? Number.NaN, budget: budgets.cls, unit: '' },
    { what: `chrome shift, to ${where}`, value: chrome, budget: budgets.cls, unit: '' },
  ]
}

// The move a merchant makes most: from the orders list into an order, and back to the list. From
// 1040 px the app's nav sits in the Admin's menu and is drawn again as each page names its pages, so
// the wide move is the one that would show the menu shifting.
async function orderAndBack(lang: string, broken?: 'slow order' | 'moved chrome', width = 360): Promise<Line[]> {
  const { context, page } = await phone(lang)
  await page.setViewportSize({ width, height: 780 })
  await context.addInitScript(followMoves)
  await settle(page, `${site.ui}/playground`)
  const app = page.frames().find((frame) => frame.url().startsWith(site.sampleApp))
  expect(app).toBeDefined()
  if (!app) return []
  // The app has named its three pages, and from 1040 px they show in the Admin's menu.
  await expect.poll(() => page.locator('.e-app-nav:visible a').count()).toBe(width >= 1040 ? 3 : 0)
  const where = width === 360 ? lang : `${lang}, ${width} px`
  if (broken === 'slow order')
    await context.route(/\/orders\/\d+/, async (route) => {
      await new Promise((done) => setTimeout(done, budgets.move))
      await route.continue()
    })
  const rounds: Line[][] = []
  for (let round = 0; round < 3; round++) {
    await app.getByRole('link', { name: '#1042' }).tap()
    if (broken === 'moved chrome')
      await page.evaluate(() => {
        document.querySelector<HTMLElement>('e-admin-panel')!.style.marginTop = '80px'
      })
    await app.locator('#items-card').waitFor()
    expect(await app.locator('e-page').getAttribute('heading')).toContain('#1042')
    const there = await moveLines(`order, ${where}`, page, app)
    await app.locator('a[data-words="back"]').tap()
    await app.getByRole('link', { name: '#1042' }).waitFor()
    rounds.push([...there, ...(await moveLines(`orders list, ${where}`, page, app))])
  }
  await context.close()
  // A busy machine only adds time, so the fastest of three moves is the move's own time, while a
  // shift in any of the three counts.
  return rounds[0]!.map(({ what, budget, unit }, index) => ({
    what,
    value: (unit === 'ms' ? Math.min : Math.max)(...rounds.map((one) => one[index]!.value)),
    budget,
    unit,
  }))
}

test.for(['en', 'bn'])('moving from the orders list to an order and back in %s is within its budgets', async (lang) => {
  const measured = await orderAndBack(lang)
  console.log(report(measured))
  expect(measured.every(({ value }) => Number.isFinite(value))).toBe(true)
  expect(over(measured)).toEqual([])
})

test('moving from the orders list to an order and back at 1280 px is within its budgets', async () => {
  const measured = await orderAndBack('en', undefined, 1280)
  console.log(report(measured))
  expect(measured.every(({ value }) => Number.isFinite(value))).toBe(true)
  expect(over(measured)).toEqual([])
})

test('an order page held back by the move budget puts the move to it over', async () => {
  const measured = await orderAndBack('en', 'slow order')
  console.log(report(measured))
  expect(over(measured).map(({ what }) => what)).toEqual(['tap to order, en'])
})

test('a chrome that moves as the order loads puts its shift over', async () => {
  const measured = await orderAndBack('en', 'moved chrome')
  console.log(report(measured))
  expect(over(measured).map(({ what }) => what)).toEqual(['chrome shift, to order, en'])
})
