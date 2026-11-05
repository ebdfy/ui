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
    'oklch(0.99 0.002 262)',
    'oklch(0.25 0.04 262)',
  ])
  expect(await inDark(async () => [colour('frame'), colour('panel'), colour('primary')])).toEqual([
    'oklch(0.13 0.02 262)',
    'oklch(0.18 0.02 262)',
    'oklch(0.89 0.17 125)',
  ])
})
