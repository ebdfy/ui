// The text field's docs with JavaScript off: an input written inside its tag shows, and the sign-in
// example posts its email and password; with it on, each field posts once.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test.for([false, true])('with JavaScript %s the sign-in example shows its fields and posts each once', async (on) => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: on })
  await page.goto(`${pages.ui}/components/text-field`)
  const form = page.locator('form[action="/sign-in"]').first()
  const email = form.locator('input[name="email"]')
  const password = form.locator('input[name="password"]')
  expect(await email.isVisible()).toBe(true)
  expect(await password.isVisible()).toBe(true)
  // The error example shows its input before any script, its message under it.
  expect(await page.locator('e-text-field[error] > input[name="city"]').first().isVisible()).toBe(true)
  let body = ''
  await page.route('**/sign-in', async (route) => {
    body = route.request().postData() ?? ''
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Signed in</p>' })
  })
  await email.fill('rahim@example.com')
  await password.fill('secret12')
  await form.getByRole('button', { name: 'Log in' }).click()
  await expect.poll(() => body).not.toBe('')
  expect(body).toBe('email=rahim%40example.com&password=secret12')
})

// With JavaScript off no example draws a box a person cannot type in, and each form's submit is a button.
test('with JavaScript off every text field example holds its input, sign-in is named, and every form has a submit button', async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/text-field`)
  const found = await page.evaluate(() => ({
    empty: [...document.querySelectorAll('e-text-field')].filter((tag) => !tag.querySelector(':scope > input')).length,
    forms: [...document.querySelectorAll('form')].map((form) => form.querySelector('button[type="submit"]') !== null),
  }))
  expect(found).toEqual({ empty: 0, forms: [true, true] })
  const form = page.locator('form[action="/sign-in"]').first()
  expect(await form.getByRole('textbox', { name: 'Email' }).count()).toBe(1)
  expect(await form.getByLabel('Password').count()).toBe(1)
})
