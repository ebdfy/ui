// e-app-card: an app's card in an order's side column frames the app's card page with the store and
// the order's id under the app's tile and name, answers its ID token, context and theme as an app page
// is answered, and hears nothing else: not the page's messages, and not any other window's.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// An order page's side column, 328 px wide, holding the card, put in an Admin page of the playground,
// which loads v2-host.js as the Admin's order page will.
const orderPage = (card: string) => `<button type="button" id="other" onclick="this.textContent = 'Pressed'">Mark as paid</button>
<div id="side" style="inline-size: 328px">${card}</div>`

const card = (extra = '', src = '/card?store=demo&id=ord_1042') =>
  `<e-app-card src="${pages.sampleApp}${src}" app="Sample app" tile="S" store="demo" token-url="/dev/id-token?app=sample" api-url="/dev/graphql" ${extra}></e-app-card>`

async function open(html: string, width = 1440, clock = false) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  const { page } = opened
  if (clock) {
    const start = new Date('2026-03-02T09:00:00')
    await page.clock.install({ time: start })
    await page.clock.pauseAt(start)
  }
  const tokens: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/dev/id-token') tokens.push(request.url())
  })
  await page.goto(`${pages.ui}/playground/products/7`)
  await page.locator('e-admin-panel > .admin-page').evaluate((at, markup) => (at.innerHTML = markup), html)
  return { ...opened, tokens }
}

async function cardFrame(page: Page): Promise<Frame> {
  const isCard = (frame: Frame) => frame.url().startsWith(`${pages.sampleApp}/card`)
  await expect.poll(() => page.frames().some(isCard)).toBe(true)
  return page.frames().find(isCard)!
}

const heading = (page: Page) =>
  page.locator('e-app-card > header').evaluate((header) => {
    const tile = header.querySelector('.e-tile')!
    const box = tile.getBoundingClientRect()
    const name = header.querySelector('h2')!
    return {
      tile: tile.textContent,
      size: [box.width, box.height],
      before: box.right <= name.getBoundingClientRect().left,
      name: name.textContent,
    }
  })

test('the card frames the app\'s card page for ord_1042 under the app\'s 20 px tile and name', async () => {
  const { page, errors } = await open(orderPage(card()))
  const app = await cardFrame(page)
  const address = new URL(app.url())
  expect([address.pathname, address.searchParams.get('store'), address.searchParams.get('id')]).toEqual([
    '/card',
    'demo',
    'ord_1042',
  ])
  await expect.poll(() => app.locator('#card').textContent()).toBe('Card for ord_1042')
  expect(await heading(page)).toEqual({ tile: 'S', size: [20, 20], before: true, name: 'Sample app' })
  await expect
    .poll(() => app.evaluate(() => ({ placement: ebdfy.config.placement, id: ebdfy.config.id })))
    .toEqual({ placement: 'ORDER_CARD', id: 'ord_1042' })
  expect(errors).toEqual([])
})

test("the card gets an ID token from the card's token address, and redraws in Bangla with no reload", async () => {
  const { page, tokens } = await open(orderPage(card()))
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  expect(tokens).toEqual([`${pages.ui}/dev/id-token?app=sample`])
  const loads: string[] = []
  page.on('framenavigated', (frame) => loads.push(frame.url()))
  await page.evaluate(() => (document.documentElement.lang = 'bn'))
  await expect.poll(() => app.locator('#card').textContent()).toBe('ord_1042-এর কার্ড')
  expect(loads).toEqual([])
})

test("a title or a toast from the card's app changes nothing on the page", async () => {
  const { page } = await open(orderPage(card()))
  const app = await cardFrame(page)
  // The card has drawn all it will, and its frame has taken the height it reported.
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  await page.waitForTimeout(300)
  const before = await page.locator('body').innerHTML()
  const title = await page.title()
  await app.evaluate(() => {
    ebdfy.title('Hijacked', { actions: [{ label: 'Press me' }] })
    ebdfy.toast('Card says hi')
    ebdfy.nav([{ label: 'Elsewhere', path: '/elsewhere' }])
  })
  await page.waitForTimeout(300)
  expect(await page.locator('body').innerHTML()).toBe(before)
  expect(await page.title()).toBe(title)
})

test("the heading's tile shows the app's icon at 20 px, and its letter when the icon answers 404", async () => {
  const shown = (page: Page) =>
    page.locator('e-app-card .e-tile').evaluate((tile) => {
      const image = tile.querySelector('img')
      if (!image?.checkVisibility()) return tile.textContent
      const { width, height } = image.getBoundingClientRect()
      return image.naturalWidth > 0 ? `icon ${width}x${height}` : 'broken image'
    })
  const withIcon = await open(orderPage(card(`icon="${pages.sampleApp}/icon.svg"`)))
  await expect.poll(() => shown(withIcon.page)).toBe('icon 20x20')
  const missing = await open(orderPage(card(`icon="${pages.sampleApp}/no-such-icon.svg"`)))
  await expect.poll(() => shown(missing.page)).toBe('S')
})

test("a card marked no-access shows its heading and says so, framing nothing and asking for no token", async () => {
  const { page, tokens } = await open(orderPage(card('no-access')))
  await expect.poll(() => page.locator('e-app-card > p').textContent()).toBe("You don't have access to Sample app")
  expect(await heading(page)).toMatchObject({ tile: 'S', name: 'Sample app' })
  expect(await page.locator('e-app-card iframe').count()).toBe(0)
  await page.evaluate(() => (document.documentElement.lang = 'bn'))
  await expect.poll(() => page.locator('e-app-card > p').textContent()).toBe('Sample app-এ আপনার অ্যাক্সেস নেই')
  expect(tokens).toEqual([])
})

