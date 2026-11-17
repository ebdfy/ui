// The playground's Delivery page: its body in the rich text editor, saved with the Admin's bar. An
// edit raises the bar, undoing it or a Show HTML round trip leaves nothing to save, and Discard
// draws the body as it opened.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const path = '/playground/content/pages/delivery'

async function open(width = 1440, lang = 'en') {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((language) => localStorage.setItem('ebdfy-playground-lang', language), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-rich-text [data-part="body"]').waitFor()
  return opened
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const field = (page: Page) => page.locator('textarea[name="body"]').inputValue()
const body = (page: Page) => page.locator('e-rich-text [data-part="body"]')
const tool = (page: Page, name: string) =>
  page.locator(`e-rich-text [data-part="tools"] > button[aria-label="${name}"]`)

// Selects a word of the body, as a drag across it does.
const select = (page: Page, word: string) =>
  body(page).evaluate((element, wanted) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent!.indexOf(wanted)
      if (at < 0) continue
      ;(element as HTMLElement).focus()
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + wanted.length)
      getSelection()!.removeAllRanges()
      getSelection()!.addRange(range)
      return
    }
  }, word)

test('the page opens with its stored <b>7 days</b> and raises no bar before any edit', async () => {
  const { page } = await open()
  expect(await field(page)).toContain('<b>7 days</b>')
  await page.waitForTimeout(300)
  expect(await bar(page).isVisible()).toBe(false)
  // Content sits above the box, outside it.
  const label = await page.locator('e-rich-text > [data-part="label"]').boundingBox()
  const box = await page.locator('e-rich-text > [data-part="box"]').boundingBox()
  expect(await page.locator('e-rich-text > [data-part="label"]').textContent()).toBe('Content')
  expect(label!.y + label!.height).toBeLessThanOrEqual(box!.y)
})

test('selecting "returns" and pressing Bold writes <strong>returns</strong> and raises the bar; undo hides it', async () => {
  const { page } = await open()
  await select(page, 'returns')
  await tool(page, 'Bold').click()
  expect(await field(page)).toContain('<strong>returns</strong>')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  await page.keyboard.press('Control+z')
  await expect.poll(() => field(page)).toContain('<b>7 days</b>')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('Show HTML and back with nothing changed raises no bar', async () => {
  const { page } = await open()
  await tool(page, 'Show HTML').click()
  expect(await page.locator('textarea[name="body"]').isVisible()).toBe(true)
  await tool(page, 'Show HTML').click()
  expect(await body(page).isVisible()).toBe(true)
  await page.waitForTimeout(300)
  expect(await bar(page).isVisible()).toBe(false)
})

test('Discard puts the opening body back in the editor, and Save answers "Page saved"', async () => {
  const { page } = await open()
  await select(page, 'returns')
  await tool(page, 'Italic').click()
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect(await body(page).innerHTML()).not.toContain('<em>')
  expect(await field(page)).toContain('<b>7 days</b>')
  await select(page, 'returns')
  await tool(page, 'Bold').click()
  let posted = ''
  page.on('request', (request) => {
    if (request.method() === 'POST') posted = request.postDataBuffer()?.toString() ?? ''
  })
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.locator('.e-toast').textContent()).toBe('Page saved')
  expect(posted).toContain('<strong>returns</strong>')
  // The answer's editor holds what was saved, and nothing is left to save.
  expect(await body(page).innerHTML()).toContain('<strong>returns</strong>')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('a body over 512 KB is refused under the editor, and the bar reads "1 field needs a fix"', async () => {
  const { page } = await open()
  await page.locator('textarea[name="body"]').evaluate((field: HTMLTextAreaElement) => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    set.call(field, `<p>${'a'.repeat(512 * 1024)}</p>`)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  expect(await page.locator('e-rich-text').getAttribute('error')).toBe('Write at most 512 KB of content.')
})

test('with JavaScript off the page shows the text area holding the HTML under its label', async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}${path}`)
  const area = page.locator('e-rich-text textarea[name="body"]')
  expect(await area.isVisible()).toBe(true)
  expect(await area.inputValue()).toContain('<b>7 days</b>')
  expect(await page.locator('e-rich-text').evaluate((tag) => getComputedStyle(tag, '::before').content)).toBe(
    '"Content"',
  )
})

test.for(['en', 'bn'])('at 360 px in %s the editor fits and its tool buttons are 44 px', async (lang) => {
  const { page } = await open(360, lang)
  const sizes = await page
    .locator('e-rich-text [data-part="tools"] > button')
    .evaluateAll((buttons) => buttons.map((button) => [button.clientWidth, button.clientHeight]))
  expect(sizes.every(([width, height]) => width === 44 && height === 44)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  const box = await page.locator('e-rich-text > [data-part="box"]').boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)
})

test('Image opens the Files modal; picking jamdani-panjabi-white.jpg puts it in at the caret with its alt text', async () => {
  const { page } = await open()
  await select(page, 'Start')
  await body(page).evaluate(() => getSelection()!.collapseToEnd())
  await tool(page, 'Image').click()
  const files = page.locator('#files dialog')
  await expect.poll(() => files.isVisible()).toBe(true)
  await files.getByRole('button', { name: 'jamdani-panjabi-white.jpg' }).click()
  await expect.poll(() => files.isVisible()).toBe(false)
  expect(await field(page)).toContain('<img src="/files/jamdani-panjabi-white.jpg" alt="White jamdani panjabi">')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  // The image shows in the body.
  await expect
    .poll(() =>
      body(page)
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0)
})

test('Link with "https://rubelfashion.com/returns" on "returns" puts the link in the field', async () => {
  const { page } = await open()
  await select(page, 'returns')
  await tool(page, 'Link').click()
  const dialog = page.locator('e-rich-text e-modal dialog')
  await dialog.getByRole('textbox', { name: 'Address' }).fill('https://rubelfashion.com/returns')
  await dialog.getByRole('button', { name: 'Insert' }).click()
  expect(await field(page)).toContain('<a href="https://rubelfashion.com/returns">returns</a>')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
})

test('with unsaved changes, a click on a link in the body asks nothing and stays on the page', async () => {
  const { page } = await open()
  await select(page, 'returns')
  await tool(page, 'Link').click()
  const dialog = page.locator('e-rich-text e-modal dialog')
  await dialog.getByRole('textbox', { name: 'Address' }).fill('/pages/returns')
  await dialog.getByRole('button', { name: 'Insert' }).click()
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  await body(page).locator('a').click()
  await expect.poll(() => page.locator('dialog.e-leave').isVisible()).toBe(false)
  expect(new URL(page.url()).pathname).toBe(path)
  await tool(page, 'Link').click()
  expect(await dialog.getByRole('textbox', { name: 'Address' }).inputValue()).toBe('/pages/returns')
})
