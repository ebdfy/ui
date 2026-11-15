// A form that makes a record names the bar's message and primary, and can add a second button; its
// Discard asks. Two bar forms on one page share the one bar.
import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function open(width = 1440) {
  const opened = await pages.open('', width, { viewport: { width, height: 900 } })
  await opened.page.context().addInitScript(() => localStorage.setItem('ebdfy-playground-lang', 'en'))
  const posts: string[] = []
  opened.page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.postData() ?? '')
  })
  await opened.page.goto(`${pages.ui}/playground/settings/store`)
  await opened.page.locator('e-phone-field input').waitFor()
  return { ...opened, posts }
}

const bar = (page: Page) => page.locator('e-admin-frame > .e-save-bar')
const said = (page: Page) => bar(page).locator('.e-save-bar-message > span:visible').textContent()

// A new order's form in place of the Store form, as the Admin's Create order page draws it.
async function createOrder(page: Page) {
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('form[data-save-bar]')!
    form.innerHTML = `<e-text-field name="customer" label="Customer"></e-text-field>
      <button type="submit" name="intent" value="draft" data-save-bar-button hidden>Save as draft</button>`
    form.dataset.saveLabel = 'Create order'
    form.dataset.saveMessage = 'Unsaved order'
    form.dataset.saveDiscard = 'Discard this new order?'
    form.action = '/dev/nowhere'
  })
  await page.locator('e-text-field[name="customer"] input').fill('Rahima Akter')
  await expect.poll(() => bar(page).isVisible()).toBe(true)
}

test('a create form shows its message, "Save as draft" and "Create order" in the bar at 1440 px', async () => {
  const { page } = await open()
  await createOrder(page)
  expect(await said(page)).toBe('Unsaved order')
  expect(await bar(page).getByRole('button').allTextContents()).toEqual(['Discard', 'Save as draft', 'Create order'])
})

test("a create form's second button submits the form with its own name and value", async () => {
  const { page, posts } = await open()
  await page.route('**/dev/nowhere', (route) => route.fulfill({ status: 409, body: '' }))
  await createOrder(page)
  await bar(page).getByRole('button', { name: 'Save as draft' }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toContain('name="intent"\r\n\r\ndraft')
})

test('under 1040 px a create form reads "Not saved yet", with no second button', async () => {
  const { page } = await open(360)
  await createOrder(page)
  expect(await said(page)).toBe('Not saved yet')
  expect(await bar(page).getByRole('button', { name: 'Save as draft' }).isVisible()).toBe(false)
  expect(await bar(page).getByRole('button', { name: 'Create order' }).isVisible()).toBe(true)
})

test("a create form's Discard asks first, and Keep editing keeps what was typed", async () => {
  const { page } = await open()
  await createOrder(page)
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  const dialog = page.locator('dialog.e-leave')
  await expect.poll(() => dialog.isVisible()).toBe(true)
  expect(await dialog.locator('h2').textContent()).toBe('Discard this new order?')
  await dialog.getByRole('button', { name: 'Keep editing' }).click()
  expect(await page.locator('e-text-field[name="customer"] input').inputValue()).toBe('Rahima Akter')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await dialog.getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(await page.locator('e-text-field[name="customer"] input').inputValue()).toBe('')
})

test('with two dirty bar forms, Save submits both in page order and Discard restores both', async () => {
  const { page, posts } = await open()
  await page.evaluate(() => {
    const second = document.createElement('form')
    second.method = 'post'
    second.action = '/playground/settings/store'
    second.dataset.saveBar = ''
    second.innerHTML = '<e-text-field name="note" label="Note" value="first"></e-text-field>'
    document.querySelector('form[data-save-bar]')!.after(second)
  })
  await page.locator('e-text-field[name="note"] input').waitFor()
  await page.locator('e-phone-field input').fill('01819556690')
  await page.locator('e-text-field[name="note"] input').fill('second')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  expect(await page.locator('e-phone-field input').inputValue()).toBe('01819556680')
  expect(await page.locator('e-text-field[name="note"] input').inputValue()).toBe('first')
  await page.locator('e-phone-field input').fill('01819556690')
  await page.locator('e-text-field[name="note"] input').fill('second')
  await bar(page).getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => posts.length).toBe(2)
  expect(posts[0]).toContain('01819556690')
  expect(posts[1]).toContain('second')
  await expect.poll(() => bar(page).isVisible()).toBe(false)
  // Both stay as saved, the second form too.
  expect(await page.locator('e-text-field[name="note"] input').inputValue()).toBe('second')
})
