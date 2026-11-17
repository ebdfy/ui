// The file field's docs with JavaScript off: every example shows the browser's own file input with
// its label, and the form posts the chosen file.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('with JavaScript off every file field example shows a native input under its label', async () => {
  const { page } = await pages.open('', 360, { javaScriptEnabled: false })
  await page.goto(`${pages.ui}/components/file-field`)
  const fields = await page.locator('e-file-field').all()
  expect(fields.length).toBeGreaterThanOrEqual(4)
  for (const field of fields) {
    const input = field.locator(':scope > input[type="file"]')
    expect(await input.isVisible()).toBe(true)
    expect(await input.getAttribute('name')).toBeTruthy()
    // The label is written, or drawn from the attribute above the input.
    const label = await field.evaluate(
      (tag) =>
        tag.querySelector(':scope > label')?.textContent ?? getComputedStyle(tag, '::before').content.slice(1, -1),
    )
    expect(label).toBe(await field.getAttribute('label'))
    const [top, input_] = await Promise.all([field.boundingBox(), input.boundingBox()])
    expect(input_!.y).toBeGreaterThan(top!.y + 10)
  }
  expect(await page.locator('e-file-field[error]').evaluate((tag) => getComputedStyle(tag, '::after').content)).toBe(
    '"Pick a .csv file"',
  )
})

test('with JavaScript on, the written label is the one label, and the row reads No file chosen', async () => {
  const { page } = await pages.open(`${pages.ui}/components/file-field`, 360)
  const first = page.locator('e-file-field').first()
  await expect.poll(() => first.locator('[data-part="chosen"]').textContent()).toBe('No file chosen')
  expect(await first.locator('label').count()).toBe(1)
  expect(await first.getByLabel('Products CSV').count()).toBe(1)
})
