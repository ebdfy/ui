// The playground's Main menu: its items as a tree, arranged by drag and keyboard, added and edited in
// the page's modal, and saved with the Admin's bar.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const path = '/playground/content/menus/main'

async function open(width = 1440, lang = 'en') {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((language) => localStorage.setItem('ebdfy-playground-lang', language), lang)
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-menu-tree [data-part="row"]').first().waitFor()
  return opened
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const items = async (page: Page) => JSON.parse(await page.locator('input[name="items"]').inputValue())
const row = (page: Page, label: string) => page.locator(`e-menu-tree-item[label="${label}"] > [data-part="row"]`)
const outline = (page: Page) =>
  page.locator('e-menu-tree').evaluate((tree) =>
    [...tree.querySelectorAll('e-menu-tree-item')].map((item) => {
      let depth = 0
      for (let at = item.parentElement; at?.localName === 'e-menu-tree-item'; at = at.parentElement) depth++
      return `${'  '.repeat(depth)}${item.getAttribute('label')}`
    }),
  )

test('the menu shows its items, the children indented, and raises no bar', async () => {
  const { page } = await open()
  expect(await outline(page)).toEqual([
    'Home',
    'Men',
    "  Men's panjabi",
    'Women',
    '  Sarees under ৳2,000',
    '  Silk hijab',
    'Kids',
    'Eid 2026',
    'About us',
  ])
  const men = await row(page, 'Men').locator('[data-part="label"]').boundingBox()
  const panjabi = await row(page, "Men's panjabi").locator('[data-part="label"]').boundingBox()
  expect(panjabi!.x).toBeGreaterThan(men!.x + 20)
  await page.waitForTimeout(300)
  expect(await bar(page).isVisible()).toBe(false)
})

test('dragging Kids above Women and Save posts Kids third, and the toast reads "Menu saved"', async () => {
  const { page } = await open()
  const handle = await row(page, 'Kids').locator('[data-part="handle"]').boundingBox()
  const women = await row(page, 'Women').boundingBox()
  await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
  await page.mouse.down()
  await page.mouse.move(women!.x + 200, women!.y + 4, { steps: 8 })
  await page.mouse.up()
  expect((await items(page)).map((item: { title: string }) => item.title)).toEqual([
    'Home',
    'Men',
    'Kids',
    'Women',
    'Eid 2026',
    'About us',
  ])
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  let posted = ''
  page.on('request', (request) => {
    if (request.method() === 'POST') posted = request.postDataBuffer()?.toString() ?? ''
  })
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => page.locator('.e-toast').textContent()).toBe('Menu saved')
  // The bar posts the form as multipart, the items one part.
  const sent = JSON.parse(/name="items"\r\n\r\n(.*)\r\n/.exec(posted)?.[1] ?? '[]')
  expect(sent[2]).toEqual({ title: 'Kids', resourceId: 'gid://ebdfy/Collection/31', items: [] })
  // The saved page draws the order it was sent, and nothing is left to save.
  expect((await outline(page)).slice(0, 4)).toEqual(['Home', 'Men', "  Men's panjabi", 'Kids'])
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('in Bangla the items keep the titles the store wrote, so a save posts them as they were', async () => {
  const { page } = await open(1440, 'bn')
  await page.locator('e-menu-tree [data-part="handle"]').first().focus()
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => said(page)).toBe('অসংরক্ষিত পরিবর্তন')
  expect((await items(page)).map((item: { title: string }) => item.title)).toEqual([
    'Men',
    'Home',
    'Women',
    'Kids',
    'Eid 2026',
    'About us',
  ])
})

test("with focus on Silk hijab's handle, Right puts it under Sarees under ৳2,000, and Left lifts it back", async () => {
  const { page } = await open()
  await row(page, 'Silk hijab').locator('[data-part="handle"]').focus()
  await page.keyboard.press('ArrowRight')
  expect((await outline(page)).slice(3, 6)).toEqual(['Women', '  Sarees under ৳2,000', '    Silk hijab'])
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  await page.keyboard.press('ArrowLeft')
  expect((await outline(page)).slice(3, 6)).toEqual(['Women', '  Sarees under ৳2,000', '  Silk hijab'])
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('"Add menu item to Women", Label "Cotton tant saree" with its collection, Add: the row shows last under Women', async () => {
  const { page } = await open()
  await page.getByRole('button', { name: 'Add menu item to Women' }).click()
  const dialog = page.locator('#menu-item dialog')
  await expect.poll(() => dialog.isVisible()).toBe(true)
  expect(await dialog.locator('footer e-button:visible').allTextContents()).toEqual(['Cancel', 'Add'])
  await dialog.getByRole('textbox', { name: 'Label' }).fill('Cotton tant saree')
  await dialog.getByRole('combobox', { name: 'Link' }).selectOption('resource:gid://ebdfy/Collection/24')
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect.poll(() => dialog.isVisible()).toBe(false)
  expect((await outline(page)).slice(3, 7)).toEqual([
    'Women',
    '  Sarees under ৳2,000',
    '  Silk hijab',
    '  Cotton tant saree',
  ])
  expect((await items(page))[2].items[2]).toEqual({
    title: 'Cotton tant saree',
    resourceId: 'gid://ebdfy/Collection/24',
    items: [],
  })
  await expect.poll(() => said(page)).toBe('Unsaved changes')
})

test('Edit on About us opens the modal filled in, and Save changes the row', async () => {
  const { page } = await open()
  await row(page, 'About us').getByRole('button', { name: 'Edit About us' }).click()
  const dialog = page.locator('#menu-item dialog')
  await expect.poll(() => dialog.isVisible()).toBe(true)
  const label = dialog.getByRole('textbox', { name: 'Label' })
  expect(await label.inputValue()).toBe('About us')
  await label.fill('Our story')
  await dialog.getByRole('button', { name: 'Save' }).click()
  expect((await items(page)).at(-1)).toEqual({ title: 'Our story', url: '/pages/about', items: [] })
})

test('Discard puts the deleted items back', async () => {
  const { page } = await open()
  await row(page, 'Women').getByRole('button', { name: 'Delete Women' }).click()
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect((await outline(page)).slice(3, 6)).toEqual(['Women', '  Sarees under ৳2,000', '  Silk hijab'])
})

test.for(['en', 'bn'])('at 360 px in %s every tree button is 44 px and each label sits clear of them', async (lang) => {
  const { page } = await open(360, lang)
  const found = await page.locator('e-menu-tree').evaluate((tree) => {
    const rows = [...tree.querySelectorAll('[data-part="row"]')]
    return {
      small: [...tree.querySelectorAll('[data-part="row"] > button')].filter(
        (button) => button.clientWidth !== 44 || button.clientHeight !== 44,
      ).length,
      overlaps: rows.filter((row) => {
        const label = row.querySelector('[data-part="label"]')!.getBoundingClientRect()
        const [handle, edit] = [...row.querySelectorAll('button')].map((button) => button.getBoundingClientRect())
        return label.left < handle!.right || label.right > edit!.left
      }).length,
      adds: [...tree.querySelectorAll('[data-part="add"]')].filter((add) => add.getBoundingClientRect().height < 44)
        .length,
    }
  })
  expect(found).toEqual({ small: 0, overlaps: 0, adds: 0 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
