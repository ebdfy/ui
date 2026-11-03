import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { generateManifest, generateTypes, typesDir } from '../../scripts/declarations.ts'
import { aliasedAttributeTypes, breakingChanges } from '../../scripts/versioning.ts'

// The manifest of the v1.js the CDN serves, which every later v1 must keep.
const baseline = JSON.parse(readFileSync(new URL('../../release/v1.json', import.meta.url), 'utf8'))

interface Element {
  tagName?: string
  attributes?: { name: string; fieldName?: string; type?: { text: string } }[]
  members?: { name: string }[]
}

// A copy of the baseline with one change made to eb-button.
function withButton(change: (button: Element) => void) {
  const copy = structuredClone(baseline)
  for (const module of copy.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.tagName === 'eb-button') change(declaration)
    }
  }
  return copy
}

test('the source keeps everything the released v1 manifest promises', () => {
  expect(breakingChanges(baseline, generateManifest())).toEqual([])
})

test("removing eb-button's variant attribute is a breaking change that names both", () => {
  const removed = withButton((button) => {
    button.attributes = button.attributes!.filter((a) => a.name !== 'variant')
    button.members = button.members!.filter((m) => m.name !== 'variant')
  })
  expect(breakingChanges(baseline, removed)).toEqual([
    'eb-button: attribute variant was removed',
    'eb-button: property variant was removed',
  ])
})

test('renaming variant to kind breaks the same way, and a new size attribute does not', () => {
  const renamed = withButton((button) => {
    for (const list of [button.attributes!, button.members!] as { name: string; fieldName?: string }[][]) {
      for (const item of list) {
        if (item.name === 'variant') Object.assign(item, { name: 'kind' }, item.fieldName ? { fieldName: 'kind' } : {})
      }
    }
  })
  expect(breakingChanges(baseline, renamed)).toEqual([
    'eb-button: attribute variant was removed',
    'eb-button: property variant was removed',
  ])

  const grown = withButton((button) => {
    button.attributes!.push({ name: 'size', fieldName: 'size' })
    button.members!.push({ name: 'size' })
  })
  expect(breakingChanges(baseline, grown)).toEqual([])
})

test('dropping an allowed value or a whole element is a breaking change', () => {
  const narrowed = withButton((button) => {
    const variant = button.attributes!.find((a) => a.name === 'variant')!
    variant.type = { text: "'primary'" }
  })
  expect(breakingChanges(baseline, narrowed)).toEqual(["eb-button: attribute variant no longer allows 'secondary'"])

  const gone = withButton((button) => {
    button.tagName = 'eb-action'
  })
  expect(breakingChanges(baseline, gone)).toEqual(['eb-button was removed'])
})

// A named alias hides its literals from the manifest, so a dropped value would go unnoticed.
test('every attribute type in the source spells its allowed values out', () => {
  expect(aliasedAttributeTypes(generateManifest())).toEqual([])
  const aliased = withButton((button) => {
    button.attributes!.find((a) => a.name === 'variant')!.type = { text: 'Variant' }
  })
  expect(aliasedAttributeTypes(aliased)).toEqual([
    "eb-button: attribute variant has the type 'Variant'; write its values out",
  ])
})

test('the generated declarations put eb-button in HTMLElementTagNameMap', () => {
  generateTypes()
  const declarations = readFileSync(`${typesDir}/components/button.d.ts`, 'utf8')
  expect(declarations).toMatch(/interface HTMLElementTagNameMap \{\s*'eb-button': EbButton;?\s*\}/)
})
