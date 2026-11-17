// The rich text docs: with JavaScript off every editor example is a text area holding its HTML that
// posts it under its name; with it on, the same form posts the body once.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('with JavaScript off every rich text example shows a named text area holding its HTML, under its label', async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/rich-text`)
  const editors = await page.locator('e-rich-text').all()
  expect(editors.length).toBeGreaterThanOrEqual(4)
  for (const editor of editors) {
    const area = editor.locator('textarea')
    expect(await area.isVisible()).toBe(true)
    expect(await area.getAttribute('name')).toBeTruthy()
    expect((await area.boundingBox())!.height).toBeGreaterThanOrEqual(240)
    expect(await editor.evaluate((tag) => getComputedStyle(tag, '::before').content)).toBe(
      `"${await editor.getAttribute('label')}"`,
    )
    const error = await editor.getAttribute('error')
    if (error) expect(await editor.evaluate((tag) => getComputedStyle(tag, '::after').content)).toBe(`"${error}"`)
  }
})

test.for([false, true])('with JavaScript %s the page form posts the body under its name, once', async (on) => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: on })
  await page.goto(`${pages.ui}/components/rich-text`)
  const form = page.locator('form[action="/pages/delivery"]')
  let body = ''
  await page.route('**/pages/delivery', async (route) => {
    body = route.request().postData() ?? ''
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Saved</p>' })
  })
  if (on) await form.locator('[data-part="body"]').waitFor()
  await form.getByRole('button', { name: 'Save' }).click()
  await expect.poll(() => body).not.toBe('')
  const posted = new URLSearchParams(body)
  expect(posted.getAll('body')).toHaveLength(1)
  expect(posted.get('body')).toContain('<b>7 days</b>')
})
