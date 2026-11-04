import { expect, test } from 'vitest'

import { generateManifest } from '../../scripts/declarations.ts'

// One tone list on every component, an order status on the badge, and the 1.0.0 names kept until
// 2.0 but marked deprecated where an editor or the docs read the API.
const attribute = (tag: string, name: string) => {
  for (const module of generateManifest().modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.tagName !== tag) continue
      const found = declaration.attributes?.find((attr) => attr.name === name)
      if (found) return { values: found.type?.text.split(' | ') ?? [], description: found.description ?? '' }
    }
  }
  throw new Error(`no ${name} attribute on ${tag}`)
}

const tones = ["'neutral'", "'info'", "'success'", "'warning'", "'danger'"]

test.for([
  ['eb-badge', ['attention', 'critical', 'shipped']],
  ['eb-banner', []],
  ['eb-menu-item', ['default', 'critical']],
] as const)('%s lists the five tones and marks each 1.0.0 name deprecated', ([tag, old]) => {
  const tone = attribute(tag, 'tone')
  expect(tone.values).toEqual(expect.arrayContaining(tones))
  for (const name of old) {
    expect(tone.values).toContain(`'${name}'`)
    expect(tone.description).toContain('Deprecated')
    expect(tone.description.slice(tone.description.indexOf('Deprecated'))).toMatch(new RegExp(`\\b${name}\\b`))
  }
})

test('eb-badge lists the five order statuses', () => {
  expect(attribute('eb-badge', 'status').values).toEqual(
    expect.arrayContaining(["'new'", "'confirmed'", "'shipped'", "'paid'", "'returned'"]),
  )
})
