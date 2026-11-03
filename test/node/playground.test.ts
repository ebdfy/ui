import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('the playground frames the sample app, whose title shows in the cobalt bar', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`)
  await expect.poll(() => page.locator('[part="title"]').textContent(), { timeout: 15_000 }).toBe('Orders')
  const app = page.frameLocator('eb-admin-chrome iframe')
  await expect.poll(() => app.locator('eb-card eb-button[variant="primary"]').textContent()).toBe('Add order')
  expect(await app.locator('eb-card').first().getAttribute('heading')).toBe('Orders')
})

test('the sample app opened in its own tab without a store shows its page with no console error', async () => {
  const { page, errors } = await pages.open(`${pages.sampleApp}/`)
  await page.waitForFunction(() => customElements.get('eb-button') !== undefined)
  expect(await page.locator('eb-card eb-button[variant="primary"]').textContent()).toBe('Add order')
  expect(page.url()).toBe(`${pages.sampleApp}/`)
  expect(errors).toEqual([])
})

test('the sample app opened in its own tab with ?store=demo goes to its page in the Admin', async () => {
  const { page } = await pages.open('')
  await page.route('https://admin.ebdfy.com/**', (route) => route.fulfill({ body: 'Admin' }))
  await page.goto(`${pages.sampleApp}/?store=demo`)
  await page.waitForURL('https://admin.ebdfy.com/**')
  expect(page.url()).toBe('https://admin.ebdfy.com/store/demo/apps/sample')
})

// A staff member opens the sample order from the app's nav, edits its note and phone, discards,
// then saves with a 10-digit phone and with a good one.
test('the sample order saves and discards through the save bar, with the API error under the phone', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const app = page.frameLocator('eb-admin-chrome iframe')
  const bar = page.locator('eb-admin-chrome [part="save-bar"]')
  const note = app.locator('eb-text-area[name="note"] textarea')
  const phone = app.locator('eb-phone-field[name="phone"] input')
  await expect.poll(() => note.inputValue(), { timeout: 15_000 }).toBe('Call before delivery.')
  expect(await bar.count()).toBe(0)

  await note.fill('Leave at the gate.')
  await phone.fill('01811223344')
  await bar.waitFor()
  await page.locator('eb-admin-chrome [part="discard"]').click()
  await bar.waitFor({ state: 'detached' })
  expect(await note.inputValue()).toBe('Call before delivery.')
  expect(await phone.inputValue()).toBe('01707071591')

  await phone.fill('0170707159')
  await page.locator('eb-admin-chrome [part="save"]').click()
  const phoneError = app.locator('eb-phone-field[name="phone"] [part="error"]')
  await expect.poll(() => phoneError.textContent()).toBe('Enter an 11-digit phone starting with 01.')
  expect(await page.locator('eb-admin-chrome [part="toast"]').count()).toBe(0)
  // The API refused the phone, so nothing was saved and the bar stays up.
  await bar.waitFor()

  await phone.fill('01811223344')
  await page.locator('eb-admin-chrome [part="save"]').click()
  await expect.poll(() => page.locator('eb-admin-chrome [part="toast"] span').textContent()).toBe('Saved')
  expect(await phoneError.count()).toBe(0)
  expect(await app.locator('html').evaluate((html) => html.scrollWidth)).toBeLessThanOrEqual(360)
  expect(errors).toEqual([])
})

// The Ink Show path on the sample order: the return-risk banner, field edges a person can see, a
// phone error that keeps the focus ring, and Duplicate's toast whose Undo runs in the app.
test('the sample order shows its banner, a phone error with the focus ring, and a toast with Undo', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`)
  await page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const app = page.frameLocator('eb-admin-chrome iframe')
  // The banner's words are in the page before it upgrades, so wait for the element itself.
  const banner = app.locator('eb-banner[tone="danger"]:defined')
  await expect.poll(() => banner.textContent(), { timeout: 15_000 }).toContain("3 of this number's 5 orders came back.")
  expect(await banner.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('oklch(0.965 0.025 25)')

  const phone = app.locator('eb-phone-field[name="phone"] input')
  expect(await phone.evaluate((el) => getComputedStyle(el).boxShadow)).toBe(
    'oklch(0.645 0.006 85) 0px 0px 0px 1px inset',
  )
  await phone.fill('0170707159')
  await page.locator('eb-admin-chrome [part="save"]').click()
  const phoneError = app.locator('eb-phone-field[name="phone"] [part="error"]')
  await expect.poll(() => phoneError.textContent()).toBe('Enter an 11-digit phone starting with 01.')
  await phone.click()
  const look = await phone.evaluate((el) => {
    const { boxShadow, outlineStyle, outlineWidth, outlineColor } = getComputedStyle(el)
    return { boxShadow, outline: `${outlineWidth} ${outlineStyle} ${outlineColor}` }
  })
  expect(look).toEqual({
    boxShadow: 'oklch(0.55 0.2 27) 0px 0px 0px 2px inset',
    outline: '2px solid oklch(0.52 0.19 268)',
  })
  await page.locator('eb-admin-chrome [part="discard"]').click()

  await app.getByRole('button', { name: 'More' }).click()
  await app.getByRole('menuitem', { name: 'Duplicate' }).click()
  const toast = page.locator('eb-admin-chrome [part="toast"]')
  await expect.poll(() => toast.locator('span').textContent()).toBe('Copied to a new draft')
  await page.locator('eb-admin-chrome [part="toast-action"]', { hasText: 'Undo' }).click()
  await expect.poll(() => toast.locator('span').textContent()).toBe('Draft removed')
  expect(errors).toEqual([])
})

