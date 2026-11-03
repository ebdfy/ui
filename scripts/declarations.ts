// Generates what describes the package's API from its source: the custom-elements manifest, which
// the versioning test compares between releases, and the TypeScript declarations.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Manifest } from './versioning.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const bin = (name: string) => `${root}node_modules/.bin/${name}`

export const manifestPath = `${root}dist/custom-elements.json`
export const typesDir = `${root}dist/types`

export function generateManifest(): Manifest {
  execFileSync(bin('cem'), ['analyze', '--litelement', '--globs', 'src/**/*.ts', '--outdir', 'dist', '--quiet'], {
    cwd: root,
    stdio: 'pipe',
  })
  // SAFETY: the analyzer has just written this file in the custom-elements manifest schema.
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest
}

export function generateTypes(): void {
  execFileSync(bin('tsc'), ['-p', 'tsconfig.types.json'], { cwd: root, stdio: 'pipe' })
}
