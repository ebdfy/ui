// The staff initials open the user menu: who is signed in and their role, a two-part language
// control, Account and security, Switch store and Log out. And the frame's own rules for its top band
// reach only the frame's actions, never an [slot="actions"] of a part in the panel.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(path: string, { lang = 'en', width = 1440 } = {}) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  // Only the first load takes the test's language; later loads keep what the page stored.
  await opened.page.context().addInitScript((chosen) => {
    if (!localStorage.getItem('ebdfy-playground-lang')) localStorage.setItem('ebdfy-playground-lang', chosen)
  }, lang)
  await opened.page.goto(`${pages.ui}${path}`)
  return opened
}

const menu = (page: Page) => page.locator('#e-user')

test('the initials open a menu with the name, the role, the language control and the user items', async () => {
  const { page, errors } = await open('/playground')
  const initials = page.getByRole('button', { name: 'Rafiq Ahmed' })
  expect(await initials.textContent()).toBe('RA')
  await initials.click()
  await expect.poll(() => menu(page).isVisible()).toBe(true)
  expect(await menu(page).locator('.e-user-name').textContent()).toBe('Rafiq AhmedOwner')
  const language = menu(page).getByRole('group', { name: 'Language' })
  expect(await language.getByRole('button').allTextContents()).toEqual(['English', 'বাংলা'])
  expect(await language.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe('true')
  expect(await language.getByRole('button', { name: 'বাংলা' }).getAttribute('aria-pressed')).toBe('false')
  expect(await menu(page).getByRole('link').allTextContents()).toEqual([
    'Account and security',
    'Switch store',
    'Log out',
  ])
  // It opens under the initials, inside the window.
  const box = await menu(page).boundingBox()
  const button = await initials.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(button!.y + button!.height)
  expect(box!.x + box!.width).toBeLessThanOrEqual(1440)
  expect(errors).toEqual([])
})

test('a link of the user menu reached by Tab draws the focus ring, not only a faint fill', async () => {
  const { page } = await open('/playground')
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => menu(page).isVisible()).toBe(true)
  // Past English and বাংলা to the first link.
  for (const _ of [1, 2, 3]) await page.keyboard.press('Tab')
  const link = menu(page).getByRole('link', { name: 'Account and security' })
  expect(await link.evaluate((element) => element === document.activeElement)).toBe(true)
  expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid')
})

test('picking বাংলা turns the app page to bn at once', async () => {
  const { page } = await open('/playground')
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await menu(page).getByRole('button', { name: 'বাংলা' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('bn')
  // The pick closes the menu, and the control shows it the next time it opens.
  await expect.poll(() => menu(page).isVisible()).toBe(false)
  expect(await menu(page).locator('[data-lang="bn"]').getAttribute('aria-pressed')).toBe('true')
  expect(await page.locator('[slot="menu"] > a').first().textContent()).toBe('হোম')
})

test('picking বাংলা on an Admin page opens it again in bn', async () => {
  const { page } = await open('/playground/settings/staff')
  await page.getByRole('button', { name: 'Rafiq Ahmed' }).click()
  await Promise.all([page.waitForEvent('load'), menu(page).getByRole('button', { name: 'বাংলা' }).click()])
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('স্টাফ')
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('bn')
})

test('an e-button in a card header on an Admin page keeps its 32 px, not the frame 36 px', async () => {
  const { page } = await open('/playground/settings/store')
  await page.locator('e-phone-field input').waitFor({ state: 'attached' })
  const drawn = await page.evaluate(async () => {
    const card = document.createElement('e-card')
    card.setAttribute('heading', 'Pickup')
    card.innerHTML = '<e-button slot="actions">Edit</e-button><e-text>Mirpur</e-text>'
    document.querySelector('e-admin-panel form')!.prepend(card)
    await new Promise(requestAnimationFrame)
    const inner = card.querySelector('e-button > button')!
    return {
      height: Math.round(card.querySelector('e-button')!.getBoundingClientRect().height),
      wider: inner.getBoundingClientRect().width > 36,
      padded: getComputedStyle(inner).paddingInlineStart !== '0px',
    }
  })
  expect(drawn).toEqual({ height: 32, wider: true, padded: true })
})
