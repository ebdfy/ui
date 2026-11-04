import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { docsManifest } from '../../scripts/docs-api.ts'
import { docsPages, framePage } from '../../scripts/docs.ts'

// Every component page lists its elements' API, built from the manifest, so a new attribute, event,
// slot or part reaches the docs without anyone retyping it.
const site = new URL('../../site/ui', import.meta.url).pathname
const escape = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

const declarations = docsManifest()
  .modules.flatMap((m) => m.declarations ?? [])
  .filter((d) => d.tagName)

test('every element of the manifest is documented on exactly one page', () => {
  for (const { tagName } of declarations) {
    const pages = docsPages.filter((page) => page.tags.includes(tagName!))
    expect(
      pages.map((p) => p.path),
      `${tagName} needs a page that lists it in tags`,
    ).toHaveLength(1)
  }
})

for (const page of docsPages.filter((p) => p.tags.length)) {
  test(`${page.path} lists the API of ${page.tags.join(', ')}`, () => {
    const html = framePage(readFileSync(`${site}${page.path}.html`, 'utf8'), page.path)
    expect(html).toContain('<section class="api" aria-labelledby="api"><h2 id="api">API</h2>')
    for (const tag of page.tags) {
      const declaration = declarations.find((d) => d.tagName === tag)!
      const start = html.indexOf(`<h3 id="api-${tag}">`)
      expect(start, `${tag} has an h3`).toBeGreaterThan(-1)
      const rest = html.slice(start + 1)
      const end = Math.min(...['<h3', '</section>'].map((s) => rest.indexOf(s)).filter((i) => i >= 0))
      const block = rest.slice(0, end)
      const shows = (text: string) => expect(block, `${tag} shows ${text}`).toContain(escape(text))

      shows(declaration.description!)
      for (const a of declaration.attributes ?? []) {
        shows(a.name)
        shows(a.description!)
      }
      const fields = (declaration.members ?? []).filter(
        (m) => m.kind === 'field' && !m.static && (m.privacy ?? 'public') === 'public',
      )
      for (const f of fields) shows(f.name)
      for (const e of (declaration.events ?? []).filter((event) => event.description)) {
        shows(e.name)
        shows(e.description!)
      }
      for (const s of declaration.slots ?? []) {
        shows(s.name || '(default)')
        shows(s.description!)
      }
      for (const p of declaration.cssParts ?? []) {
        shows(p.name)
        shows(p.description!)
      }
    }
  })
}

test('a page that documents no element has no API section', () => {
  for (const page of docsPages.filter((p) => !p.tags.length && p.path !== '/playground')) {
    const html = framePage(readFileSync(`${site}${page.path}.html`, 'utf8'), page.path)
    expect(html, page.path).not.toContain('class="api"')
  }
})

test('a description reads code in backticks as code, never a raw backtick', () => {
  const raw = docsPages
    .filter((page) => page.tags.length)
    .filter((page) => {
      const served = framePage(readFileSync(`${site}${page.path}.html`, 'utf8'), page.path)
      const start = served.indexOf('<section class="api"')
      return served.slice(start, served.indexOf('</section>', start)).includes('`')
    })
    .map((page) => page.path)
  expect(raw).toEqual([])
})
