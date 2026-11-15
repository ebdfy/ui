// A modal written in the app's markup opens inside the app's frame, and the Admin dims its own frame
// and title bar with the same scrim, so it reads as one modal over the whole Admin.
import type { Frame, Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { phones } from '../browser/phones.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const titleBar = (page: Page) => page.locator('e-admin-panel header h1')
const appFrame = (page: Page): Frame => page.frames().find((frame) => frame.url().startsWith(`${pages.sampleApp}/`))!
const view = (page: Page) => page.frameLocator('e-admin-panel iframe')
const dialog = (page: Page) => view(page).getByRole('dialog', { name: 'Confirm order #1042' })

async function order(width: number, height: number, lang: 'en' | 'bn' = 'en'): Promise<Page> {
  const { page } = await pages.open('', width, { viewport: { width, height } })
  await page.context().addInitScript((chosen) => {
    localStorage.setItem('ebdfy-playground-lang', chosen)
    localStorage.setItem('ebdfy-sample-lang', chosen)
  }, lang)
  await page.goto(`${pages.ui}/playground/orders/1042`)
  await expect.poll(() => titleBar(page).textContent(), { timeout: 15_000 }).not.toBe('Sample app')
  await appFrame(page).waitForFunction(() => document.querySelector('e-modal > dialog') !== null)
  return page
}

// What a tap at the middle of the element would land on in the Admin's own page.
async function tapLands(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      const hit = document.elementFromPoint(x + width / 2, y + height / 2)
      return hit === element || element.contains(hit) ? 'itself' : (hit?.localName ?? 'nothing')
    })
}

const scrimColour = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('e-admin-frame')!, '::after').backgroundColor)
const appScrimColour = (page: Page) =>
  appFrame(page).evaluate(
    () => getComputedStyle(document.querySelector('e-modal > dialog')!, '::backdrop').backgroundColor,
  )

test('tapping Confirm on #1042 opens the modal, and the Admin dims its menu and title bar', async () => {
  const page = await order(1440, 900)
  expect(await tapLands(page, '[slot="menu"] > a')).toBe('itself')
  await view(page).getByRole('button', { name: 'Confirm order' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await expect.poll(() => tapLands(page, '[slot="menu"] > a')).not.toBe('itself')
  expect(await tapLands(page, 'e-admin-panel > header h1')).not.toBe('itself')
  expect(await tapLands(page, '.e-search-button')).not.toBe('itself')
  expect(await scrimColour(page)).toBe(await appScrimColour(page))
  // A tap on the Admin's Home entry goes nowhere while the modal is open.
  const home = await page.locator('[slot="menu"] > a').first().boundingBox()
  await page.mouse.click(home!.x + home!.width / 2, home!.y + home!.height / 2)
  await page.keyboard.press('Tab')
  expect(page.url()).toBe(`${pages.ui}/playground/orders/1042`)
  expect(await dialog(page).isVisible()).toBe(true)
})

test('pressing Escape closes the modal and the scrim, and focus goes back to Confirm', async () => {
  const page = await order(1440, 900)
  await view(page).getByRole('button', { name: 'Confirm order' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  await expect.poll(() => tapLands(page, '[slot="menu"] > a')).toBe('itself')
  expect(await tapLands(page, 'e-admin-panel > header h1')).toBe('itself')
  expect(await appFrame(page).evaluate(() => document.activeElement?.textContent)).toBe('Confirm order')
})

test.for(phones)(
  'on a $width x $height phone the modal is a sheet on the screen bottom edge',
  async ({ width, height }) => {
    const page = await order(width, height)
    // On a phone the order's Confirm sits in its dock.
    await view(page).locator('e-bottom-bar[dock]').getByRole('button', { name: 'Confirm' }).click()
    await expect.poll(() => dialog(page).isVisible()).toBe(true)
    const frame = await page.locator('e-admin-panel > iframe').boundingBox()
    await expect
      .poll(async () => {
        const sheet = await dialog(page).boundingBox()
        return sheet && Math.round(sheet.y + sheet.height)
      })
      .toBe(height)
    const sheet = await dialog(page).boundingBox()
    expect(sheet!.x).toBeCloseTo(0, 0)
    expect(sheet!.width).toBeCloseTo(width, 0)
    expect(frame!.y + frame!.height).toBeCloseTo(height, 0)
    // The top bar and the title bar sit under the scrim; the tab bar has folded away.
    expect(await tapLands(page, '.e-search-button')).not.toBe('itself')
    expect(await tapLands(page, 'e-admin-panel > header h1')).not.toBe('itself')
    expect(await page.locator('[slot="tabs"]').isVisible()).toBe(false)

    await page.keyboard.press('Escape')
    await expect.poll(() => page.locator('[slot="tabs"]').isVisible()).toBe(true)
    expect(await tapLands(page, '[slot="tabs"] > a')).toBe('itself')
  },
)

test("the modal's buttons run the app's code: Confirm in the modal confirms #1042", async () => {
  const page = await order(1440, 900)
  await view(page).getByRole('button', { name: 'Confirm order' }).click()
  await dialog(page).getByRole('button', { name: 'Confirm' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  expect(await view(page).locator('e-page > [slot="status"] e-badge').first().textContent()).toBe('Confirmed')
  expect(await view(page).getByRole('button', { name: 'Confirm order' }).count()).toBe(0)
  await expect.poll(() => tapLands(page, '[slot="menu"] > a')).toBe('itself')
})

test('in Bangla the modal speaks Bangla', async () => {
  const page = await order(1440, 900, 'bn')
  await view(page).getByRole('button', { name: 'অর্ডার কনফার্ম করুন' }).click()
  const bangla = view(page).getByRole('dialog', { name: 'অর্ডার #1042 কনফার্ম করুন' })
  await expect.poll(() => bangla.isVisible()).toBe(true)
  expect(await bangla.getByRole('button', { name: 'কনফার্ম করুন', exact: true }).count()).toBe(1)
})

test('a scrim message from a frame that is not the app dims nothing', async () => {
  const page = await order(1440, 900)
  await page.evaluate(() => {
    const forger = document.createElement('iframe')
    forger.srcdoc = `<script>parent.postMessage({ type: 'appModal', payload: { open: true } }, '*')</script>`
    document.body.append(forger)
  })
  await page.waitForTimeout(500)
  expect(await tapLands(page, '[slot="menu"] > a')).toBe('itself')
})

test("a tap on the Admin's scrim leaves focus in the modal, so Escape still closes it", async () => {
  const page = await order(1440, 900)
  await view(page).getByRole('button', { name: 'Confirm order' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  for (const selector of ['[slot="menu"] > a', 'e-admin-panel > header h1']) {
    const spot = await page.locator(selector).first().boundingBox()
    await page.mouse.click(spot!.x + spot!.width / 2, spot!.y + spot!.height / 2)
  }
  await page.keyboard.press('Escape')
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  await expect.poll(() => tapLands(page, '[slot="menu"] > a')).toBe('itself')
})
