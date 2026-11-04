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

// The v1 names are kept until 2.0 only for 1.0.0 apps (the API's authorize pages read two of them);
// nothing of ours reads one. An alias is a token of the aliases block, or any defined as nothing
// but another token.
const tokensSource = readFileSync(new URL('tokens.ts', src), 'utf8')
const aliasBlock = tokensSource.slice(
  tokensSource.indexOf('const aliases = css`'),
  tokensSource.indexOf('export const tokens'),
)
const aliases = [
  ...new Set([
    ...[...aliasBlock.matchAll(/(--eb-[\w-]+):/g)].map((match) => match[1]!),
    ...[...tokensSource.matchAll(/(--eb-[\w-]+): var\(--eb-[\w-]+\);/g)].map((match) => match[1]!),
  ]),
]
const site = new URL('../../site/', import.meta.url)
const files = (dir: URL, pattern: RegExp): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(new URL(`${entry.name}/`, dir), pattern)
      : pattern.test(entry.name)
        ? [new URL(entry.name, dir)]
        : [],
  )

test('no source or docs page reads a v1 alias token', () => {
  expect(aliases).toEqual(
    expect.arrayContaining(['--eb-color-line', '--eb-color-critical-surface', '--eb-shadow-card']),
  )
  const read = [...files(src, /\.ts$/), ...files(site, /\.(html|css|js)$/)].filter(
    (url) => !url.href.endsWith('/tokens.ts'),
  )
  const found = read.flatMap((url) => {
    const text = readFileSync(url, 'utf8')
    return aliases
      .filter((name) => new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(text))
      .map((name) => `${url.pathname}: ${name}`)
  })
  expect(found).toEqual([])
})
