// The playground's Settings > Store: an Admin page of the Admin's own, drawn straight in the panel
// with no iframe, as a form whose fields each have a name, in the Admin's language.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { sitePage } from '../../src/site-routes.ts'
import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function store(lang: 'en' | 'bn', width = 1440) {
  const opened = await pages.open('', width)
  await opened.page.context().addInitScript((chosen) => localStorage.setItem('ebdfy-playground-lang', chosen), lang)
  await opened.page.goto(`${pages.ui}/playground/settings/store`)
  // v2.js has built the form's controls once the phone field holds its input.
  await opened.page.locator('e-phone-field input').waitFor({ state: 'attached' })
  return opened
}

test('an Admin page is served at its own address, and app pages still open the playground', () => {
  expect(sitePage('ui', '/playground/settings/store')).toBeNull()
  expect(sitePage('ui', '/playground/orders')).toBe('/playground')
  expect(sitePage('ui', '/playground/orders/1042')).toBe('/playground')
})

test('the Store page under Settings is a form in the panel with every field named, and no app frame', async () => {
  const { page, errors } = await store('en')
  expect(await page.locator('e-admin-panel iframe').count()).toBe(0)
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('Store')
  const here = page.getByRole('navigation', { name: 'Settings' }).locator(':scope > a', { hasText: /^Store$/ })
  expect(await here.getAttribute('aria-current')).toBe('page')
  const fields = await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('e-admin-panel form')!
    return [...new FormData(form).keys()]
  })
  expect(fields).toEqual([
    'name',
    'contactEmail',
    'contactPhone',
    'address1',
    'address.district',
    'address.upazila',
    'timezone',
    'weightUnit',
    'confirmShopOrdersByHand',
  ])
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll('e-admin-panel form :is(input, select, textarea)')]
      .filter((control) => !control.getAttribute('name'))
      .map((control) => control.outerHTML.slice(0, 80)),
  )
  expect(unnamed).toEqual([])
  expect(errors).toEqual([])
})

test('in Bangla the page names its sections and fields in Bangla', async () => {
  const { page } = await store('bn')
  expect(await page.locator('e-admin-panel > header h1').textContent()).toBe('স্টোর')
  expect(await page.locator('e-text-field[name="name"] label').textContent()).toBe('স্টোরের নাম')
  expect(await page.locator('e-settings-section').first().getAttribute('heading')).toBe('স্টোরের তথ্য')
})

test('at 360 the page fits the phone with no sideways scroll', async () => {
  const { page } = await store('en', 360)
  const wide = await page.evaluate(() => {
    const scroller = document.querySelector('e-admin-panel > .admin-page')!
    return { page: document.documentElement.scrollWidth, panel: scroller.scrollWidth - scroller.clientWidth }
  })
  expect(wide).toEqual({ page: 360, panel: 0 })
})
