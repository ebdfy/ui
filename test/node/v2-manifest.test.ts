// v2's manifest comes from the JSDoc on each e-* class, and the types from the manifest. An attribute
// with a fixed set of values names them, so a wrong one fails an app's type check.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import { generateV2Manifest, v2Types } from '../../scripts/declarations.ts'

const manifest = generateV2Manifest(join(mkdtempSync(join(tmpdir(), 'ebdfy-v2-manifest-test-')), 'v2.json'))
const declarations = manifest.modules.flatMap((m) => m.declarations ?? [])
const element = (tag: string) => declarations.find((d) => d.tagName === tag)

test('e-button names its tones and sizes as the values they allow', () => {
  const button = element('e-button')
  const type = (name: string) => button?.attributes?.find((a) => a.name === name)?.type?.text
  expect(type('tone')).toBe("'primary' | 'plain'")
  expect(type('size')).toBe("'sm' | 'lg'")
  expect(type('disabled')).toBe('boolean')
  expect(button?.description).toBeTruthy()
})

test('e-text-field, e-table and e-row are in the manifest', () => {
  expect(element('e-text-field')?.attributes?.map((a) => a.name)).toEqual(
    expect.arrayContaining(['label', 'name', 'value', 'type', 'error']),
  )
  expect(element('e-table')?.attributes?.map((a) => a.name)).toEqual(expect.arrayContaining(['label', 'columns']))
  expect(element('e-row')?.attributes?.map((a) => a.name)).toEqual(['head'])
})

test('v1 tags stay out of the v2 manifest', () => {
  expect(declarations.filter((d) => d.tagName?.startsWith('eb-'))).toEqual([])
})

test('generating the v2 manifest leaves package.json as it was', () => {
  const packageJson = fileURLToPath(new URL('../../package.json', import.meta.url))
  const before = readFileSync(packageJson, 'utf8')
  generateV2Manifest(join(mkdtempSync(join(tmpdir(), 'ebdfy-v2-manifest-test-')), 'v2.json'))
  expect(readFileSync(packageJson, 'utf8')).toBe(before)
  expect(JSON.parse(before).customElements).toBe('dist/custom-elements-v2.json')
})

test('the React types give each tag only its own attributes, typed as the manifest says', () => {
  const { react } = v2Types(manifest)
  expect(react).toContain("declare module 'react'")
  expect(react).toMatch(/'e-button': Tag<import\('\.\/v2\/button\.js'\)\.EButton, \{[^}]*tone\?: 'primary' \| 'plain'/)
})
