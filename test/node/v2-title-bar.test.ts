// An app page's title bar, built from e-page's record header: the app's 28 px tile, the title the
// app sets (its name until then) and its actions, the one marked primary drawn as the primary, in a
// header of 64 px whether the app is loading, answered or silent.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const desktop = { viewport: { width: 1440, height: 900 } }

const appPage = (script: string) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><link rel="icon" href="data:," /></head>
  <body>
    <p id="said"></p>
    <script type="module" src="/ui/v2.js"></script>
    <script type="module">${script}</script>
  </body>
</html>`

// The playground at its address; with body, the orders page it frames is the test's own.
async function open(url = '/playground/orders', body?: string, width = 1440) {
  const { page, errors } = await pages.open('', width, { viewport: { width, height: 900 } })
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text())
  })
  if (body !== undefined) {
    const orders = (address: URL) => address.origin === pages.sampleApp && address.pathname === '/orders'
    await page.route(orders, (route) => route.fulfill({ contentType: 'text/html', body }))
  }
  await page.goto(`${pages.ui}${url}`)
  return { page, errors, warnings }
}

async function appFrame(page: Page): Promise<Frame> {
  const isApp = (frame: Frame) => frame.url().startsWith(`${pages.sampleApp}/`)
  await expect.poll(() => page.frames().some(isApp)).toBe(true)
  return page.frames().find(isApp)!
}

const header = 'e-admin-panel > header'

// What the title bar shows, left to right: the tile, the heading, then each action's label and tone.
const bar = (page: Page) =>
  page.locator(header).evaluate((head) => {
    const box = (element: Element | null) => {
      const rect = element?.getBoundingClientRect()
      return rect ? [Math.round(rect.width), Math.round(rect.height)] : null
    }
    const tile = head.querySelector(':scope > .e-tile')
    const h1 = head.querySelector('h1')
    return {
      height: Math.round(head.getBoundingClientRect().height),
      tile: tile?.textContent,
      tileBox: box(tile),
      tileBeforeHeading: !!tile && !!h1 && tile.getBoundingClientRect().right <= h1.getBoundingClientRect().left,
      heading: h1?.textContent,
      actions: [...head.querySelectorAll('.e-title-actions > :is(e-button, e-menu)')]
        .filter((part) => part.checkVisibility())
        .map((part) => {
          const kit = part.localName === 'e-menu' ? part.querySelector(':scope > [slot="trigger"]')! : part
          return { label: kit.textContent?.trim(), tone: kit.getAttribute('tone'), menu: part.localName === 'e-menu' }
        }),
    }
  })

test('the orders page shows the tile, "Orders", a plain Export and the primary Create order in a 64 px header', async () => {
  const { page, errors } = await open()
  await expect.poll(async () => (await bar(page)).actions.length).toBe(2)
  expect(await bar(page)).toEqual({
    height: 64,
    tile: 'S',
    tileBox: [28, 28],
    tileBeforeHeading: true,
    heading: 'Orders',
    actions: [
      { label: 'Export', tone: null, menu: false },
      { label: 'Create order', tone: 'primary', menu: false },
    ],
  })
  // The app's area starts under the header.
  const frame = await page.locator('e-admin-panel > iframe').boundingBox()
  const head = await page.locator(header).boundingBox()
  expect(frame!.y).toBeCloseTo(head!.y + 64, 0)
  expect(errors).toEqual([])
})

test("pressing Create order runs the app's handler", async () => {
  const { page } = await open()
  await page.locator(header).getByRole('button', { name: 'Create order' }).click()
  const app = await appFrame(page)
  await expect.poll(() => app.locator('#pressed').textContent()).toBe('Create order pressed')
  expect(await app.locator('#pressed').isVisible()).toBe(true)
})

test("before the app sets a title the heading reads the app's name beside its tile", async () => {
  const { page } = await open('/playground/orders', appPage(''))
  await appFrame(page)
  expect(await bar(page)).toMatchObject({ tile: 'S', tileBeforeHeading: true, heading: 'Sample app', actions: [] })
})

test('two actions with none marked primary draw as two plain buttons', async () => {
  const { page } = await open(
    '/playground/orders',
    appPage("ebdfy.title('Order #1042', { actions: [{ label: 'Print' }, { label: 'Book courier' }] })"),
  )
  await expect.poll(async () => (await bar(page)).actions).toEqual([
    { label: 'Print', tone: null, menu: false },
    { label: 'Book courier', tone: null, menu: false },
  ])
})

test('a second action marked primary draws plain, and the bridge warns once in the app', async () => {
  const { page, warnings } = await open(
    '/playground/orders',
    appPage(
      "ebdfy.title('Orders', { actions: [{ label: 'Export', primary: true }, { label: 'Create order', primary: true }] })",
    ),
  )
  await expect.poll(async () => (await bar(page)).actions).toEqual([
    { label: 'Export', tone: 'primary', menu: false },
    { label: 'Create order', tone: null, menu: false },
  ])
  expect(warnings.filter((text) => text.includes('primary'))).toEqual([
    'ebdfy: at most one title action is primary; the others draw plain',
  ])
})

test('an action with 2 items opens a menu of them, the critical one in the danger colour, and a pick runs it', async () => {
  const { page } = await open(
    '/playground/orders',
    appPage(`const said = document.querySelector('#said')
      ebdfy.title('Order #1042', { actions: [{ label: 'More', items: [
        { label: 'Duplicate', onAction: () => (said.textContent = 'Duplicate picked') },
        { label: 'Cancel order', tone: 'critical', onAction: () => (said.textContent = 'Cancel picked') },
      ] }] })`),
  )
  await expect.poll(async () => (await bar(page)).actions).toEqual([{ label: 'More', tone: null, menu: true }])
  await page.locator(header).getByRole('button', { name: 'More' }).click()
  const menu = page.locator(header).getByRole('menu')
  expect(await menu.getByRole('menuitem').allTextContents()).toEqual(['Duplicate', 'Cancel order'])
  const colour = (name: string) =>
    menu.getByRole('menuitem', { name }).evaluate((item) => getComputedStyle(item).color)
  const danger = await page.locator('e-admin-panel').evaluate((panel) => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--e-color-danger)'
    panel.append(probe)
    const value = getComputedStyle(probe).color
    probe.remove()
    return value
  })
  expect(await colour('Cancel order')).toBe(danger)
  expect(await colour('Duplicate')).not.toBe(danger)
  await menu.getByRole('menuitem', { name: 'Cancel order' }).click()
  const app = await appFrame(page)
  await expect.poll(() => app.locator('#said').textContent()).toBe('Cancel picked')
})

test("a tile given the app's icon shows it at 28 px, and an icon that answers 404 leaves its letter", async () => {
  const { page } = await open()
  const tile = page.locator(`${header} > .e-tile`)
  const shown = () =>
    tile.evaluate((element) => {
      const image = element.querySelector('img')
      if (!image?.checkVisibility()) return element.textContent
      const { width, height } = image.getBoundingClientRect()
      return image.naturalWidth > 0 ? `icon ${width}x${height}` : 'broken image'
    })
  await tile.evaluate((element, src) => {
    const image = document.createElement('img')
    image.alt = ''
    image.src = src
    element.append(image)
  }, `${pages.sampleApp}/icon.svg`)
  await expect.poll(shown).toBe('icon 28x28')
  await tile.evaluate((element, src) => {
    element.querySelector('img')!.src = src
  }, `${pages.sampleApp}/no-such-icon.svg`)
  await expect.poll(shown).toBe('S')
})

test('?hang keeps the 64 px header with the tile while loading and under "This app isn\'t responding"', async () => {
  const { page } = await pages.open('', 1440, desktop)
  const start = new Date('2026-03-02T09:00:00')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(start)
  await page.goto(`${pages.ui}/playground?hang`)
  expect(await bar(page)).toMatchObject({ height: 64, tile: 'S', heading: 'Sample app' })
  expect(await page.locator('e-admin-panel > .e-loading-bar').isVisible()).toBe(true)
  await page.clock.runFor(15_000)
  await expect.poll(() => page.getByText("This app isn't responding").isVisible()).toBe(true)
  expect(await bar(page)).toMatchObject({ height: 64, tile: 'S', heading: 'Sample app' })
})

// Below 600 px the primary stays on the title row and every other action moves into ⋯.
const phoneBar = (page: Page) =>
  page.locator(header).evaluate((head) => {
    const shown = (element: Element) => element.checkVisibility()
    const right = Math.max(...[...head.querySelectorAll('*')].filter(shown).map((part) => part.getBoundingClientRect().right))
    // The ⋯ e-button's box, and the name on the native button it holds.
    const tag = head.querySelector('.e-title-more > [slot="trigger"]')
    const more = tag?.querySelector(':scope > button')
    const moreBox = tag?.getBoundingClientRect()
    return {
      height: Math.round(head.getBoundingClientRect().height),
      buttons: [...head.querySelectorAll('.e-title-actions > [data-folds], .e-title-actions > e-button')]
        .filter(shown)
        .map((part) => part.textContent?.trim()),
      more: more && shown(more) ? [more.getAttribute('aria-label'), Math.round(moreBox!.width), Math.round(moreBox!.height)] : null,
      within: right <= 360,
    }
  })

test.for([
  ['en', 'Create order', 'More actions', 'Export', 'Export pressed'],
  ['bn', 'অর্ডার তৈরি করুন', 'আরও অ্যাকশন', 'এক্সপোর্ট', 'এক্সপোর্ট চাপা হয়েছে'],
] as const)('at 360 px in %s Create order stays and ⋯ opens a menu with Export', async ([lang, create, more, exported, said]) => {
  const { page, errors } = await pages.open('', 360, { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true })
  await page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await page.goto(`${pages.ui}/playground/orders`)
  await expect.poll(() => phoneBar(page)).toEqual({ height: 64, buttons: [create], more: [more, 44, 44], within: true })
  await page.locator(header).getByRole('button', { name: more }).click()
  const menu = page.locator(header).getByRole('menu')
  expect(await menu.getByRole('menuitem').allTextContents()).toEqual([exported])
  await menu.getByRole('menuitem', { name: exported }).click()
  const app = await appFrame(page)
  await expect.poll(() => app.locator('#pressed').textContent()).toBe(said)
  expect(errors).toEqual([])
})

test('at 360 px with no primary both actions go into ⋯', async () => {
  const { page } = await open(
    '/playground/orders',
    appPage("ebdfy.title('Order #1042', { actions: [{ label: 'Print' }, { label: 'Book courier', items: [{ label: 'Pathao' }, { label: 'Steadfast' }] }] })"),
    360,
  )
  await expect.poll(async () => (await phoneBar(page)).more?.[0]).toBe('More actions')
  expect((await phoneBar(page)).buttons).toEqual([])
  await page.locator(header).getByRole('button', { name: 'More actions' }).click()
  expect(await page.locator(header).getByRole('menu').getByRole('menuitem').allTextContents()).toEqual([
    'Print',
    'Pathao',
    'Steadfast',
  ])
})
