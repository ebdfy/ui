// areas.json holds each district's upazilas and city thanas, which the v2 district picker fetches on
// first use. It is generated from src/geo by scripts/areas.ts and committed, so it must match.
import { readFileSync } from 'node:fs'

import { expect, test } from 'vitest'

import { areas } from '../../scripts/areas.ts'

const committed = JSON.parse(readFileSync(new URL('../../src/v2/areas.json', import.meta.url), 'utf8')) as Record<
  string,
  [string, string][]
>

test('areas.json is what scripts/areas.ts makes from src/geo', () => {
  expect(committed).toEqual(areas())
})

test('areas.json holds a list for each of the 64 districts, by lower-case English name', () => {
  expect(Object.keys(committed)).toHaveLength(64)
  expect(Object.values(committed).filter((list) => list.length === 0)).toEqual([])
  expect(committed["cox's bazar"]).toContainEqual(['Teknaf', 'টেকনাফ'])
})

test('Mirpur, a city thana, is under Dhaka with its Bangla name', () => {
  expect(committed.dhaka).toContainEqual(['Mirpur', 'মিরপুর'])
  expect(committed.dhaka).toContainEqual(['Savar', 'সাভার'])
})
