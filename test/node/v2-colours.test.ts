// v2's parts draw only with Midnight's tokens: a colour written anywhere but tokens.css would skip
// the dark theme and the contrast checks.
import { readdirSync, readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const src = new URL('../../src/', import.meta.url)
const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi

const sheets = [
  ...readdirSync(new URL('v2/', src))
    .filter((name) => /\.(css|ts)$/.test(name) && name !== 'tokens.css')
    .map((name) => `v2/${name}`),
  'v2.css',
  'v2-host.css',
  'v2-host.ts',
  'v2-host-app.ts',
]

test('a colour literal outside the tokens is caught', () => {
  expect('a { color: oklch(0.5 0 0); border-color: #fff }'.match(literal)).toEqual(['oklch(', '#fff'])
})

test('v2 parts hold no colour of their own, only tokens', () => {
  const found = sheets.flatMap((path) =>
    (readFileSync(new URL(path, src), 'utf8').match(literal) ?? []).map((match) => `${path}: ${match}`),
  )
  expect(found).toEqual([])
})
