// The API section of a component page, built from the custom-elements manifest.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateV2Manifest } from './declarations.ts'
import type { Manifest } from './versioning.ts'

let v2Manifest: Manifest | undefined

// The manifest is generated once per process, outside dist/, because many tests start dev servers at once.
export function v2DocsManifest(): Manifest {
  if (!v2Manifest) {
    const dir = mkdtempSync(join(tmpdir(), 'ebdfy-v2-manifest-'))
    v2Manifest = generateV2Manifest(join(dir, 'custom-elements-v2.json'))
    rmSync(dir, { recursive: true, force: true })
  }
  return v2Manifest
}

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// A description from the source's JSDoc: `name` in backticks reads as code.
const prose = (text: string) => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>')

interface Entry {
  name: string
  type?: string
  default?: string
  description?: string
}

function list(title: string, entries: Entry[]): string {
  if (!entries.length) return ''
  const items = entries.map((entry) => {
    const type = entry.type ? ` <span class="type">${escape(entry.type)}</span>` : ''
    const value = entry.default ? ` <span class="type">= ${escape(entry.default)}</span>` : ''
    return `<dt><code>${escape(entry.name)}</code>${type}${value}</dt><dd>${prose(entry.description ?? '')}</dd>`
  })
  return `<h4>${title}</h4><dl>${items.join('')}</dl>`
}

export function apiSection(tags: string[], source: Manifest): string {
  if (!tags.length) return ''
  const declarations = source.modules.flatMap((m) => m.declarations ?? [])
  const elements = tags.map((tag) => {
    const d = declarations.find((declaration) => declaration.tagName === tag)
    if (!d) throw new Error(`${tag} is not in the custom-elements manifest`)
    const fields = (d.members ?? []).filter(
      (m) => m.kind === 'field' && !m.static && (m.privacy ?? 'public') === 'public',
    )
    const attributes = (d.attributes ?? []).map((a) => {
      const field = fields.find((f) => f.name === (a.fieldName ?? a.name))
      const name = a.fieldName && a.fieldName !== a.name ? `${a.name} (property ${a.fieldName})` : a.name
      return {
        name,
        type: a.type?.text,
        default: a.default ?? field?.default,
        description: a.description,
      }
    })
    const properties = fields
      .filter((f) => !f.attribute && !(d.attributes ?? []).some((a) => (a.fieldName ?? a.name) === f.name))
      .map((f) => ({ name: f.name, type: f.type?.text, default: f.default, description: f.description }))
    // The analyzer also reads a dispatch such as new CustomEvent(type) as an event named "type". An event
    // the source documents with @fires has a description; one without is not part of the API.
    const events = (d.events ?? [])
      .filter((e) => e.description)
      .map((e) => ({ name: e.name, type: e.type?.text, description: e.description }))
    const slots = (d.slots ?? []).map((s) => ({ name: s.name || '(default)', description: s.description }))
    const parts = (d.cssParts ?? []).map((p) => ({ name: p.name, description: p.description }))
    return `<h3 id="api-${tag}"><code>${tag}</code></h3><p>${prose(d.description ?? '')}</p>${list('Attributes', attributes)}${list('Properties', properties)}${list('Events', events)}${list('Slots', slots)}${list('CSS parts', parts)}`
  })
  return `<section class="api" aria-labelledby="api"><h2 id="api">API</h2>${elements.join('')}</section>`
}
