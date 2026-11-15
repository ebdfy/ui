// Save from the Admin's bar on an Admin page: Save, Ctrl+S and Enter post the Store form by fetch to
// the playground's fake, which answers the saved panel with its toast or the form with its errors.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(options: { lang?: 'en' | 'bn'; width?: number; fake?: string } = {}) {
  const { lang = 'en', width = 1440, fake } = options
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  const context = opened.page.context()
  await context.addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  if (fake) await context.addCookies([{ name: 'ebdfy-store-fake', value: fake, url: pages.ui }])
  const posts: string[] = []
  opened.page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url())
  })
  await opened.page.goto(`${pages.ui}/playground/settings/store`)
  await opened.page.locator('e-phone-field input').waitFor()
  return { ...opened, posts }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()
const phone = (page: Page) => page.locator('e-phone-field input')
const toast = (page: Page) => page.locator('e-admin-panel > .e-toast')
const dotColour = (page: Page) =>
  bar(page)
    .locator('.e-save-bar-dot')
    .evaluate((dot) => getComputedStyle(dot).backgroundColor)
const focusedName = (page: Page) => page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name)

test('pressing Ctrl+S sends one save, and pressing it again while that save waits sends nothing', async () => {
  const { page, posts } = await open({ fake: 'hang' })
  await phone(page).fill('01819556690')
  await page.keyboard.press('Control+s')
  await expect.poll(() => said(page)).toBe('Saving…')
  expect(
    await bar(page)
      .getByRole('button')
      .evaluateAll((all) => all.map((b) => (b as HTMLButtonElement).disabled)),
  ).toEqual([true, true])
  await page.keyboard.press('Control+s')
  await bar(page).getByRole('button', { name: 'Save' }).click({ force: true })
  await page.waitForTimeout(300)
  expect(posts).toEqual([`${pages.ui}/playground/settings/store`])
})

test('pressing Enter in Phone sends one save, and Enter in a text area adds a line and sends nothing', async () => {
  const { page, posts } = await open()
  await page.evaluate(() => {
    const note = document.createElement('textarea')
    note.name = 'note'
    document.querySelector('form[data-save-bar]')!.append(note)
  })
  await page.locator('textarea[name="note"]').fill('one')
  await page.locator('textarea[name="note"]').press('Enter')
  expect(await page.locator('textarea[name="note"]').inputValue()).toBe('one\n')
  await page.waitForTimeout(300)
  expect(posts).toEqual([])
  await phone(page).fill('01819556690')
  await phone(page).press('Enter')
  await expect.poll(() => toast(page).textContent()).toBe('Store saved')
  expect(posts).toHaveLength(1)
})

test('saving a 10-digit phone shows "Not saved: 1 field needs a fix" with the error and focus in Phone', async () => {
  const { page, posts } = await open()
  await phone(page).fill('0181955669')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  expect(await page.locator('e-phone-field').getAttribute('error')).toBeTruthy()
  expect(await focusedName(page)).toBe('contactPhone')
  expect(await phone(page).inputValue()).toBe('0181955669')
  // The browser's own check refused it, so nothing went out.
  expect(posts).toEqual([])
})

test('an empty Store name and an email with no domain read "Not saved: 2 fields need a fix", each put right in turn', async () => {
  const { page, posts } = await open()
  await page.locator('e-text-field[name="name"] input').fill('')
  await page.locator('e-text-field[name="contactEmail"] input').fill('jane@')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 2 fields need a fix')
  expect(await page.locator('e-text-field[name="name"]').getAttribute('error')).toBeTruthy()
  expect(await page.locator('e-text-field[name="contactEmail"]').getAttribute('error')).toBeTruthy()
  expect(await focusedName(page)).toBe('name')
  expect(posts).toEqual([])
  await page.locator('e-text-field[name="name"] input').fill('Demo shop')
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  await page.locator('e-text-field[name="contactEmail"] input').fill('jane@demo-shop.com')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
})

