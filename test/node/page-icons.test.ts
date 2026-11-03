import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from 'vitest'

// A page without an icon makes the browser ask its host for /favicon.ico, which none of the hosts
// has, and the 404 shows as a console error on every load.
const site = fileURLToPath(new URL('../../site', import.meta.url))
const pages = readdirSync(site, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.html'))

test.each(pages)('%s declares its icon', (page) => {
  expect(readFileSync(`${site}/${page}`, 'utf8')).toMatch(/<link rel="icon" href="data:,"/)
})
