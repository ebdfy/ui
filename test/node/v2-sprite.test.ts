// The icon sprite holds the 45 icons the kit names, and icon.ts and the docs page name the same 45.
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const sprite = read('../../src/v2/icons.svg')
const symbols = [...sprite.matchAll(/<symbol\b[^>]*>/g)].map((m) => m[0])
const names = symbols.map((tag) => /id="e-icon-([^"]+)"/.exec(tag)![1]!)

const named = [
  'truck', 'search', 'plus', 'x', 'check', 'chevron-left', 'chevron-right', 'chevron-down',
  'more-horizontal', 'home', 'shopping-bag', 'package', 'users', 'settings', 'bell', 'help',
  'arrow-left', 'printer', 'phone', 'copy', 'filter', 'arrow-up-down', 'external-link', 'image',
  'circle-alert', 'pencil', 'trash', 'grip-vertical', 'calendar', 'lock', 'cloud-off', 'upload',
  'download', 'eye', 'message-circle', 'percent', 'file-text', 'chart-column', 'layout-grid', 'store',
  'credit-card', 'map-pin', 'languages', 'database', 'code',
] // prettier-ignore

test('the sprite holds exactly the 45 named symbols', () => {
  expect(symbols).toHaveLength(45)
  expect([...names].sort()).toEqual([...named].sort())
})

test('every symbol is 24 x 24 at stroke width 1.75', () => {
  for (const tag of symbols) {
    expect(tag).toContain('viewBox="0 0 24 24"')
    expect(tag).toContain('stroke-width="1.75"')
  }
})

test('the names in the icon.ts JSDoc union are the sprite names', () => {
  const union = /@attr \{([^}]+)\} name /.exec(read('../../src/v2/icon.ts'))![1]!
  const listed = [...union.matchAll(/'([^']+)'/g)].map((m) => m[1]!)
  expect([...listed].sort()).toEqual([...named].sort())
})

test('the icon docs page names all 45 icons in its text', () => {
  const text = read('../../site/ui/components/icon.html').replace(/<[^>]*>/g, ' ')
  for (const name of named) expect(text).toMatch(new RegExp(`(^|\\s)${name}(\\s|$)`))
})