// A staff member's walk through the orders and the app nav, checking what each step leaves.
test('in the playground the orders are cards at 360 px, a table at 1280 px, and the app nav has 4 entries', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 360)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.locator('eb-row [part="card"]').first().waitFor({ timeout: 15_000 })
  expect(await app.locator('eb-row').count()).toBe(5)
  expect(await app.locator('eb-row eb-badge').count()).toBeGreaterThanOrEqual(5)
  expect(await app.locator('eb-row eb-courier-status eb-badge').first().innerText()).toBe('With courier')
  const entries = page.locator('eb-admin-chrome [part="app-nav"] a')
  expect(await entries.allInnerTexts()).toEqual(['Orders', 'Order #1001', 'Order #1039', 'Drafts'])
  expect(await app.locator('html').evaluate((html) => html.scrollWidth)).toBeLessThanOrEqual(360)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

  await page.setViewportSize({ width: 1280, height: 800 })
  await app.locator('eb-row [part="row"]').first().waitFor()
  // Six columns behind the column of checkboxes.
  expect(await app.locator('eb-table [role="columnheader"]').count()).toBe(7)
  expect(await app.locator('html').evaluate((html) => html.scrollWidth)).toBeLessThanOrEqual(1280)
  expect(errors).toEqual([])
})

test('"Hang the app" shows the loading bar, then "This app isn\'t responding" at 15 s, and Reload tries again', async () => {
  const { page, errors } = await pages.open('', 360)
  await page.clock.install()
  await page.goto(`${pages.ui}/playground`)
  const chrome = (name: string) => page.locator(`eb-admin-chrome [part="${name}"]`)
  await page.getByRole('link', { name: 'Hang the app' }).click()
  await page.waitForURL(`${pages.ui}/playground?hang`)
  await chrome('loading-bar').waitFor()
  expect(await chrome('notice').count()).toBe(0)

  await page.clock.runFor(15_000)
  await chrome('notice').waitFor()
  expect(await chrome('notice').locator('p').textContent()).toBe("This app isn't responding")
  expect(await chrome('loading-bar').count()).toBe(0)
  expect(await page.locator('eb-admin-chrome header').isVisible()).toBe(true)

  await chrome('reload').click()
  await chrome('notice').waitFor({ state: 'detached' })
  expect(await chrome('loading-bar').count()).toBe(1)
  await page.clock.runFor(15_000)
  await chrome('notice').waitFor()

  await page.getByRole('link', { name: 'Stop hanging' }).click()
  await page.waitForURL(`${pages.ui}/playground`)
  await page.clock.runFor(1_000)
  await expect
    .poll(() => page.locator('eb-admin-chrome [part="title"]').textContent(), { timeout: 15_000 })
    .toBe('Orders')
  expect(await chrome('notice').count()).toBe(0)
  expect(errors).toEqual([])
})