test("a second frame at the app's origin cannot raise the card's loading bar", async () => {
  const { page } = await open(orderPage(card()))
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  const bar = page.locator('e-app-card > .e-loading-bar')
  await expect.poll(() => bar.isVisible()).toBe(false)
  await page.evaluate(async (origin) => {
    const forger = document.createElement('iframe')
    forger.src = `${origin}/hang`
    document.body.append(forger)
    await new Promise((loaded) => forger.addEventListener('load', loaded, { once: true }))
  }, pages.sampleApp)
  // The forger, at the app's origin, says it is busy as the card's app would.
  const forger = page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/hang`))!
  await forger.evaluate(
    (ui) => window.parent.postMessage({ type: 'loading', payload: { visible: true } }, ui),
    pages.ui,
  )
  await page.waitForTimeout(300)
  expect(await bar.isVisible()).toBe(false)
  // The card's own app can.
  await app.evaluate(() => ebdfy.loading(true))
  await expect.poll(() => bar.isVisible()).toBe(true)
})

test("a card whose app never answers shows the notice with Reload after 15 s, and the page keeps working", async () => {
  const { page } = await open(orderPage(card('', '/hang?store=demo&id=ord_1042')), 1440, true)
  expect(await page.locator('e-app-card > .e-loading-bar').isVisible()).toBe(true)
  await page.clock.runFor(15_000)
  const notice = page.locator('e-app-card > .e-notice')
  await expect.poll(() => notice.isVisible()).toBe(true)
  expect(await notice.locator('p').first().textContent()).toBe("This app isn't responding")
  expect(await notice.getByRole('button', { name: 'Reload' }).isVisible()).toBe(true)
  await page.getByRole('button', { name: 'Mark as paid' }).click()
  expect(await page.locator('#other').textContent()).toBe('Pressed')
})

const frameHeight = (page: Page) =>
  page.locator('e-app-card > iframe').evaluate((frame) => Math.round(frame.getBoundingClientRect().height))

// The card page's content as tall as given, which its bridge reports.
const grow = (app: Frame, px: number) => app.evaluate((height) => (document.body.style.blockSize = `${height}px`), px)

test('the frame takes the height its app reports, from 40 px to 480 px, and the card scrolls inside past it', async () => {
  const { page } = await open(orderPage(card()))
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  await grow(app, 160)
  await expect.poll(() => frameHeight(page)).toBe(160)
  await grow(app, 900)
  await expect.poll(() => frameHeight(page)).toBe(480)
  expect(await app.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight)).toBe(
    true,
  )
  // The order page's other cards stay where a 480 px card leaves them.
  await grow(app, 100)
  await expect.poll(() => frameHeight(page)).toBe(100)
  await grow(app, 10)
  await expect.poll(() => frameHeight(page)).toBe(40)
})

test('until its app answers the frame keeps 120 px under the loading bar', async () => {
  const { page } = await open(orderPage(card('', '/hang?store=demo&id=ord_1042')))
  expect(await frameHeight(page)).toBe(120)
  expect(await page.locator('e-app-card > .e-loading-bar').isVisible()).toBe(true)
})

test("a height posted from a second frame at the app's origin leaves the card's height as it was", async () => {
  const { page } = await open(orderPage(card()))
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  await grow(app, 160)
  await expect.poll(() => frameHeight(page)).toBe(160)
  await page.evaluate(async (origin) => {
    const forger = document.createElement('iframe')
    forger.src = `${origin}/hang`
    document.body.append(forger)
    await new Promise((loaded) => forger.addEventListener('load', loaded, { once: true }))
  }, pages.sampleApp)
  const forger = page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/hang`))!
  await forger.evaluate((ui) => window.parent.postMessage({ type: 'height', payload: { height: 400 } }, ui), pages.ui)
  await page.waitForTimeout(300)
  expect(await frameHeight(page)).toBe(160)
})

test('at 360 px in a 328 px side column the card is 328 px wide with no sideways scroll', async () => {
  const { page } = await open(orderPage(card()), 360)
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#card').textContent()).toBe('Card for ord_1042')
  const width = await page.locator('e-app-card').evaluate((element) => element.getBoundingClientRect().width)
  expect(width).toBe(328)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360)
  expect(await app.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('/components/app-card frames the card for ord_1042 in an order\'s side column, grown to the height it reports', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/components/app-card`, 1280)
  const app = await cardFrame(page)
  await expect.poll(() => app.locator('#signed').textContent()).toBe('Signed in to demo')
  expect(await app.locator('#card').textContent()).toBe('Card for ord_1042')
  const side = page.locator('e-page > [slot="aside"]').first()
  expect(await side.locator('e-app-card').count()).toBe(1)
  // The frame is as tall as the card page's own box says.
  const reported = await app.evaluate(() => Math.ceil(document.documentElement.getBoundingClientRect().height))
  await expect.poll(() => frameHeight(page)).toBe(Math.min(Math.max(reported, 40), 480))
  expect(errors).toEqual([])
})

test("/components/menu shows an item with the app's 20 px tile, lined up with an icon item", async () => {
  const { page } = await pages.open(`${pages.ui}/components/menu`, 1280)
  const example = page.locator('figure.example', { hasText: 'Translate' }).first()
  await example.getByRole('button', { name: 'More actions' }).click()
  const tile = example.getByRole('menuitem', { name: 'Translate' }).locator('.e-tile')
  expect(await tile.evaluate((element) => [element.getBoundingClientRect().width, element.textContent])).toEqual([
    20,
    'S',
  ])
})
