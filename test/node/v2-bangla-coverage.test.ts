// Every v2 part that shows words is in the Bangla type check, so a new part cannot ship Bangla under
// 13 px or on a line under 1.4 times its size unseen. The parts are the files v2.css imports.
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// Parts that hold no words of their own: the tokens and base type, an icon, a thumbnail, a stack, a
// divider, a grid, a spinner and a skeleton.
const wordless = new Set(['tokens', 'type', 'icon', 'thumbnail', 'stack', 'divider', 'grid', 'spinner', 'skeleton'])

// The tags a part's file draws, where they are not simply e-<file>.
const tags: Record<string, string[]> = {
  field: ['e-text-field', 'e-date-field', 'e-text-area', 'e-search-field'],
  text: ['e-text', 'e-heading'],
  table: ['e-table', 'e-row'],
  tabs: ['e-tabs', 'e-tab'],
  menu: ['e-menu', 'e-menu-item'],
  'setup-guide': ['e-setup-guide', 'e-setup-step'],
}

test('each v2 part that shows words is in the Bangla type check', () => {
  const parts = [...read('../../src/v2.css').matchAll(/@import 'v2\/([a-z-]+)\.css'/g)].map((match) => match[1]!)
  expect(parts.length).toBeGreaterThan(10)
  const check = read('../browser/v2-bangla-type.test.ts')
  const missing = parts
    .filter((part) => !wordless.has(part))
    .flatMap((part) => tags[part] ?? [`e-${part}`])
    .filter((tag) => !check.includes(`<${tag}`))
  expect(missing).toEqual([])
})
