// Each docs example sits in one frame with its caption above and its own code below, and Copy
// copies the code or, refused, selects it. docs-snippets.test.ts checks the code against the demo.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

for (const width of [360, 1280]) {
  test(`at ${width} px each Button example sits in one frame, its caption above it and its code in Geist Mono`, async () => {
    const { page, errors } = await pages.open(`${pages.ui}/components/button`, width)
    await page.waitForFunction(() => document.querySelectorAll(':not(:defined)').length === 0)
    await page.evaluate(() => document.fonts.ready)
    const figures = await page.locator('#examples figure.example').evaluateAll((els) =>
      els.map((figure) => {
        const caption = figure.querySelector('figcaption')!.getBoundingClientRect()
        const frame = figure.querySelector('.frame')!
        const demo = getComputedStyle(figure.querySelector('.demo')!)
        const code = figure.querySelector('pre code')!
        return {
          captionAbove: caption.bottom <= frame.getBoundingClientRect().top,
          ring: getComputedStyle(frame).boxShadow,
          padding: demo.padding,
          gap: demo.gap,
          font: getComputedStyle(code).fontFamily.split(',')[0],
          // A face of that name the docs serve, loaded: check() alone says yes when there is none.
          loaded: [...document.fonts].some(
            (face) => face.family.replaceAll('"', '') === 'Geist Mono' && face.status === 'loaded',
          ),
          inside: frame.contains(code),
        }
      }),
    )
    expect(figures.length).toBeGreaterThanOrEqual(4)
    const divider = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue('--eb-color-divider').trim(),
    )
    for (const figure of figures) {
      expect(figure).toMatchObject({
        captionAbove: true,
        padding: '24px',
        gap: '12px',
        font: '"Geist Mono"',
        loaded: true,
        inside: true,
      })
      expect(figure.ring).toContain('0px 0px 0px 1px')
    }
    expect(divider).not.toBe('')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    expect(errors).toEqual([])
  })
}

test('the Sizes example shows its buttons as secondary buttons, each with its edge', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`, 1280)
  const sizes = page.locator('#examples figure', { has: page.locator('figcaption', { hasText: 'Sizes' }) })
  const variants = await sizes
    .locator('.demo eb-button')
    .evaluateAll((els) => els.map((el) => el.getAttribute('variant')))
  expect(variants).toEqual(['secondary', 'secondary', 'secondary'])
})

test('copy puts the code on the clipboard and says Copied', async () => {
  const { page } = await pages.open('', 1280)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: pages.ui })
  await page.goto(`${pages.ui}/components/button`)
  const figure = page.locator('#examples figure.example').first()
  const code = await figure.locator('pre code').textContent()
  await figure.getByRole('button', { name: 'Copy' }).click()
  await expect.poll(() => figure.locator('button.copy').textContent()).toBe('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code)
})

test('copy refused by the clipboard selects the code instead, and says so', async () => {
  const { page } = await pages.open('', 1280)
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () =>
      Promise.reject(new DOMException('Write permission denied.', 'NotAllowedError'))
  })
  await page.goto(`${pages.ui}/components/button`)
  const figure = page.locator('#examples figure.example').first()
  const code = await figure.locator('pre code').textContent()
  await figure.getByRole('button', { name: 'Copy' }).click()
  await expect.poll(() => figure.locator('button.copy').textContent()).toBe('Selected')
  expect(await page.evaluate(() => getSelection()?.toString())).toBe(code)
})
