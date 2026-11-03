import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

// A file's tests share one Chromium, so a page left open holds its memory until the file ends:
// docs-scan's 306 pages took 9 GB, more than the release runner has.
test('a page opened in a test', async () => {
  await pages.open('')
  expect(pages.openContexts()).toBe(1)
})

test('is closed once that test ends', () => {
  expect(pages.openContexts()).toBe(0)
})
