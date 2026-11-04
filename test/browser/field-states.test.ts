// The eight fields' states in Ink: a hover edge, help text the control names, an error line led by
// an icon, and a disabled field that looks locked rather than faded.
import { afterEach, expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

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
  light: {
    control: 'oklch(0.645 0.006 85)',
    text3: 'oklch(0.54 0.008 85)',
    text2: 'oklch(0.47 0.008 85)',
    surface2: 'oklch(0.972 0.003 85)',
    divider: 'oklch(0.925 0.004 85)',
  },
  dark: {
    control: 'oklch(0.52 0.006 85)',
    text3: 'oklch(0.66 0.006 85)',
    text2: 'oklch(0.75 0.006 85)',
    surface2: 'oklch(0.245 0.004 85)',
    divider: 'oklch(0.285 0.005 85)',
  },
}

const danger = 'oklch(0.55 0.2 27)'

// The first path of Lucide's triangle-alert.
const triangle = 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'

afterEach(() => {
  document.body.innerHTML = ''
})

async function field(tag: string, attributes = ''): Promise<Upgraded> {
  document.body.innerHTML = `<${tag} label="Field" ${attributes}><option value="a">A</option></${tag}>`
  const el = document.querySelector<Upgraded>(tag)!
  await el.updateComplete
  return el
}

const control = (el: Upgraded) => el.shadowRoot.querySelector<HTMLElement>('.control')!

function edge(el: HTMLElement) {
  const match = getComputedStyle(el).boxShadow.match(/(oklch\([^)]+\)) 0px 0px 0px (\d+)px inset/)
  return { colour: match?.[1] ?? '', width: Number(match?.[2] ?? 0) }
}

const inTheme = <T>(theme: 'light' | 'dark', run: () => Promise<T>) => (theme === 'dark' ? inDark(run) : run())

for (const theme of ['light', 'dark'] as const) {
  const ink = themes[theme]

  test.for(tags)(`%s darkens its edge from control to text-3 on hover in ${theme}`, async (tag) => {
    const found = await inTheme(theme, async () => {
      const el = await field(tag)
      // The pointer may rest where the last test left it, on the control. Not on the label either:
      // hovering a label hovers its control.
      const away = document.createElement('div')
      away.style.height = '40px'
      document.body.append(away)
      await userEvent.hover(away)
      const rest = edge(control(el))
      await userEvent.hover(control(el))
      return { rest, hover: edge(control(el)) }
    })
    expect(found).toEqual({ rest: { colour: ink.control, width: 1 }, hover: { colour: ink.text3, width: 1 } })
  })

  test.for(tags)(`%s keeps its edge on hover while disabled or invalid in ${theme}`, async (tag) => {
    const found = await inTheme(theme, async () => {
      const disabled = await field(tag, 'disabled')
      await userEvent.hover(control(disabled))
      const locked = edge(control(disabled))
      const invalid = await field(tag, 'error="Enter a valid value."')
      await userEvent.hover(control(invalid))
      return { locked, invalid: edge(control(invalid)) }
    })
    expect(found).toEqual({ locked: { colour: ink.divider, width: 1 }, invalid: { colour: danger, width: 2 } })
  })

  test.for(tags)(`%s looks locked, not faded, while disabled in ${theme}`, async (tag) => {
    const found = await inTheme(theme, async () => {
      const el = await field(tag, 'disabled')
      const style = getComputedStyle(control(el))
      return {
        host: getComputedStyle(el).opacity,
        opacity: style.opacity,
        background: style.backgroundColor,
        edge: edge(control(el)),
        color: style.color,
      }
    })
    expect(found).toEqual({
      host: '1',
      opacity: '1',
      background: ink.surface2,
      edge: { colour: ink.divider, width: 1 },
      color: ink.text3,
    })
  })

  test.for(tags)(`%s shows its help in 13/20 text-2 under the control in ${theme}`, async (tag) => {
    const found = await inTheme(theme, async () => {
      const el = await field(tag, 'help="As it shows on the parcel"')
      const help = el.shadowRoot.querySelector<HTMLElement>('p[part="help"]')!
      const { color, fontSize, lineHeight } = getComputedStyle(help)
      return {
        id: help.id,
        text: help.textContent,
        below: help.getBoundingClientRect().top >= control(el).getBoundingClientRect().bottom,
        color,
        fontSize,
        lineHeight,
      }
    })
    expect(found).toEqual({
      id: 'help',
      text: 'As it shows on the parcel',
      below: true,
      color: ink.text2,
      fontSize: '13px',
      lineHeight: '20px',
    })
  })
}

test.for(tags)('%s is described by its help, then its error, and by nothing it lacks', async (tag) => {
  const bare = control(await field(tag))
  expect(bare.hasAttribute('aria-describedby')).toBe(false)

  const helped = control(await field(tag, 'help="As it shows on the parcel"'))
  expect(helped.getAttribute('aria-describedby')).toBe('help')
  await expect.element(helped).toHaveAccessibleDescription('As it shows on the parcel')

  const both = control(await field(tag, 'help="As it shows on the parcel" error="Enter a valid value."'))
  expect(both.getAttribute('aria-describedby')).toBe('help error')
  await expect.element(both).toHaveAccessibleDescription('As it shows on the parcel Enter a valid value.')

  const failed = control(await field(tag, 'error="Enter a valid value."'))
  expect(failed.getAttribute('aria-describedby')).toBe('error')
})

test.for(tags)('%s starts its error line with a 16 px triangle-alert on the same line', async (tag) => {
  const el = await field(tag, 'error="Enter a valid value."')
  const line = el.shadowRoot.querySelector<HTMLElement>('[part="error"]')!
  const icon = line.firstElementChild!
  const [box, drawn] = [line.getBoundingClientRect(), icon.getBoundingClientRect()]
  expect(icon.localName).toBe('svg')
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  expect(icon.querySelector('path')!.getAttribute('d')).toBe(triangle)
  expect([drawn.width, drawn.height]).toEqual([16, 16])
  expect([box.height, drawn.top - box.top, drawn.left - box.left]).toEqual([20, 2, 0])
  expect(line.textContent).toBe('Enter a valid value.')
})

test("the district picker's help describes the district, and the area keeps its own error", async () => {
  const el = await field('eb-district-picker', 'help="As it shows on the parcel"')
  const area = el.shadowRoot.querySelector<HTMLInputElement>('#area')!
  expect(control(el).getAttribute('aria-describedby')).toBe('help')
  expect(area.hasAttribute('aria-describedby')).toBe(false)
  el.setAttribute('area-error', 'Name the area.')
  await el.updateComplete
  expect(area.getAttribute('aria-describedby')).toBe('area-error')
  await expect.element(area).toHaveAccessibleDescription('Name the area.')
})
