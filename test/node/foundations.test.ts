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
const block = (from: string, to: string) => tokensSource.slice(tokensSource.indexOf(from), tokensSource.indexOf(to))
const valuesIn = (css: string) =>
  Object.fromEntries([...css.matchAll(/(--eb-color-[\w-]+): ([^;]+);/g)].map((match) => [match[1]!, match[2]!]))
const lightValues = valuesIn(block('const light = css`', 'const dark = css`'))
const darkValues = valuesIn(block('const dark = css`', 'const aliases = css`'))
const colourTokens = Object.keys(lightValues)

for (const width of [360, 1280]) {
  test(`/foundations loads without errors or horizontal scroll at ${width} px`, async () => {
    const { page, errors } = await pages.open(`${pages.ui}/foundations`, width)
    await page.waitForLoadState('networkidle')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('h1').textContent()).toBe('Foundations')
    expect(errors).toEqual([])
  })
}

type Row = { token: string; light: string; dark: string; contrast: string; use: string; chips: string[] }

const readRows = (page: Awaited<ReturnType<typeof pages.open>>['page']) =>
  page.locator('#colour tbody tr').evaluateAll((rows) =>
    rows.map((row) => {
      const text = (selector: string) => row.querySelector(selector)?.textContent?.trim() ?? ''
      return {
        token: text('[data-cell="token"]'),
        light: text('[data-cell="light"]'),
        dark: text('[data-cell="dark"]'),
        contrast: text('[data-cell="contrast"]'),
        use: text('[data-cell="use"]'),
        chips: [...row.querySelectorAll('.chip')].map((chip) => getComputedStyle(chip).backgroundColor),
      }
    }),
  )

for (const scheme of ['light', 'dark'] as const) {
  test(`in a ${scheme} browser the colour table shows each token's light and dark value, swatch, contrast and use`, async () => {
    expect(colourTokens.length).toBeGreaterThan(20)
    const { page } = await pages.open('', 1280)
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto(`${pages.ui}/foundations`)
    await page.locator('#colour tbody tr [data-cell="contrast"]:not(:empty)').first().waitFor()
    const rows: Row[] = await readRows(page)
    expect(rows.map((row) => row.token)).toEqual(colourTokens)
    for (const row of rows) {
      expect(row.light, row.token).toBe(lightValues[row.token])
      expect(row.dark, row.token).toBe(darkValues[row.token])
      expect(row.use, row.token).not.toBe('')
      expect(row.contrast, row.token).toMatch(/^\d+\.\d\d:1 · \d+\.\d\d:1$/)
    }
    const byToken = Object.fromEntries(rows.map((row) => [row.token, row]))
    expect(byToken['--eb-color-bg']!.chips).toEqual(['oklch(0.985 0.002 85)', 'oklch(0.16 0.004 85)'])
    expect(byToken['--eb-color-bg']!.contrast).toBe('1.00:1 · 1.00:1')
    const [light, dark] = byToken['--eb-color-text']!.contrast.split(' · ').map((ratio) => Number.parseFloat(ratio))
    expect(light).toBeGreaterThan(14)
    expect(dark).toBeGreaterThan(14)
  })
}

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

test('the depth cards take the three shadows', async () => {
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
})

const iconsSource = readFileSync(fileURLToPath(new URL('../../src/icons.ts', import.meta.url)), 'utf8')
// The keys of the icons record: a name and a colon, or a name on its own (image, info).
const iconNames = [
  ...iconsSource.slice(iconsSource.indexOf('export const icons = {')).matchAll(/^ {2}'?([\w-]+)'?(?::|,$)/gm),
].map((match) => match[1]!)

test('the icon section shows every eb-icon at 16 and 20 px, by name', async () => {
  expect(iconNames.length).toBeGreaterThanOrEqual(40)
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  await page.locator('#icons eb-icon:defined').first().waitFor()
  const shown = await page.locator('#icons [data-icon]').evaluateAll((figures) =>
    figures.map((figure) => ({
      name: figure.getAttribute('data-icon'),
      widths: [...figure.querySelectorAll('eb-icon')].map(
        (el) => el.shadowRoot!.querySelector('svg')?.getBoundingClientRect().width,
      ),
      caption: figure.querySelector('code')?.textContent,
    })),
  )
  expect(shown.map((icon) => icon.name)).toEqual(iconNames)
  for (const icon of shown) expect(icon, icon.name!).toEqual({ name: icon.name, widths: [16, 20], caption: icon.name })
})

test('the tone section lists the five tones, the order statuses and the 1.0.0 names', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  await page.locator('#tones eb-badge:defined').first().waitFor()
  const tones = await page
    .locator('#tones [data-tone]')
    .evaluateAll((rows) =>
      rows.map((row) => [row.getAttribute('data-tone'), row.querySelector('eb-badge')?.getAttribute('tone')]),
    )
  expect(tones).toEqual([
    ['neutral', 'neutral'],
    ['info', 'info'],
    ['success', 'success'],
    ['warning', 'warning'],
    ['danger', 'danger'],
  ])
  const statuses = await page
    .locator('#tones [data-status]')
    .evaluateAll((rows) =>
      rows.map((row) => [row.getAttribute('data-status'), row.querySelector('eb-badge')?.getAttribute('status')]),
    )
  expect(statuses).toEqual([
    ['new', 'new'],
    ['confirmed', 'confirmed'],
    ['shipped', 'shipped'],
    ['paid', 'paid'],
    ['returned', 'returned'],
  ])
  const text = await page.locator('#tones').innerText()
  for (const name of ['attention', 'critical', 'shipped', 'default']) expect(text).toContain(name)
})

test('the motion section shows each motion token with its value', async () => {
  const { page } = await pages.open(`${pages.ui}/foundations`, 1280)
  await page.locator('#motion [data-cell="value"]:not(:empty)').first().waitFor()
  const rows = await page
    .locator('#motion [data-token]')
    .evaluateAll((rows) =>
      rows.map((row) => [
        row.getAttribute('data-token'),
        row.querySelector('[data-cell="value"]')?.textContent?.trim(),
      ]),
    )
  expect(rows).toEqual([
    ['--eb-duration-fast', '120ms'],
    ['--eb-duration-base', '200ms'],
    ['--eb-ease-out', 'cubic-bezier(0.2, 0.8, 0.2, 1)'],
  ])
})

test('the page sets no colour literal of its own', () => {
  const html = readFileSync(fileURLToPath(new URL('../../site/ui/foundations.html', import.meta.url)), 'utf8')
  expect(html.match(/#[0-9a-f]{3,8}\b|oklch\(/gi)).toBeNull()
})
