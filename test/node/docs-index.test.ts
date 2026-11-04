import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { generateManifest } from '../../scripts/declarations.ts'

const site = new URL('../../site/ui/', import.meta.url)

// The text between the opening tag of #examples (a div, an eb-card, ...) and its matching close tag.
function examplesOf(html: string): string {
  const open = /<([a-z][\w-]*)\b[^>]*\bid="examples"[^>]*>/.exec(html)
  if (!open) return ''
  const start = open.index + open[0].length
  const tags = new RegExp(`<(/?)${open[1]}\\b`, 'g')
  tags.lastIndex = start
  let depth = 1
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) return html.slice(start, tag.index)
  }
  return html.slice(start)
}

test('every element is named on a docs index card and shown in #examples of the page that card links to', () => {
  const tags: string[] = []
  for (const module of generateManifest().modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.tagName) tags.push(declaration.tagName)
    }
  }

  // tag -> the pages of the cards whose <code> names it
  const pages = new Map<string, string[]>()
  const index = readFileSync(new URL('index.html', site), 'utf8')
  for (const card of index.match(/<article class="tile">[\s\S]*?<\/article>/g) ?? []) {
    const page = /href="\/components\/([^"]+)"/.exec(card)?.[1]
    if (!page) continue
    for (const [, tag] of card.matchAll(/<code>([^<]+)<\/code>/g)) {
      pages.set(tag!, [...(pages.get(tag!) ?? []), page])
    }
  }

  const missing = tags.filter((tag) => {
    const examples = (pages.get(tag) ?? []).map((page) =>
      examplesOf(readFileSync(new URL(`components/${page}.html`, site), 'utf8')),
    )
    return !examples.some((html) => new RegExp(`<${tag}[\\s>/]`).test(html))
  })

  expect(missing.toSorted()).toEqual([])
})
