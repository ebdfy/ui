import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

import { generateManifest } from '../../scripts/declarations.ts'

// The docs build their API tables from the manifest, so every element has to name what it renders
// and fires. The source is read with a regex to know what that is.
const dir = new URL('../../src/components/', import.meta.url)

interface Named {
  name: string
  description?: string
}
interface Class {
  block: string
  parent: string | undefined
}

const classes = new Map<string, Class>()
// Top-level consts and functions, such as a shared template or an event factory. A class owns what
// one holds when it uses the name.
const helpers = new Map<string, string>()

for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
  const source = readFileSync(new URL(file, dir), 'utf8')
  const starts = [...source.matchAll(/^(?:export )?(?:abstract )?class (\w+)(?: extends (\w+))?/gm)]
  for (const [i, start] of starts.entries()) {
    const end = starts[i + 1]?.index ?? source.length
    classes.set(start[1]!, { block: source.slice(start.index, end), parent: start[2] })
  }
  const top = [...source.matchAll(/^(?:export )?(?:const|function) (\w+)/gm)]
  for (const [i, start] of top.entries()) {
    const end = Math.min(
      top[i + 1]?.index ?? source.length,
      starts.find((s) => s.index > start.index)?.index ?? source.length,
    )
    helpers.set(start[1]!, source.slice(start.index, end))
  }
}

function usesHelper(text: string, name: string): boolean {
  return new RegExp(`\\$\\{${name}\\}|(?:^|[^.\\w])${name}\\(`).test(text)
}

function rendered(text: string) {
  const slots = [...text.matchAll(/<slot((?:=>|[^>])*)>/g)].map((m) => /\bname="([^"]*)"/.exec(m[1]!)?.[1] ?? '')
  const parts = [...text.matchAll(/\bpart="([^"]+)"/g)].map((m) => m[1]!)
  const events = [...text.matchAll(/new (?:Custom)?Event\('([^']+)'/g)].map((m) => m[1]!)
  return { slots, parts, events }
}

// What a class and the classes it extends render and dispatch.
function sourceOf(name: string) {
  const found = { slots: new Set<string>(), parts: new Set<string>(), events: new Set<string>() }
  for (let c = classes.get(name); c; c = c.parent ? classes.get(c.parent) : undefined) {
    const texts = [c.block, ...[...helpers].filter(([n]) => usesHelper(c.block, n)).map(([, text]) => text)]
    for (const text of texts) {
      const seen = rendered(text)
      for (const s of seen.slots) found.slots.add(s)
      for (const p of seen.parts) found.parts.add(p)
      for (const e of seen.events) found.events.add(e)
    }
  }
  return found
}

const unnamed = (list: Named[] | undefined, name: string) => !list?.find((n) => n.name === name)?.description?.trim()

// The parts of the manifest this test reads, which the versioning types leave out.
interface Element {
  name: string
  tagName?: string
  description?: string
  attributes?: Named[]
  slots?: Named[]
  cssParts?: Named[]
  events?: Named[]
  members?: (Named & { kind: string; static?: boolean; privacy?: string })[]
}

test('every element describes itself and names its slots, parts and events', () => {
  const failures: string[] = []
  // SAFETY: the analyzer wrote this file in the custom-elements schema, which has these fields.
  const modules = generateManifest().modules as unknown as { path: string; declarations?: Element[] }[]
  for (const module of modules) {
    // The admin chrome is for the playground and the Admin, not an element apps use.
    if (!module.path.startsWith('src/components/')) continue
    for (const element of module.declarations ?? []) {
      const { tagName } = element
      if (!tagName) continue
      if (!element.description?.trim()) failures.push(`${tagName}: no description`)
      for (const attribute of element.attributes ?? []) {
        if (!attribute.description?.trim())
          failures.push(`${tagName}: attribute "${attribute.name}" has no description`)
      }
      for (const member of element.members ?? []) {
        const isProperty = member.kind === 'field' && !member.static && (member.privacy ?? 'public') === 'public'
        if (isProperty && !member.description?.trim())
          failures.push(`${tagName}: property "${member.name}" has no description`)
      }
      const source = sourceOf(element.name)
      for (const slot of source.slots)
        if (unnamed(element.slots, slot)) failures.push(`${tagName}: slot "${slot}" not named`)
      for (const part of source.parts)
        if (unnamed(element.cssParts, part)) failures.push(`${tagName}: part "${part}" not named`)
      for (const event of source.events)
        if (unnamed(element.events, event)) failures.push(`${tagName}: event "${event}" not named`)
    }
  }
  expect(failures).toEqual([])
})

// The analyzer would otherwise point package.json's customElements at wherever it last wrote, and
// the docs write theirs to a temporary folder.
test('generating the manifest elsewhere leaves package.json pointing at dist', () => {
  const packageJson = fileURLToPath(new URL('../../package.json', import.meta.url))
  const before = readFileSync(packageJson, 'utf8')
  generateManifest(mkdtempSync(join(tmpdir(), 'ebdfy-manifest-test-')))
  expect(readFileSync(packageJson, 'utf8')).toBe(before)
  expect(JSON.parse(before).customElements).toBe('dist/custom-elements.json')
})
