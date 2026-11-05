// What a thumb meets on v2's docs at 360 px: a switch that turns anywhere on its 44 px row, a header
// on one row, and links on the overview at least 44 px each way.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

test('a tap 21 px above or below a switch’s label turns it, on a phone', async () => {
  const { page } = await pages.open('', 360, { hasTouch: true, isMobile: true })
  await page.goto(`${pages.ui}/components/switch`)
  const tag = page.locator('figure.example e-switch:not([disabled])').first()
  await tag.locator('input').waitFor()
  const checked = () => tag.locator('input').evaluate((input: HTMLInputElement) => input.checked)
  const box = (await tag.locator('label').boundingBox())!
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  for (const dy of [-21, 21]) {
    const before = await checked()
    await page.touchscreen.tap(middle.x, middle.y + dy)
    await expect.poll(checked).toBe(!before)
  }
})

test.for(['en', 'bn'])('the header stays one row at 360 px in %s', async (lang) => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 360)
  await page.waitForFunction(() => document.querySelector('.bar .tools:not([hidden])'))
  if (lang === 'bn') await page.getByRole('button', { name: 'বাংলা' }).click()
  expect((await page.locator('.bar').boundingBox())?.height).toBe(56)
  const tops = await page
    .locator('.bar e-button')
    .evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)))
  expect(new Set(tops).size).toBe(1)
})

test('every link on the overview is a 44 px target', async () => {
  const { page } = await pages.open(`${pages.ui}/`, 360)
  const small = await page.locator('main a').evaluateAll((links) =>
    links
      .map((link) => ({ text: link.textContent, box: link.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ text, box }) => `${text}: ${Math.round(box.width)} x ${Math.round(box.height)}`),
  )
  expect(small).toEqual([])
})
