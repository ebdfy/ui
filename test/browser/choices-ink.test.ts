// The checkbox, radios and switch in Ink: a visible edge, the primary fill, the indeterminate dash, the focus ring.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

type Upgraded = HTMLElement & {
  updateComplete: Promise<unknown>
  shadowRoot: ShadowRoot
  checked: boolean
  indeterminate: boolean
}

const themes = {
  light: {
    bg: 'oklch(0.985 0.002 85)',
    primary: 'oklch(0.21 0.006 85)',
    onPrimary: 'oklch(0.99 0 0)',
    focus: 'oklch(0.52 0.19 268)',
  },
  dark: {
    bg: 'oklch(0.16 0.004 85)',
    primary: 'oklch(0.955 0.003 85)',
    onPrimary: 'oklch(0.17 0.004 85)',
    focus: 'oklch(0.74 0.13 268)',
  },
}

afterEach(async () => {
  document.body.innerHTML = ''
  await page.viewport(360, 800)
})

async function mount(markup: string): Promise<Upgraded> {
  document.body.innerHTML = markup
  const el = document.body.firstElementChild as Upgraded
  await el.updateComplete
  return el
}

const input = (el: Upgraded) => el.shadowRoot.querySelector('input')!

function edge(el: HTMLElement) {
  const match = getComputedStyle(el).boxShadow.match(/(oklch\([^)]+\)) 0px 0px 0px (\d+)px inset/)
  return { colour: match?.[1] ?? '', width: Number(match?.[2] ?? 0) }
}

async function inTheme<T>(theme: 'light' | 'dark', run: () => Promise<T>): Promise<T> {
  return theme === 'dark' ? inDark(run) : run()
}

const choices = '<eb-choice-list label="Pick"><option value="a">A</option><option value="b">B</option></eb-choice-list>'

for (const theme of ['light', 'dark'] as const) {
  test(`an unchecked checkbox and radio draw an edge at 3:1 or more on the ${theme} page`, async () => {
    const found = await inTheme(theme, async () => {
      const box = await mount('<eb-checkbox label="Agree"></eb-checkbox>')
      const checkbox = edge(input(box))
      const radio = edge(input(await mount(choices)))
      return { checkbox, radio }
    })
    for (const one of [found.checkbox, found.radio]) {
      expect(one.width).toBe(1)
      expect(contrast(one.colour, themes[theme].bg)).toBeGreaterThanOrEqual(3)
    }
  })

  test(`a checked checkbox is the primary fill with an on-primary mark in ${theme}`, async () => {
    const found = await inTheme(theme, async () => {
      const el = await mount('<eb-checkbox label="Agree" checked></eb-checkbox>')
      return {
        background: getComputedStyle(input(el)).backgroundColor,
        mark: getComputedStyle(input(el), '::before').backgroundColor,
      }
    })
    expect(found).toEqual({ background: themes[theme].primary, mark: themes[theme].onPrimary })
  })

  test(`a checked radio is an on-primary dot in a primary ring in ${theme}`, async () => {
    const found = await inTheme(theme, async () => {
      const el = await mount(choices.replace('<eb-choice-list', '<eb-choice-list value="a"'))
      const { backgroundColor, boxShadow } = getComputedStyle(input(el))
      return { backgroundColor, boxShadow }
    })
    expect(found.backgroundColor).toBe(themes[theme].onPrimary)
    expect(found.boxShadow).toContain(`${themes[theme].primary} 0px 0px 0px 5px inset`)
  })

  test(`a switch is the primary fill when on, in ${theme}`, async () => {
    const background = await inTheme(theme, async () => {
      const el = await mount('<eb-switch label="Alerts" checked></eb-switch>')
      return getComputedStyle(input(el)).backgroundColor
    })
    expect(background).toBe(themes[theme].primary)
  })

  for (const [name, markup] of [
    ['checkbox', '<eb-checkbox label="Agree"></eb-checkbox>'],
    ['radio', choices],
    ['switch', '<eb-switch label="Alerts"></eb-switch>'],
  ] as const) {
    test(`the ${name} shows the focus ring under Tab in ${theme}`, async () => {
      const found = await inTheme(theme, async () => {
        const el = await mount(markup)
        await userEvent.tab()
        const focused = el.shadowRoot.activeElement as HTMLElement
        const { outlineWidth, outlineStyle, outlineColor, outlineOffset } = getComputedStyle(focused)
        return { same: focused === input(el), ring: [outlineWidth, outlineStyle, outlineColor, outlineOffset] }
      })
      expect(found.same).toBe(true)
      expect(found.ring).toEqual(['2px', 'solid', themes[theme].focus, '2px'])
    })
  }
}

test('an indeterminate checkbox shows a dash, says mixed, and a click makes it checked', async () => {
  const el = await mount('<eb-checkbox indeterminate label="All"></eb-checkbox>')
  expect(input(el).getAttribute('aria-checked')).toBe('mixed')
  expect(input(el).indeterminate).toBe(true)
  const dash = getComputedStyle(input(el), '::before')
  expect(Number.parseFloat(dash.width)).toBeGreaterThan(Number.parseFloat(dash.height))
  expect(Number.parseFloat(dash.height)).toBeGreaterThan(0)

  await userEvent.click(input(el))
  await el.updateComplete
  expect(el.checked).toBe(true)
  expect(el.indeterminate).toBe(false)
  expect(input(el).hasAttribute('aria-checked')).toBe(false)
})

test('a switch is a 32 by 20 track in a 44 px row on a phone', async () => {
  const el = await mount('<eb-switch label="Alerts"></eb-switch>')
  const track = input(el).getBoundingClientRect()
  expect([track.width, track.height]).toEqual([32, 20])
  expect(el.shadowRoot.querySelector('.row')!.getBoundingClientRect().height).toBe(44)
})

test('a row is 36 px on a desktop', async () => {
  await page.viewport(1280, 800)
  const el = await mount('<eb-checkbox label="Agree"></eb-checkbox>')
  expect(el.shadowRoot.querySelector('.row')!.getBoundingClientRect().height).toBe(36)
})

test('a box that is both checked and indeterminate is checked after a click, not cleared', async () => {
  const el = await mount('<eb-checkbox indeterminate checked label="All"></eb-checkbox>')
  await userEvent.click(input(el))
  await el.updateComplete
  expect(el.checked).toBe(true)
  expect(el.indeterminate).toBe(false)
  expect(input(el).checked).toBe(true)
})
