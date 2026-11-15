// First frame: with v2.js and v2-host.js blocked, every e-* tag on the Button page, the playground
// orders list and Settings > Store is drawn by v2.css alone, and when the scripts then run no tag moves by more than 1 px.
import { chromium, type Browser, type Frame, type Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startSite } from './site.ts'

let site: Awaited<ReturnType<typeof startSite>>
let browser: Browser

beforeAll(async () => {
  site = await startSite()
  browser = await chromium.launch()
}, 180_000)

afterAll(async () => {
  await browser?.close()
  await site?.close()
})

export interface Tag {
  id: string
  name: string
  display: string
  x: number
  y: number
  width: number
  height: number
}

// Every e-* tag in a frame, marked so the same tag is found again after the scripts add their own.
function tagsIn(frame: Frame): Promise<Tag[]> {
  return frame.evaluate(() =>
    [...document.querySelectorAll('*')]
      // A tag inside a part the layout hides at this width, such as the frame's help button on a
      // phone, has no box and needs none.
      .filter((element) => element.localName.startsWith('e-') && element.checkVisibility())
      .map((element, index) => {
        if (!element.hasAttribute('data-first-frame')) element.setAttribute('data-first-frame', String(index))
        const { x, y, width, height } = element.getBoundingClientRect()
        const display = getComputedStyle(element).display
        return { id: element.getAttribute('data-first-frame')!, name: element.localName, display, x, y, width, height }
      }),
  )
}

// A tag v2.css did not draw: it keeps the browser's inline default, or it has no box at all. A
// tag shown as display: contents (a table row) has no box of its own by design.
export function unstyled(tags: Tag[]): string[] {
  return tags
    .filter(({ display, height }) => display === 'inline' || (display !== 'contents' && height === 0))
    .map(({ name, display, height }) => `${name}: ${display}, ${height} px tall`)
}

export function moved(before: Tag[], after: Tag[]): string[] {
  const now = new Map(after.map((tag) => [tag.id, tag]))
  return before.flatMap((tag) => {
    const later = now.get(tag.id)
    if (!later) return [`${tag.name} is gone`]
    return (['x', 'y', 'width', 'height'] as const)
      .filter((key) => Math.abs(tag[key] - later[key]) > 1)
      .map((key) => `${tag.name} ${key} ${tag[key]} -> ${later[key]}`)
  })
}

const kit = /\/ui\/v2\.js$/
const chrome = /\/ui\/v2-host\.js$/

// A frame's own blocked script that a pattern names, loaded again under a new URL, as it would have
// run.
async function runScripts(frame: Frame, which: RegExp): Promise<void> {
  await frame.evaluate(async (source) => {
    const pattern = new RegExp(source)
    const scripts = [...document.querySelectorAll<HTMLScriptElement>('script[src]')].filter((script) =>
      pattern.test(script.src),
    )
    await Promise.all(
      scripts.map(
        (old) =>
          new Promise((done) => {
            const script = document.createElement('script')
            script.type = 'module'
            script.src = `${old.src}?first-frame`
            script.onload = done
            script.onerror = done
            document.head.append(script)
          }),
      ),
    )
  }, which.source)
}

const settled = (page: Page) =>
  page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))

// Reads every tag with v2-host.js and v2.js blocked, then runs them and reads every tag again. The
// chrome's script loads the app's page, so with it blocked the test loads the page the playground
// names, as the script would; the script then finds the frame loaded and leaves it.
async function firstFrame(page: Page, url: string) {
  await page.route(kit, (route) => route.abort())
  await page.route(chrome, (route) => route.abort())
  await page.goto(url, { waitUntil: 'networkidle' })
  // Each frame's load event, set before its src, so the wait is for the app's page, not about:blank.
  await page.evaluate(() =>
    Promise.all(
      [...document.querySelectorAll('iframe')]
        .filter((frame) => !frame.src && frame.dataset.src)
        .map(
          (frame) =>
            new Promise((done) => {
              frame.addEventListener('load', done, { once: true })
              frame.src = frame.dataset.src!
            }),
        ),
    ),
  )
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  const frames = page.frames()
  const before = await Promise.all(frames.map(tagsIn))
  await page.unroute(kit)
  await page.unroute(chrome)
  for (const frame of frames) await runScripts(frame, chrome)
  for (const frame of frames) await runScripts(frame, kit)
  // The scripts build their tags at once; icons fill after one fetch of the sprite.
  await page.waitForLoadState('networkidle')
  await settled(page)
  const after = await Promise.all(frames.map(tagsIn))
  return { frames, before, after }
}

