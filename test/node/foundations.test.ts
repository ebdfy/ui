import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const tokensSource = readFileSync(fileURLToPath(new URL('../../src/tokens.ts', import.meta.url)), 'utf8')
const lightBlock = tokensSource.slice(
  tokensSource.indexOf('const light = css`'),
  tokensSource.indexOf('const dark = css`'),
)
const colourTokens = [...lightBlock.matchAll(/(--eb-color-[\w-]+):/g)].map((match) => match[1]!)

for (const width of [360, 1280]) {
  test(`/foundations loads without errors or horizontal scroll at ${width} px`, async () => {
    const { page, errors } = await pages.open(`${pages.ui}/foundations`, width)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('h1').textContent()).toBe('Foundations')
    expect(errors).toEqual([])
  })
}

const swatchColour = (page: Awaited<ReturnType<typeof pages.open>>['page'], theme: string, token: string) =>
  page
    .locator(`[data-panel="${theme}"] [data-token="${token}"] .chip`)
    .evaluate((el) => getComputedStyle(el).backgroundColor)

for (const scheme of ['light', 'dark'] as const) {
  test(`the panels keep their own theme in a ${scheme} browser`, async () => {
    const { page } = await pages.open('')
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(`${pages.ui}/foundations`)
    expect(await swatchColour(page, 'light', '--eb-color-bg')).toBe('oklch(0.985 0.002 85)')
    expect(await swatchColour(page, 'dark', '--eb-color-bg')).toBe('oklch(0.16 0.004 85)')
  })
}

test('both panels hold a swatch for every colour token', async () => {
  expect(colourTokens.length).toBeGreaterThan(20)
  const { page } = await pages.open(`${pages.ui}/foundations`)
  for (const theme of ['light', 'dark']) {
    const shown = await page
      .locator(`[data-panel="${theme}"] [data-token]`)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-token')))
    expect(shown, theme).toEqual(colourTokens)
  }
})

const steps = [
  { step: 'caption', size: '12px', line: '16px' },
  { step: 'meta', size: '13px', line: '20px' },
  { step: 'body-desktop', size: '14px', line: '20px' },
  { step: 'body-phone', size: '15px', line: '24px' },
  { step: 'heading-3', size: '17px', line: '24px' },
  { step: 'heading-2', size: '22px', line: '32px' },
  { step: 'heading-1', size: '30px', line: '40px' },
]
const banglaLine = { 'heading-1': '42px' } as Record<string, string>

test('the type section shows the seven steps, Bangla never small or tight', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  const read = (step: string, lang: string) =>
    page.locator(`[data-step="${step}"] [data-sample="${lang}"]`).evaluate((el) => {
      const style = getComputedStyle(el)
      return { size: style.fontSize, line: style.lineHeight, lang: el.getAttribute('lang') }
    })
  expect(await page.locator('[data-step]').count()).toBe(7)
  for (const { step, size, line } of steps) {
    expect(await read(step, 'en'), step).toEqual({ size, line, lang: null })
    if (step === 'caption') {
      expect(await page.locator(`[data-step="${step}"] [data-sample="bn"]`).count()).toBe(0)
      continue
    }
    const bn = await read(step, 'bn')
    expect(bn, step).toEqual({ size, line: banglaLine[step] ?? line, lang: 'bn' })
    expect(Number.parseFloat(bn.size)).toBeGreaterThanOrEqual(13)
    expect(Number.parseFloat(bn.line)).toBeGreaterThanOrEqual(Number.parseFloat(bn.size) * 1.4)
  }
})

test('the 650 weight shows only at 22 px and up', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  const weights = (step: string) =>
    page
      .locator(`[data-step="${step}"] [data-weight]`)
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).fontWeight))
  expect(await weights('heading-3')).toEqual(['400', '500', '600'])
  expect(await weights('heading-2')).toEqual(['400', '500', '600', '650'])
  expect(await weights('heading-1')).toEqual(['400', '500', '600', '650'])
})

test('the depth cards take the three shadows and the icons draw at 16 and 20 px', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  await page.emulateMedia({ colorScheme: 'light' })
  const [one, two, three] = await page
    .locator('[data-depth]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow))
  expect(one).toBe('oklch(0.2 0.01 85 / 0.06) 0px 1px 2px 0px')
  expect(two).toBe('oklch(0.2 0.01 85 / 0.05) 0px 1px 2px 0px, oklch(0.2 0.01 85 / 0.07) 0px 4px 12px 0px')
  expect(three).toBe('oklch(0.2 0.01 85 / 0.06) 0px 2px 4px 0px, oklch(0.2 0.01 85 / 0.14) 0px 16px 40px 0px')
  expect(
    await page.locator('[data-depth]').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor)),
  ).toEqual(['oklch(1 0 0)', 'oklch(1 0 0)', 'oklch(1 0 0)'])

  for (const size of [16, 20]) {
    const widths = await page
      .locator(`[data-icon] svg[data-size="${size}"]`)
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width))
    expect(widths, `${size}`).toEqual([size, size, size, size])
  }
  expect(await page.locator('[data-icon]').evaluateAll((els) => els.map((el) => el.getAttribute('data-icon')))).toEqual(
    ['chevronLeft', 'chevronRight', 'image', 'close'],
  )
})

test('the page sets no colour literal of its own', () => {
  const html = readFileSync(fileURLToPath(new URL('../../site/ui/foundations.html', import.meta.url)), 'utf8')
  expect(html.match(/#[0-9a-f]{3,8}\b|oklch\(/gi)).toBeNull()
})
