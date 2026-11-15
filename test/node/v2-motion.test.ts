// Motion in the kit: a change (hover, press, a menu opening) takes the time and ease tokens, and
// nothing moves for a person who asked for less motion, so every transition and animation sits in
// a prefers-reduced-motion: no-preference block. A busy loop (spinner, skeleton, progress and
// loading bars) keeps its own period, as it repeats rather than eases a change.
import { readdirSync, readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const src = new URL('../../src/', import.meta.url)

const sheets = [
  ...readdirSync(new URL('v2/', src))
    .filter((name) => name.endsWith('.css'))
    .map((name) => `v2/${name}`),
  'v2.css',
  'v2-host.css',
]

interface Motion {
  property: string
  value: string
  // Whether a @media (prefers-reduced-motion: no-preference) block holds the declaration.
  allowed: boolean
}

// Each transition and animation declaration of a sheet, with whether a no-preference block holds
// it. The sheet is walked brace by brace, so a rule nested in @media or @layer keeps its blocks.
export function motionsIn(css: string): Motion[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: string[] = []
  const found: Motion[] = []
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '{') {
      blocks.push(text.slice(start, index).trim())
      start = index + 1
    } else if (char === '}' || char === ';') {
      const declaration = /^\s*((?:animation|transition)(?:-[a-z-]+)?)\s*:\s*([\s\S]+?)\s*$/.exec(
        text.slice(start, index),
      )
      if (declaration)
        found.push({
          property: declaration[1]!,
          value: declaration[2]!,
          allowed: blocks.some((prelude) => /prefers-reduced-motion:\s*no-preference/.test(prelude)),
        })
      if (char === '}') blocks.pop()
      start = index + 1
    }
  }
  return found
}

test('the scan finds each way a sheet writes motion, and where it sits', () => {
  const css = `a { transition: color var(--e-time-1) var(--e-ease); }
@media (prefers-reduced-motion: no-preference) { b { animation: e-x 1s linear infinite } }
@layer e { @media (prefers-reduced-motion: no-preference) { c { transition-duration: 1s; } } d { animation-name: e-y; } }`
  expect(motionsIn(css)).toEqual([
    { property: 'transition', value: 'color var(--e-time-1) var(--e-ease)', allowed: false },
    { property: 'animation', value: 'e-x 1s linear infinite', allowed: true },
    { property: 'transition-duration', value: '1s', allowed: true },
    { property: 'animation-name', value: 'e-y', allowed: false },
  ])
})

const motions = sheets.flatMap((path) =>
  motionsIn(readFileSync(new URL(path, src), 'utf8')).map((motion) => ({ path, ...motion })),
)

test('the kit has motion to check', () => {
  expect(motions.length).toBeGreaterThan(3)
})

test('no transition or animation runs under prefers-reduced-motion', () => {
  expect(
    motions.filter(({ allowed }) => !allowed).map(({ path, property, value }) => `${path}: ${property}: ${value}`),
  ).toEqual([])
})

test('every transition takes its time and ease from the tokens', () => {
  const untimed = motions.filter(
    ({ property, value }) =>
      property.startsWith('transition') &&
      !value.split(',').every((one) => /var\(--e-time-[12]\)/.test(one) && /var\(--e-ease\)/.test(one)),
  )
  expect(untimed.map(({ path, property, value }) => `${path}: ${property}: ${value}`)).toEqual([])
})