// A staff member books a courier, uses the order's menu and loses access, on a phone and a desktop.
const chromeFrame = 'eb-admin-chrome .frame iframe'
const modal = 'eb-admin-chrome dialog[part="modal"]'

async function openOrder(width = 360) {
  const opened = await pages.open(`${pages.ui}/playground`, width)
  await opened.page.locator('eb-admin-chrome [part="app-nav"] a', { hasText: 'Order #1001' }).click({ timeout: 15_000 })
  const book = opened.page.locator('eb-admin-chrome [part="title-action"]', { hasText: 'Book courier' })
  await book.waitFor({ timeout: 15_000 })
  return { ...opened, book }
}

test('the sample app names the store it read with ebdfy.fetch', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`)
  const app = page.frameLocator(chromeFrame)
  await expect.poll(() => app.locator('[data-store-name]').textContent(), { timeout: 15_000 }).toBe('Demo Shop')
  expect(errors).toEqual([])
})

test('on a phone Book courier opens a sheet, books and gives focus back', async () => {
  const { page, book, errors } = await openOrder()
  expect(await page.locator('eb-admin-chrome [part="title-action"]').allTextContents()).toEqual([
    expect.stringContaining('Book courier'),
    expect.stringContaining('Print'),
  ])
  await book.click()
  await page.locator(modal).waitFor()
  const box = (await page.locator(modal).boundingBox())!
  expect(box.x).toBe(0)
  expect(box.width).toBe(360)
  expect(Math.round(box.y + box.height)).toBe(800)

  const sheet = page.frameLocator(`${modal} iframe`)
  await sheet.getByRole('radio', { name: 'Steadfast' }).click()
  await sheet.getByRole('button', { name: 'Book', exact: true }).click()
  await page.locator(modal).waitFor({ state: 'detached' })
  expect(await page.locator('eb-admin-chrome [part="toast"] span').textContent()).toBe(
    'Order #1001 booked with Steadfast',
  )
  expect(await book.evaluate((button) => (button.getRootNode() as ShadowRoot).activeElement === button)).toBe(true)

  await book.click()
  await page.locator(modal).waitFor()
  await page.keyboard.press('Escape')
  await page.locator(modal).waitFor({ state: 'detached' })
  expect(await book.evaluate((button) => (button.getRootNode() as ShadowRoot).activeElement === button)).toBe(true)
  expect(errors).toEqual([])
})

test('on a desktop Book courier opens a centred dialog 620 px wide', async () => {
  const { page, book } = await openOrder(1280)
  await book.click()
  await page.locator(modal).waitFor()
  const box = (await page.locator(modal).boundingBox())!
  expect(box.width).toBe(620)
  expect(Math.round(box.x + box.width / 2)).toBe(640)
})

test("the order's overflow menu opens below More inside the phone, and a cancel the staff member may not make is refused", async () => {
  const { page } = await openOrder()
  const app = page.frameLocator(chromeFrame)
  const more = app.getByRole('button', { name: 'More' })
  await more.click()
  const menu = app.getByRole('menu', { name: 'More actions' })
  await menu.waitFor()
  const box = (await menu.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual((await more.boundingBox())!.y + (await more.boundingBox())!.height)
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(360)

  await app.getByRole('menuitem', { name: 'Cancel order' }).click()
  const toast = page.locator('eb-admin-chrome [part="toast"]')
  await expect.poll(() => toast.locator('span').textContent()).toBe('This request needs the write_orders scope.')
  expect(await toast.getAttribute('role')).toBe('alert')
})

test('pressing End access shows that the staff member no longer has access, with a way back to the stores', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`)
  await page.locator('eb-admin-chrome a[slot="nav"]', { hasText: 'End access' }).click()
  const notice = page.locator('eb-admin-chrome [part="access-ended"]')
  await expect
    .poll(() => notice.locator('p').textContent(), { timeout: 15_000 })
    .toBe('You no longer have access to this store')
  const link = page.locator('eb-admin-chrome [part="choose-store"]')
  expect((await link.textContent())!.trim()).toBe('Choose a store')
  expect(await link.getAttribute('href')).toBe('/playground')
  expect(await page.locator(chromeFrame).count()).toBe(0)
})

