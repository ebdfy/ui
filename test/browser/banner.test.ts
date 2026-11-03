import { expect, test } from 'vitest'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

async function banner(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-banner')!
  await el.updateComplete
  return el
}

function icon(el: HTMLElement): Element {
  return el.shadowRoot!.querySelector('[role="img"]')!
}

// What a banner paints, copied out of the live computed style.
function painted(el: HTMLElement) {
  const style = getComputedStyle(el)
  return { background: style.backgroundColor, shadow: style.boxShadow, colour: style.color }
}

const tokens = {
  light: {
    danger: { background: 'oklch(0.965 0.025 25)', edge: 'oklch(0.82 0.08 25)', colour: 'oklch(0.21 0.006 85)' },
    info: { background: 'oklch(0.972 0.003 85)', colour: 'oklch(0.47 0.008 85)' },
  },
  dark: {
    danger: { background: 'oklch(0.29 0.07 25)', edge: 'oklch(0.45 0.12 25)', colour: 'oklch(0.955 0.003 85)' },
    info: { background: 'oklch(0.23 0.004 85)', colour: 'oklch(0.75 0.006 85)' },
  },
}

async function check(theme: 'light' | 'dark') {
  const expected = tokens[theme]
  const danger = await banner('<eb-banner tone="danger">Pay by Friday</eb-banner>')
  const dangerPaint = painted(danger)
  const dangerPath = icon(danger).querySelector('path')!.getAttribute('d')!
  const info = await banner('<eb-banner tone="info">Pay by Friday</eb-banner>')
  const infoPaint = painted(info)
  const infoCircle = icon(info).querySelector('circle')!.getAttribute('r')
  return { expected, dangerPaint, dangerPath, infoPaint, infoCircle }
}

test('a danger banner is the danger soft background, its edge and a triangle, in light', async () => {
  const { expected, dangerPaint, dangerPath } = await check('light')
  expect(dangerPaint.background).toBe(expected.danger.background)
  expect(dangerPaint.shadow).toContain(`${expected.danger.edge} 0px 0px 0px 1px inset`)
  expect(dangerPath.startsWith('m21.73 18')).toBe(true)
  expect(contrast(dangerPaint.colour, dangerPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('a danger banner turns to the dark tokens in dark', async () => {
  const { expected, dangerPaint, dangerPath } = await inDark(() => check('dark'))
  expect(dangerPaint.background).toBe(expected.danger.background)
  expect(dangerPaint.shadow).toContain(`${expected.danger.edge} 0px 0px 0px 1px inset`)
  expect(dangerPath.startsWith('m21.73 18')).toBe(true)
  expect(contrast(dangerPaint.colour, dangerPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('an info banner is surface-2 with an info circle, in light', async () => {
  const { expected, infoPaint, infoCircle } = await check('light')
  expect(infoPaint.background).toBe(expected.info.background)
  expect(infoPaint.colour).toBe(expected.info.colour)
  expect(infoCircle).toBe('10')
  expect(contrast(infoPaint.colour, infoPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('an info banner turns to the dark tokens in dark', async () => {
  const { expected, infoPaint, infoCircle } = await inDark(() => check('dark'))
  expect(infoPaint.background).toBe(expected.info.background)
  expect(infoPaint.colour).toBe(expected.info.colour)
  expect(infoCircle).toBe('10')
  expect(contrast(infoPaint.colour, infoPaint.background)).toBeGreaterThanOrEqual(4.5)
})

test('a banner with no tone is info', async () => {
  const el = await banner('<eb-banner>Note</eb-banner>')
  expect(painted(el).background).toBe(tokens.light.info.background)
  expect(icon(el).querySelector('circle')!.getAttribute('r')).toBe('10')
})

test('the icon is named in the language around the banner', async () => {
  const en = await banner('<eb-banner tone="danger">Pay</eb-banner>')
  expect(icon(en).getAttribute('aria-label')).toBe('Warning')
  const bn = await banner('<div lang="bn"><eb-banner tone="danger">Pay</eb-banner></div>')
  expect(icon(bn).getAttribute('aria-label')).toBe('সতর্কতা')
  const note = await banner('<eb-banner>Pay</eb-banner>')
  expect(icon(note).getAttribute('aria-label')).toBe('Note')
  const tothya = await banner('<div lang="bn"><eb-banner>Pay</eb-banner></div>')
  expect(icon(tothya).getAttribute('aria-label')).toBe('তথ্য')
})

test('the slotted message is laid out beside the icon', async () => {
  const el = await banner('<eb-banner tone="danger">Pay by Friday</eb-banner>')
  const slot = el.shadowRoot!.querySelector('slot')!
  expect(slot.assignedNodes().length).toBe(1)
  const range = document.createRange()
  range.selectNodeContents(el)
  expect(range.getBoundingClientRect().width).toBeGreaterThan(24)
})
