// A typed attr() is read only from Chromium 133, and the kit's floor is Chrome 111. A declaration that
// holds one is not dropped where the browser cannot read it: it turns invalid at computed-value time,
// so e-table's columns fell to `none` and stacked every cell before the script. Each one therefore
// sits inside an @supports that asks for typed attr(), and older browsers keep the rule before it.
import { readdirSync, readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

const src = new URL('../../src/', import.meta.url)

// Each typed attr() in the CSS, with the at-rule preludes around it.
function typedAttrs(css: string) {
  const found: { line: number; within: string[] }[] = []
  const open: string[] = []
  let start = 0
  for (let at = 0; at < css.length; at++) {
    const char = css[at]
    if (css.startsWith('/*', at)) {
      at = css.indexOf('*/', at + 2) + 1
      start = at + 1
    } else if (char === '{') {
      open.push(css.slice(start, at).trim())
      start = at + 1
    } else if (char === '}') {
      open.pop()
      start = at + 1
    } else if (char === ';') {
      start = at + 1
    } else if (/^attr\([^;{}]*type\(/.test(css.slice(at, at + 200)) && !css.slice(start, at).trim().startsWith('@')) {
      found.push({ line: css.slice(0, at).split('\n').length, within: [...open] })
    }
  }
  return found
}

test('every typed attr() in the kit sits in an @supports that asks for typed attr()', () => {
  const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.css'))
  const all = files.flatMap((file) =>
    typedAttrs(readFileSync(new URL(file, src), 'utf8')).map(({ line, within }) => ({ file, line, within })),
  )
  // The two the kit reads today, so this test cannot pass by finding none.
  expect(all.map(({ file }) => file).sort()).toEqual(['v2/field.css', 'v2/table.css'])
  const bare = all
    .filter(({ within }) => !within.some((prelude) => /^@supports\b.*attr\([^)]*type\(/.test(prelude)))
    .map(({ file, line }) => `${file}:${line}`)
  expect(bare).toEqual([])
})
