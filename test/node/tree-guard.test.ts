// The guard that fails a run whose src/ or site/ changed under it notices a written, an added and a
// removed file, and nothing else.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import { changedSince, snapshotTree } from '../setup/tree-guard.ts'

test('a written, an added and a removed file are named, and an untouched tree names none', () => {
  const root = mkdtempSync(join(tmpdir(), 'tree-guard-'))
  mkdirSync(join(root, 'v2'))
  for (const name of ['a.ts', 'v2/b.css', 'c.html']) writeFileSync(join(root, name), 'x')
  const before = snapshotTree([root])
  expect(changedSince(before, [root])).toEqual([])

  const later = new Date(Date.now() + 5000)
  utimesSync(join(root, 'v2/b.css'), later, later)
  writeFileSync(join(root, 'd.ts'), 'x')
  rmSync(join(root, 'c.html'))
  expect(changedSince(before, [root])).toEqual([join(root, 'c.html'), join(root, 'd.ts'), join(root, 'v2/b.css')])
  rmSync(root, { recursive: true })
})
