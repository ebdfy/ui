import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { expect, test } from 'vitest'

import { generateTypes, generateV2Manifest, typesDir, v2Types } from '../../scripts/declarations.ts'
import { aliasedAttributeTypes, breakingChanges } from '../../scripts/versioning.ts'

// The manifest of the v2.js 2.0.0 serves, which every later 2.x must keep.
const baseline = JSON.parse(readFileSync(new URL('../../release/v2.json', import.meta.url), 'utf8'))

// The source's manifest, written outside dist/ so the build's copy stays as it is.
const current = () => generateV2Manifest(join(mkdtempSync(join(tmpdir(), 'ebdfy-versioning-')), 'v2.json'))

interface Element {
  tagName?: string
  attributes?: { name: string; fieldName?: string; type?: { text: string } }[]
  members?: { name: string; kind?: string }[]
}

// A copy of the baseline with one change made to the element with the tag.
function withElement(tag: string, change: (element: Element) => void) {
  const copy = structuredClone(baseline)
  for (const module of copy.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.tagName === tag) change(declaration)
    }
  }
  return copy
}

test('the source keeps everything the released v2 manifest promises', () => {
  expect(breakingChanges(baseline, current())).toEqual([])
})

// e-checkbox's indeterminate is both an attribute and a property.
test("removing e-checkbox's indeterminate attribute is a breaking change that names both", () => {
  const removed = withElement('e-checkbox', (checkbox) => {
    checkbox.attributes = checkbox.attributes!.filter((a) => a.name !== 'indeterminate')
    checkbox.members = checkbox.members!.filter((m) => m.name !== 'indeterminate')
  })
  expect(breakingChanges(baseline, removed)).toEqual([
    'e-checkbox: attribute indeterminate was removed',
    'e-checkbox: property indeterminate was removed',
  ])
})

test('renaming indeterminate to mixed breaks the same way, and a new size attribute does not', () => {
  const renamed = withElement('e-checkbox', (checkbox) => {
    for (const list of [checkbox.attributes!, checkbox.members!] as { name: string; fieldName?: string }[][]) {
      for (const item of list) {
        if (item.name === 'indeterminate')
          Object.assign(item, { name: 'mixed' }, item.fieldName ? { fieldName: 'mixed' } : {})
      }
    }
  })
  expect(breakingChanges(baseline, renamed)).toEqual([
    'e-checkbox: attribute indeterminate was removed',
    'e-checkbox: property indeterminate was removed',
  ])

  const grown = withElement('e-checkbox', (checkbox) => {
    checkbox.attributes!.push({ name: 'size', fieldName: 'size' })
    checkbox.members!.push({ name: 'size', kind: 'field' })
  })
  expect(breakingChanges(baseline, grown)).toEqual([])
})

test('dropping an allowed value or a whole element is a breaking change', () => {
  const narrowed = withElement('e-button', (button) => {
    const tone = button.attributes!.find((a) => a.name === 'tone')!
    tone.type = { text: "'primary'" }
  })
  expect(breakingChanges(baseline, narrowed)).toEqual(["e-button: attribute tone no longer allows 'plain'"])

  const gone = withElement('e-button', (button) => {
    button.tagName = 'e-action'
  })
  expect(breakingChanges(baseline, gone)).toEqual(['e-button was removed'])
})

// A named alias hides its literals from the manifest, so a dropped value would go unnoticed.
test('every attribute type in the source spells its allowed values out', () => {
  expect(aliasedAttributeTypes(current())).toEqual([])
  const aliased = withElement('e-button', (button) => {
    button.attributes!.find((a) => a.name === 'tone')!.type = { text: 'Tone' }
  })
  expect(aliasedAttributeTypes(aliased)).toEqual(["e-button: attribute tone has the type 'Tone'; write its values out"])
})

test('the generated declarations put e-button in HTMLElementTagNameMap, from the class tsc emits', () => {
  generateTypes()
  expect(readFileSync(`${typesDir}/v2/button.d.ts`, 'utf8')).toMatch(/export declare class EButton\b/)
  expect(v2Types(current()).elements).toMatch(
    /interface HTMLElementTagNameMap \{[^}]*'e-button': import\('\.\/v2\/button\.js'\)\.EButton\n/,
  )
})