const pagesToCheck = [
  { what: 'the Button page', path: '/components/button', lang: 'en' },
  { what: 'the playground orders list, en', path: '/playground', lang: 'en' },
  { what: 'the playground orders list, bn', path: '/playground', lang: 'bn' },
  { what: 'Settings > Store, en', path: '/playground/settings/store', lang: 'en' },
  { what: 'Settings > Store, bn', path: '/playground/settings/store', lang: 'bn' },
  { what: 'order #1042, en', path: '/playground/orders/1042', lang: 'en' },
  { what: 'order #1042, bn', path: '/playground/orders/1042', lang: 'bn' },
]

test.for(pagesToCheck)('$what draws every e-* tag before the scripts and moves none after', async ({ path, lang }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
  await context.addInitScript((chosen) => {
    // The Admin's language, which the app follows, and the app's own for its first paint.
    localStorage.setItem('ebdfy-playground-lang', chosen)
    localStorage.setItem('ebdfy-sample-lang', chosen)
  }, lang)
  const page = await context.newPage()
  const { frames, before, after } = await firstFrame(page, `${site.ui}${path}`)
  await context.close()
  const counted = before.flat().length
  console.log(`${path} ${lang}: ${counted} e-* tags in ${frames.length} frame(s) before the scripts`)
  expect(counted).toBeGreaterThan(5)
  // The playground's orders list is read in its own frame too.
  if (path === '/playground') expect(before[1]?.some((tag) => tag.name === 'e-table')).toBe(true)
  expect(before.flatMap(unstyled)).toEqual([])
  expect(before.flatMap((tags, index) => moved(tags, after[index]!))).toEqual([])
})

// A docs page reads its tags as it is revealed, the frame the fade shows, and says whether the move
// ran as a view transition.
test.for([
  { motion: 'no-preference', fades: true },
  { motion: 'reduce', fades: false },
] as const)(
  'moving from the Button page to the Card page with $motion motion: a fade $fades, every tag drawn',
  async ({ motion, fades }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: motion })
    await context.route(kit, (route) => route.abort())
    await context.addInitScript(() =>
      addEventListener('pagereveal', (event) => {
        const tags = [...document.querySelectorAll('*')]
          .filter((element) => element.localName.startsWith('e-') && element.checkVisibility())
          .map((element) => ({
            name: element.localName,
            display: getComputedStyle(element).display,
            height: element.getBoundingClientRect().height,
          }))
        Object.assign(window, {
          revealed: { transition: Boolean((event as PageRevealEvent).viewTransition), tags },
        })
      }),
    )
    const page = await context.newPage()
    await page.goto(`${site.ui}/components/button`)
    await page.locator('.sidebar a[href="/components/card"]').click()
    await page.waitForURL('**/components/card')
    const revealed = await page.waitForFunction(() => (window as unknown as { revealed?: unknown }).revealed)
    const { transition, tags } = (await revealed.jsonValue()) as {
      transition: boolean
      tags: { name: string; display: string; height: number }[]
    }
    await context.close()
    expect(transition).toBe(fades)
    expect(tags.filter((tag) => tag.name === 'e-card').length).toBeGreaterThan(1)
    expect(unstyled(tags.map((tag, i) => ({ ...tag, id: String(i), x: 0, y: 0, width: 0 })))).toEqual([])
  },
)

// A browser may paint a page before it has read all of it, as a busy phone does. The sample's order
// page puts its order's words in place with a script at the end of its body, so until that script
// has run the page shows nothing, not a column of empty cards that then move. Here the script never
// runs, as the orders it reads are blocked.
test('the sample order page shows no tag until its own script has filled it', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
  const page = await context.newPage()
  await page.route(kit, (route) => route.abort())
  await page.route(/\/orders-data\.js$/, (route) => route.abort())
  await page.goto(`${site.sampleApp}/orders/1042?store=demo`, { waitUntil: 'networkidle' })
  const cards = await page.locator('e-page e-card').count()
  const drawn = await page.locator('e-page').evaluate((tag) => getComputedStyle(tag).rowGap !== 'normal')
  const shown = await tagsIn(page.mainFrame())
  await context.close()
  // The page is the order's, with v2.css on it.
  expect(cards).toBeGreaterThan(3)
  expect(drawn).toBe(true)
  expect(shown.map(({ name }) => name)).toEqual([])
})

test('a page whose v2.css did not load fails the first-frame check', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } })
  const page = await context.newPage()
  await page.route(/\/ui\/v2\.css$/, (route) => route.abort())
  const { before } = await firstFrame(page, `${site.ui}/components/button`)
  await context.close()
  expect(before.flatMap(unstyled).length).toBeGreaterThan(0)
})

test('a tag that grows when the script runs fails the first-frame check', () => {
  const tag: Tag = { id: '0', name: 'e-button', display: 'inline-flex', x: 0, y: 0, width: 80, height: 36 }
  expect(moved([tag], [{ ...tag, width: 81 }])).toEqual([])
  expect(moved([tag], [{ ...tag, height: 40 }])).toEqual(['e-button height 36 -> 40'])
})
