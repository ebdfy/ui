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

// A report not saved yet, as the Admin's New report page draws it: the bar shows before any change.
async function newReport(page: Page) {
  await page.evaluate(() => {
    const old = document.querySelector<HTMLFormElement>('form[data-save-bar]')!
    const form = document.createElement('form')
    form.method = 'post'
    form.action = '/dev/nowhere'
    form.dataset.saveBar = ''
    form.dataset.saveNew = ''
    form.dataset.saveMessage = 'Not saved yet'
    form.dataset.saveLabel = 'Save report'
    form.innerHTML = '<e-text-field name="name" label="Name" value="Facebook by district"></e-text-field>'
    old.replaceWith(form)
  })
}

test('a form not saved yet shows its bar before any change, and Save sends it untouched', async () => {
  const { page, posts } = await open()
  await page.route('**/dev/nowhere', (route) => route.fulfill({ status: 409, body: '' }))
  await newReport(page)
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  expect(await said(page)).toBe('Not saved yet')
  await bar(page).getByRole('button', { name: 'Save report' }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toContain('Facebook by district')
})

test('Discard on a form not saved yet puts its values back, tells the form, and the bar stays', async () => {
  const { page } = await open()
  await newReport(page)
  await page.evaluate(() =>
    document.querySelector('form[data-save-bar]')!.addEventListener('e-save-discarded', () => {
      document.body.dataset.discarded = 'yes'
    }),
  )
  await page.locator('e-text-field[name="name"] input').fill('Something else')
  await bar(page).getByRole('button', { name: 'Discard' }).click()
  expect(await page.locator('e-text-field[name="name"] input').inputValue()).toBe('Facebook by district')
  expect(await page.locator('body').getAttribute('data-discarded')).toBe('yes')
  // Past the bar's 200 ms fade, so a hidden bar would read as hidden.
  await page.waitForTimeout(400)
  expect(await bar(page).isVisible()).toBe(true)
  expect(await said(page)).toBe('Not saved yet')
  // A later edit still saves from the bar.
  await page.locator('e-text-field[name="name"] input').fill('Facebook by district')
  expect(await bar(page).getByRole('button', { name: 'Save report' }).isVisible()).toBe(true)
})

test('leaving an untouched form not saved yet asks nothing, and an edited one asks', async () => {
  const { page } = await open()
  await newReport(page)
  await expect.poll(() => bar(page).isVisible()).toBe(true)
  await page.locator('nav[slot="menu"] a', { hasText: 'Staff' }).click()
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Staff')
  await page.goBack()
  await expect.poll(() => page.locator('e-admin-panel > header h1').textContent()).toBe('Store')
  await newReport(page)
  await page.locator('e-text-field[name="name"] input').fill('Something else')
  await page.locator('nav[slot="menu"] a', { hasText: 'Staff' }).click()
  await expect.poll(() => page.locator('dialog.e-leave').isVisible()).toBe(true)
})
