// e-chart on its docs page, where a person and a screen reader meet it: what a screen reader reads
// for a bar, and a chart that is whole before v2.js runs and does not move once it has.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// The text Chromium's accessibility tree holds for one bar, in reading order.
async function spoken(page: Page, selector: string): Promise<string> {
  const cdp = await page.context().newCDPSession(page)
  const { root: document } = await cdp.send('DOM.getDocument', { depth: 0 })
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: document.nodeId, selector })
  const { backendNodeId } = (await cdp.send('DOM.describeNode', { nodeId })).node
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { backendNodeId, fetchRelatives: false })
  const root = nodes[0]!
  const all = (await cdp.send('Accessibility.getFullAXTree')).nodes
  const byId = new Map(all.map((node) => [node.nodeId, node]))
  const words: string[] = []
  const walk = (id: string) => {
    const node = byId.get(id)
    if (!node) return
    if (node.role?.value === 'StaticText') words.push(String(node.name?.value ?? ''))
    for (const child of node.childIds ?? []) walk(child)
  }
  walk(root.nodeId)
  return words.join(' ')
}

test('/components/chart answers and its 30-day chart draws 30 bars', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/chart`, 1440)
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll('.example e-chart')].map((c) => c.children.length),
  )
  // 30 days with a key and 4 steps, the empty chart's key and steps, 8 months with 3 steps, and Bangla's 30 days.
  expect(counts).toEqual([35, 5, 12, 35])
  expect(errors).toEqual([])
})

test("a screen reader reads the 30th bar's date and value", async () => {
  const { page } = await pages.open(`${pages.ui}/components/chart`, 1440)
  const text = await spoken(page, '.example e-chart-bar[today]')
  expect(text).toContain('13 Nov')
  expect(text).toContain('৳17,420')
  expect(text.indexOf('13 Nov')).toBeLessThan(text.indexOf('৳17,420'))
  // The chart itself is named, and its total read.
  const chart = await spoken(page, '.example e-chart')
  expect(chart.startsWith('Net sales a day, 15 Oct to 13 Nov 2026')).toBe(true)
  expect(chart).toContain('৳9,87,156')
})

for (const width of [1440, 360]) {
  test(`at ${width} px with v2.js held back every chart is drawn, and nothing moves over 1 px once it runs`, async () => {
    const { page } = await pages.open('', width)
    let release = () => {}
    const held = new Promise<void>((done) => (release = done))
    await page.route(/\/ui\/v2\.js/, async (route) => {
      await held
      await route.continue()
    })
    const loaded = page.goto(`${pages.ui}/components/chart`)
    await page.waitForSelector('.example e-chart-bar')
    const boxes = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.example e-chart, .example e-chart > *')].map((part) => {
          const { left, top, width, height } = part.getBoundingClientRect()
          return [left, top, width, height]
        }),
      )
    const before = await boxes()
    // The 30-day chart's bars stand before the script: 30 of them, each with a height.
    const heights = await page.evaluate(() =>
      [...document.querySelectorAll('.example')[0]!.querySelectorAll('e-chart-bar')].map(
        (bar) => bar.getBoundingClientRect().height,
      ),
    )
    expect(heights.length).toBe(30)
    for (const height of heights) expect(height).toBeGreaterThan(0)
    release()
    await loaded
    await page.waitForFunction(() => customElements.get('e-card'))
    const after = await boxes()
    expect(after.length).toBe(before.length)
    for (const [i, box] of after.entries()) {
      for (const [j, value] of box.entries()) expect(Math.abs(value - before[i]![j]!)).toBeLessThanOrEqual(1)
    }
  })
}
