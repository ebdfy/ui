// The eight fields in Ink: a control edge a person can see, the focus ring, and an error that keeps it.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

const tags = [
  'eb-text-field',
  'eb-text-area',
  'eb-select',
  'eb-search-field',
  'eb-date-field',
  'eb-phone-field',
  'eb-taka-field',
  'eb-district-picker',
]

const themes = {
  light: { bg: 'oklch(0.985 0.002 85)', focus: 'oklch(0.52 0.19 268)' },
  dark: { bg: 'oklch(0.16 0.004 85)', focus: 'oklch(0.74 0.13 268)' },
}

const danger = 'oklch(0.55 0.2 27)'

afterEach(async () => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('lang')
  await page.viewport(360, 800)
})

async function field(tag: string, attributes = ''): Promise<Upgraded> {
  document.body.innerHTML = `<${tag} label="Field" ${attributes}><option value="a">A</option></${tag}>`
  const el = document.querySelector<Upgraded>(tag)!
  await el.updateComplete
  return el
}

const control = (el: Upgraded) => el.shadowRoot.querySelector<HTMLElement>('.control')!

// The colour and width of the edge a control draws as an inset ring.
function edge(el: HTMLElement) {
  const shadow = getComputedStyle(el).boxShadow
  const match = shadow.match(/(oklch\([^)]+\)) 0px 0px 0px (\d+)px inset/)
  return { colour: match?.[1] ?? '', width: Number(match?.[2] ?? 0) }
}

async function inTheme<T>(theme: 'light' | 'dark', run: () => Promise<T>): Promise<T> {
  return theme === 'dark' ? inDark(run) : run()
}

for (const theme of ['light', 'dark'] as const) {
  for (const tag of tags) {
    test(`${tag} draws a 1 px control edge at 3:1 or more on the ${theme} page`, async () => {
      const found = await inTheme(theme, async () => edge(control(await field(tag))))
      expect(found.width).toBe(1)
      expect(contrast(found.colour, themes[theme].bg)).toBeGreaterThanOrEqual(3)
    })

    test(`${tag} with an error draws a 2 px danger edge, and its message at 4.5:1 on the ${theme} page`, async () => {
      const found = await inTheme(theme, async () => {
        const el = await field(tag, 'error="Enter a valid value."')
        const message = el.shadowRoot.querySelector('[part="error"]')!
        const { color, fontSize, lineHeight } = getComputedStyle(message)
        return { edge: edge(control(el)), color, fontSize, lineHeight }
      })
      expect(found.edge).toEqual({ colour: danger, width: 2 })
      expect(contrast(found.color, themes[theme].bg)).toBeGreaterThanOrEqual(4.5)
      expect([found.fontSize, found.lineHeight]).toEqual(['13px', '20px'])
    })

    test(`${tag} with an error keeps the focus ring beside the danger edge in ${theme}`, async () => {
      const found = await inTheme(theme, async () => {
        const el = await field(tag, 'error="Enter a valid value."')
        await userEvent.tab()
        const focused = el.shadowRoot.activeElement as HTMLElement
        const { outlineWidth, outlineStyle, outlineColor, outlineOffset } = getComputedStyle(focused)
        return {
          same: focused === control(el),
          edge: edge(focused),
          outlineWidth,
          outlineStyle,
          outlineColor,
          outlineOffset,
        }
      })
      expect(found.same).toBe(true)
      expect(found.edge).toEqual({ colour: danger, width: 2 })
      expect([found.outlineWidth, found.outlineStyle, found.outlineColor, found.outlineOffset]).toEqual([
        '2px',
        'solid',
        themes[theme].focus,
        '2px',
      ])
    })
  }
}

for (const tag of tags.filter((t) => t !== 'eb-text-area')) {
  test(`${tag} is 36 px tall on a 1280 px desktop and 44 px on a 360 px phone`, async () => {
    await page.viewport(1280, 800)
    const el = await field(tag)
    expect(control(el).getBoundingClientRect().height).toBe(36)
    await page.viewport(360, 800)
    expect(control(el).getBoundingClientRect().height).toBe(44)
  })
}

test('the taka field shows ৳ as a prefix in text-3 and the grouped digits in its input', async () => {
  document.documentElement.lang = 'bn'
  const el = await field('eb-taka-field', 'value="125000"')
  const prefix = el.shadowRoot.querySelector('[part="prefix"]')!
  expect(prefix.textContent).toBe('৳')
  expect(getComputedStyle(prefix).color).toBe('oklch(0.54 0.008 85)')
  expect(el.shadowRoot.querySelector('input')!.value).toBe('১,২৫,০০০')
  const [input, sign] = [control(el).getBoundingClientRect(), prefix.getBoundingClientRect()]
  expect(sign.left).toBeGreaterThan(input.left)
  expect(sign.right).toBeLessThan(input.left + 32)
})