test('closing the More menu by Escape or by a press outside it logs no warning', async () => {
  const { page } = await openOrder()
  const warnings: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'warning' && !message.text().includes('Lit is in dev mode')) warnings.push(message.text())
  })
  const app = page.frameLocator(chromeFrame)
  const menu = app.getByRole('menu', { name: 'More actions' })
  await app.getByRole('button', { name: 'More' }).click()
  await menu.waitFor()
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'hidden' })
  await app.getByRole('button', { name: 'More' }).click()
  await menu.waitFor()
  await app.locator('eb-text[data-store-name]').click()
  await menu.waitFor({ state: 'hidden' })
  expect(warnings).toEqual([])
})

test('a playground opened with ?floor=old shows the update page and loads no admin chrome', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground?floor=old`)
  await page.getByRole('heading', { name: 'Update your browser to use ebdfy' }).waitFor()
  expect(await page.getByRole('link', { name: 'Get Chrome on Google Play' }).getAttribute('href')).toBe(
    'https://play.google.com/store/apps/details?id=com.android.chrome',
  )
  expect(await page.locator('eb-admin-chrome').count()).toBe(0)
  expect(errors).toEqual([])
})

test('in the playground at 1280 px two selected orders show the bulk bar, and Confirm says so in a toast', async () => {
  const { page, errors } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.locator('eb-row [part="row"]').first().waitFor({ timeout: 15_000 })
  await app.getByRole('checkbox', { name: 'Select #1042', exact: true }).click()
  await app.getByRole('checkbox', { name: 'Select #1039', exact: true }).click()
  await expect.poll(() => app.locator('eb-bulk-bar [role="status"]').innerText()).toBe('2 selected')
  await app.locator('eb-bulk-bar eb-button', { hasText: 'Confirm' }).click()
  const toast = page.locator('eb-admin-chrome [part="toast"]')
  await expect.poll(() => toast.locator('span').textContent()).toBe('Confirmed 2 orders')
  expect(errors).toEqual([])
})

test('a bulk action on one order says so in the singular', async () => {
  const { page } = await pages.open(`${pages.ui}/playground`, 1280)
  const app = page.frameLocator('eb-admin-chrome iframe')
  await app.locator('eb-row [part="row"]').first().waitFor({ timeout: 15_000 })
  const toast = page.locator('eb-admin-chrome [part="toast"] span')
  // The first toast is still up when the second action runs, so each waits for its own words.
  const once = async (action: string, said: string) => {
    await app.getByRole('checkbox', { name: 'Select #1041', exact: true }).click()
    await app.locator('eb-bulk-bar eb-button', { hasText: action }).click()
    await expect.poll(() => toast.textContent()).toBe(said)
  }
  await once('Book courier', 'Booked a courier for 1 order')
  await once('Print labels', 'Printing 1 label')
})
