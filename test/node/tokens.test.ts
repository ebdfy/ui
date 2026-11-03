import { readFileSync, readdirSync } from 'node:fs'

import { expect, test } from 'vitest'

const src = new URL('../../src/', import.meta.url)
const sources = [
  ...readdirSync(new URL('components/', src)).map((name) => `components/${name}`),
  'save-bar.ts',
  'host.ts',
]
const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi

test('component styles hold no colour of their own, only tokens', () => {
  const found = sources.flatMap((path) =>
    (readFileSync(new URL(path, src), 'utf8').match(literal) ?? []).map((match) => `${path}: ${match}`),
  )
  expect(found).toEqual([])
})
