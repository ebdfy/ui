import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

const site = fileURLToPath(new URL('../../site/', import.meta.url))
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1" />'

// What a page is missing to render right on a phone and to be read by a screen reader.
function problems(html: string): string[] {
  const found: string[] = []
  if (!/^<!doctype html>/i.test(html)) found.push('doctype')
  if (!/<html[^>]*\slang="[^"]+"/i.test(html)) found.push('html lang')
  if (!html.includes(viewport)) found.push('viewport')
  return found
}

test('a page without a doctype, a language or the viewport meta is reported', () => {
  expect(problems('<html><head></head><body></body></html>')).toEqual(['doctype', 'html lang', 'viewport'])
  expect(problems('<!doctype html><html lang=""><head></head></html>')).toEqual(['html lang', 'viewport'])
})

const pages = readdirSync(site, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'))

test('the site has pages to check', () => {
  expect(pages.length).toBeGreaterThanOrEqual(9)
})

for (const file of pages) {
  test(`${file} has a doctype, html lang and the viewport meta`, () => {
    expect(problems(readFileSync(`${site}${file}`, 'utf8'))).toEqual([])
  })
}
