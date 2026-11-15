// Leaving a page whose form holds an edit asks first: a link in the frame stops and the leave dialog
// opens; Back and Forward come back to the page and ask; a reload gets the browser's own prompt.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path = '/playground/settings/store', width = 1440) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  await opened.page.goto(`${pages.ui}${path}`)
  await opened.page.locator('e-admin-panel > header h1').waitFor()
  return opened
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const phone = (page: Page) => page.locator('e-phone-field input')
const dialog = (page: Page) => page.locator('dialog.e-leave')
const path = (page: Page) => new URL(page.url()).pathname
const heading = (page: Page) => page.locator('e-admin-panel > header h1').textContent()
const settingsLink = (page: Page, name: string) =>
  page.locator('[slot="menu"] > a').filter({ hasText: new RegExp(`^${name}$`) })
const focusedText = (page: Page) => page.evaluate(() => document.activeElement?.textContent)

async function edit(page: Page) {
  await phone(page).waitFor()
  await phone(page).fill('01819556699')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
}

test('with the Store form dirty, Orders stays put and asks "Leave without saving?" with Stay focused', async () => {
  const { page, errors } = await open('/playground/settings/store', 360)
  await edit(page)
  await page.locator('[slot="tabs"] > a').filter({ hasText: 'Orders' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  expect(path(page)).toBe('/playground/settings/store')
  expect(await dialog(page).locator('h2').textContent()).toBe('Leave without saving?')
  expect(await dialog(page).locator('p').textContent()).toBe(
    'Your changes to Store are not saved yet. If you leave now they are lost.',
  )
  // A screen reader names the dialog by its question and reads its sentence.
  const named = page.getByRole('dialog', { name: 'Leave without saving?' })
  expect(await named.isVisible()).toBe(true)
  expect(await named.getAttribute('aria-describedby')).toBe(await dialog(page).locator('p').getAttribute('id'))
  expect(await focusedText(page)).toBe('Stay on this page')
  expect(await bar(page).evaluate((element) => element.classList.contains('e-save-bar-nudge'))).toBe(true)
  expect(errors).toEqual([])
})

test('from a dirty Store, Leave goes to Orders with no bar, and Stay keeps the typed phone', async () => {
  const { page } = await open('/playground/settings/store', 360)
  await edit(page)
  const orders = page.locator('[slot="tabs"] > a').filter({ hasText: 'Orders' })
  await orders.click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => dialog(page).isVisible()).toBe(false)
  expect(await phone(page).inputValue()).toBe('01819556699')
  expect(path(page)).toBe('/playground/settings/store')
  await orders.click()
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => path(page)).toBe('/playground/orders')
  await page.locator('e-admin-panel').waitFor()
  expect(await bar(page).isVisible()).toBe(false)
})

test('a move between Settings pages asks too, and Leave swaps in the page it pointed at', async () => {
  const { page } = await open()
  await edit(page)
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('browser Back with the form dirty asks, and the address stays on Store', async () => {
  const { page } = await open('/playground/settings/payments')
  await settingsLink(page, 'Staff').click()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await edit(page)
  const entries = await page.evaluate(() => history.length)
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await heading(page)).toBe('Store')
  expect(await phone(page).inputValue()).toBe('01819556699')
  // Leave goes where Back pointed; one more Back goes to the page before, with no dialog and no
  // entry added on the way.
  await dialog(page).getByRole('button', { name: 'Leave' }).click()
  await expect.poll(() => heading(page)).toBe('Staff')
  expect(path(page)).toBe('/playground/settings/staff')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Payments')
  expect(await dialog(page).isVisible()).toBe(false)
  expect(await page.evaluate(() => history.length)).toBe(entries)
})

test('browser Forward with the form dirty asks too, and Stay keeps the page', async () => {
  const { page } = await open('/playground/settings/staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Staff')
  await page.goForward()
  await expect.poll(() => heading(page)).toBe('Store')
  await page.goBack()
  await expect.poll(() => heading(page)).toBe('Staff')
  await settingsLink(page, 'Store').click()
  await expect.poll(() => heading(page)).toBe('Store')
  await edit(page)
  await page.goBack()
  await expect.poll(() => dialog(page).isVisible()).toBe(true)
  await dialog(page).getByRole('button', { name: 'Stay on this page' }).click()
  await expect.poll(() => path(page)).toBe('/playground/settings/store')
  expect(await phone(page).inputValue()).toBe('01819556699')
})

test('a link to a place in the page keeps the panel and the edit, with no question', async () => {
  const { page } = await open()
  await edit(page)
  await page.evaluate(() => {
    const link = Object.assign(document.createElement('a'), { href: '#contact', textContent: 'To contact' })
    document.querySelector('e-admin-panel > header')!.append(link)
  })
  await page.getByText('To contact').click()
  await expect.poll(() => new URL(page.url()).hash).toBe('#contact')
  expect(await dialog(page).isVisible()).toBe(false)
  await page.goBack()
  await expect.poll(() => new URL(page.url()).hash).toBe('')
  expect(await phone(page).inputValue()).toBe('01819556699')
  expect(await dialog(page).isVisible()).toBe(false)
})

test('a reload of a dirty page asks the browser to prompt, and of a clean page does not', async () => {
  const { page } = await open()
  const prompts = () =>
    page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    })
  expect(await prompts()).toBe(false)
  await edit(page)
  expect(await prompts()).toBe(true)
})
