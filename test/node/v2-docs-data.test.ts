// The Data group's docs pages: selection and bulk actions are documented and live on the Index
// table page, and the Table page points there for them.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('the Index table API lists the e-selection-change event and the bulk slot', async () => {
  const { page } = await pages.open(`${pages.ui}/components/index-table`, 360)
  const api = page.locator('section.api')
  expect(await api.locator('dt', { hasText: 'e-selection-change' }).count()).toBe(1)
  expect(await api.locator('dt', { hasText: /^bulk$/ }).count()).toBe(1)
})

test('ticking two rows of the Index table example shows 2 selected and the bulk actions at 360 px', async () => {
  const { page } = await pages.open(`${pages.ui}/components/index-table`, 360)
  const example = page.locator('figure.example').first()
  await example.getByRole('checkbox', { name: 'Select #1042' }).check()
  await example.getByRole('checkbox', { name: 'Select #1041' }).check()
  const bulk = example.locator('[slot="bulk"]')
  expect(await bulk.getByRole('status').textContent()).toBe('2 selected')
  expect(await bulk.isVisible()).toBe(true)
  expect(await bulk.getByRole('button').count()).toBeGreaterThanOrEqual(1)
})

test('the Table page links to the Index table page for selection', async () => {
  const { page } = await pages.open(`${pages.ui}/components/table`, 360)
  expect(await page.locator('p.lede a[href="/components/index-table"]').count()).toBe(1)
})
