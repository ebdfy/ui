import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { expect, test } from 'vitest'

// The spec's ceiling for the library script, gzipped.
const budgetKb = 50

test(`v1.js stays under ${budgetKb} KB gzipped, measured on the script the CDN serves`, () => {
  const outDir = mkdtempSync(join(tmpdir(), 'ebdfy-ui-size-'))
  // Vitest sets NODE_ENV to test, which would build lit's development code; the release's build
  // has no NODE_ENV, so the script is built in a child without it.
  const { NODE_ENV: _test, ...env } = process.env
  const build = fileURLToPath(new URL('../../scripts/build.ts', import.meta.url))
  execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `await (await import(${JSON.stringify(build)})).buildEntry('v1', process.argv[1])`,
      outDir,
    ],
    { stdio: 'pipe', env },
  )
  const code = readFileSync(join(outDir, 'v1.js'), 'utf8')
  expect(code).not.toContain('Lit is in dev mode')
  const kb = gzipSync(code).length / 1024
  console.log(`v1.js is ${kb.toFixed(1)} KB gzipped, against a budget of ${budgetKb} KB`)
  expect(kb).toBeLessThanOrEqual(budgetKb)
})
