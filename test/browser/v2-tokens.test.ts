// Midnight's colour tokens: every text colour keeps 4.5:1 on what it is drawn on, in light and in
// dark. test/node/v2-theme.test.ts checks the theme follows the device.
import { expect, test } from 'vitest'

import '../../src/v2.css'
import { contrast, inDark } from './colour.ts'

// Each text token and the backgrounds it is drawn on.
const pairs: [text: string, grounds: string[]][] = [
  ['fg', ['surface', 'surface-2', 'panel']],
  ['fg2', ['surface', 'surface-2', 'panel']],
  ['fg3', ['surface', 'surface-2', 'panel']],
  ['accent', ['surface', 'panel']],
  ['primary-fg', ['primary']],
  ['side-fg', ['frame']],
  ['side-on-fg', ['side-on-bg']],
  ['frame-fg', ['frame', 'frame-field']],
  ['frame-fg2', ['frame', 'frame-field']],
  ['new-fg', ['new-bg']],
  ['confirmed-fg', ['confirmed-bg']],
  ['courier-fg', ['courier-bg']],
  ['delivered-fg', ['delivered-bg']],
  ['returned-fg', ['returned-bg']],
  ['neutral-fg', ['neutral-bg']],
  ['danger', ['surface', 'danger-soft']],
  ['warn-fg', ['surface', 'warn-soft']],
  ['lime-fg', ['lime']],
]

// A token's computed colour, read through an element so var() and the theme resolve.
function colour(name: string): string {
  const probe = document.createElement('div')
  probe.style.color = `var(--e-color-${name})`
  document.body.append(probe)
  const value = getComputedStyle(probe).color
  probe.remove()
  return value
}

function lowPairs(): string[] {
  const low: string[] = []
  for (const [text, grounds] of pairs) {
    for (const ground of grounds) {
      const fg = colour(text)
      const bg = colour(ground)
      if (!fg.startsWith('oklch(') || !bg.startsWith('oklch(')) low.push(`${text} on ${ground}: no token`)
      else if (contrast(fg, bg) < 4.5) low.push(`${text} on ${ground}: ${contrast(fg, bg).toFixed(2)}`)
    }
  }
  return low
}

test('in light every text token is at least 4.5:1 on its grounds', () => {
  expect(lowPairs()).toEqual([])
})

test('in dark every text token is at least 4.5:1 on its grounds', async () => {
  expect(await inDark(async () => lowPairs())).toEqual([])
})

test('the frame is navy and the panel light in light; in dark the primary is lime', async () => {
  expect([colour('frame'), colour('panel'), colour('primary')]).toEqual([
    'oklch(0.22 0.03 262)',
    'oklch(0.968 0.004 262)',
    'oklch(0.25 0.04 262)',
  ])
  expect(await inDark(async () => [colour('frame'), colour('panel'), colour('primary')])).toEqual([
    'oklch(0.115 0.02 262)',
    'oklch(0.165 0.02 262)',
    'oklch(0.89 0.17 125)',
  ])
})

// A token's value as written, read from the root, where the theme's block sets it.
const value = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

test("the shapes and type are the revised look's", () => {
  const names = [
    '--e-radius-0',
    '--e-radius-2',
    '--e-radius-badge',
    '--e-size-button',
    '--e-size-row',
    '--e-space-8',
    '--e-font-size-caption',
    '--e-font-size-title',
    '--e-font-size-section',
    '--e-font-size-display',
    '--e-font-weight-bold',
    '--e-page-width',
    '--e-page-width-form',
    '--e-ease',
    '--e-time-1',
    '--e-time-2',
  ]
  expect(Object.fromEntries(names.map((name) => [name, value(name)]))).toEqual({
    '--e-radius-0': '5px',
    '--e-radius-2': '12px',
    '--e-radius-badge': '6px',
    '--e-size-button': '32px',
    '--e-size-row': '44px',
    '--e-space-8': '32px',
    '--e-font-size-caption': '12px',
    '--e-font-size-title': '14px',
    '--e-font-size-section': '16px',
    '--e-font-size-display': '26px',
    '--e-font-weight-bold': '650',
    '--e-page-width': '1040px',
    '--e-page-width-form': '960px',
    '--e-ease': 'cubic-bezier(0.2, 0, 0, 1)',
    '--e-time-1': '120ms',
    '--e-time-2': '200ms',
  })
})

test('a caption is 12 px in English and 13 px in Bangla', () => {
  document.body.innerHTML = '<p>Status</p><p lang="bn">অবস্থা</p>'
  const sizes = [...document.querySelectorAll('p')].map((p) => {
    p.style.fontSize = 'var(--e-font-size-caption)'
    return getComputedStyle(p).fontSize
  })
  document.body.replaceChildren()
  expect(sizes).toEqual(['12px', '13px'])
})

test('the new colours and shadows are set in light and in dark', async () => {
  const names = [
    '--e-color-surface-3',
    '--e-color-danger',
    '--e-color-danger-soft',
    '--e-color-warn-fg',
    '--e-color-warn-soft',
    '--e-color-lime',
    '--e-color-lime-fg',
    '--e-color-frame-line',
    '--e-shadow-card',
    '--e-shadow-raised',
    '--e-shadow-pop',
  ]
  const unset = () => names.filter((name) => value(name) === '')
  expect(unset()).toEqual([])
  expect(await inDark(async () => unset())).toEqual([])
  // Dark sets its own, not light's carried over.
  const light = names.map(value)
  expect(await inDark(async () => names.filter((name, index) => value(name) === light[index]))).toEqual([
    '--e-color-lime',
    '--e-color-lime-fg',
  ])
})

test("the panel, lines and quiet text are review's values in light", () => {
  expect(['surface-2', 'surface-3', 'line', 'line-2', 'fg2', 'fg3'].map(colour)).toEqual([
    'oklch(0.975 0.004 262)',
    'oklch(0.95 0.006 262)',
    'oklch(0.912 0.007 262)',
    'oklch(0.84 0.012 262)',
    'oklch(0.43 0.02 262)',
    'oklch(0.5 0.02 262)',
  ])
})

test('in dark the third text colour is lighter and the card sits above the panel', async () => {
  expect(await inDark(async () => ['fg3', 'surface', 'panel'].map(colour))).toEqual([
    'oklch(0.7 0.015 262)',
    'oklch(0.205 0.02 262)',
    'oklch(0.165 0.02 262)',
  ])
})