test("the Admin's refusal puts its error on the field being edited and keeps what was typed", async () => {
  const { page, posts } = await open()
  // A form the browser does not check, so only the Admin can refuse it.
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  await phone(page).fill('0181955669')
  const lime = await dotColour(page)
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  expect(posts).toHaveLength(1)
  expect(await page.locator('e-phone-field').getAttribute('error')).toBe(
    'Enter an 11-digit mobile number that starts with 01.',
  )
  expect(await focusedName(page)).toBe('contactPhone')
  expect(await phone(page).inputValue()).toBe('0181955669')
  // The dot turns from lime to orange.
  expect(await dotColour(page)).not.toBe(lime)
  // The answer's Bangla words for the error stay words for the field, not lines of a banner.
  expect(await page.locator('form > [data-e-form-errors]').count()).toBe(0)
})

test('in Bangla the refusal reads in Bangla', async () => {
  const { page } = await open({ lang: 'bn' })
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  await phone(page).fill('0181955669')
  await bar(page).getByRole('button', { name: 'সংরক্ষণ করুন' }).click()
  await expect.poll(() => said(page)).toBe('সংরক্ষণ হয়নি: ১টি ঘর ঠিক করুন')
  expect(await page.locator('e-phone-field').getAttribute('error')).toBe('০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর লিখুন।')
  expect(await page.locator('form > [data-e-form-errors]').count()).toBe(0)
})

test('in Bangla the saved toast reads in Bangla', async () => {
  const { page } = await open({ lang: 'bn' })
  await phone(page).fill('01819556690')
  await page.keyboard.press('Control+s')
  await expect.poll(() => toast(page).textContent()).toBe('স্টোর সংরক্ষিত হয়েছে')
})

test('saving "01819556690" shows the toast "Store saved" and lowers the bar', async () => {
  const { page } = await open()
  await phone(page).fill('01819556690')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => toast(page).textContent()).toBe('Store saved')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(await phone(page).inputValue()).toBe('01819556690')
  // The saved value is the one to go back to now.
  await phone(page).fill('01819556691')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect(await phone(page).inputValue()).toBe('01819556690')
})

test('a refused save, then the field put right, goes back to "Unsaved changes", then saves', async () => {
  const { page } = await open()
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  await phone(page).fill('0181955669')
  await page.keyboard.press('Control+s')
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  await phone(page).fill('01819556690')
  await expect.poll(() => said(page)).toBe('Unsaved changes')
  expect(await page.locator('e-phone-field').getAttribute('error')).toBeNull()
  await page.keyboard.press('Control+s')
  await expect.poll(() => toast(page).textContent()).toBe('Store saved')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test('after a refusal Discard puts back the saved phone, and typing the saved value lowers the bar', async () => {
  const { page } = await open()
  await page.evaluate(() =>
    document.querySelector<HTMLFormElement>('form[data-save-bar]')!.setAttribute('novalidate', ''),
  )
  await phone(page).fill('0181955669')
  await page.keyboard.press('Control+s')
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(await phone(page).inputValue()).toBe('01819556680')
  await phone(page).fill('0181955669')
  await page.keyboard.press('Control+s')
  await expect.poll(() => said(page)).toBe('Not saved: 1 field needs a fix')
  await phone(page).fill('01819556680')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
})

test("with JavaScript off the Store form has its own Save, which the bar's script takes away", async () => {
  const off = await pages.open('', 1440, { viewport: { width: 1440, height: 900 }, javaScriptEnabled: false })
  await off.page.goto(`${pages.ui}/playground/settings/store`)
  const native = off.page.locator('form[data-save-bar] > button[type="submit"]')
  expect(await native.isVisible()).toBe(true)
  await native.click()
  await off.page.waitForLoadState('load')
  expect(await off.page.locator('e-admin-panel').getAttribute('toast')).toBe('Store saved')
  const { page } = await open()
  expect(await page.locator('form[data-save-bar] > button[type="submit"]').isVisible()).toBe(false)
})
