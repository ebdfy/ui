import { expect, test } from 'vitest'

import { DISTRICTS as apiDistricts } from '../../../../apps/api/src/districts.ts'
import { DISTRICTS } from '../../src/geo/districts.ts'
import { THANAS } from '../../src/geo/thanas.ts'
import { UPAZILAS } from '../../src/geo/upazilas.ts'

test("the 64 districts carry the API's English and Bangla names", () => {
  expect(DISTRICTS).toHaveLength(64)
  expect(DISTRICTS).toEqual(apiDistricts)
})

test('every district has its upazilas, 494 in all, so no old spelling was left unjoined', () => {
  expect([...UPAZILAS.keys()]).toEqual(DISTRICTS.map((d) => d.name))
  for (const [district, upazilas] of UPAZILAS) expect(upazilas.length, district).toBeGreaterThan(0)
  expect([...UPAZILAS.values()].flat()).toHaveLength(494)
  expect(UPAZILAS.get('Dhaka')).toContainEqual(['Savar', 'সাভার'])
})

test('each thana names the public page it was taken from, and lies in one of the 64 districts', () => {
  const names = new Set(DISTRICTS.map((d) => d.name))
  for (const thana of THANAS) {
    expect(names.has(thana.district), thana.name).toBe(true)
    expect(thana.source, thana.name).toMatch(/^https:\/\/\S+$/)
    if (thana.sourceBn) expect(thana.sourceBn, thana.name).toMatch(/^https:\/\/\S+$/)
    expect(thana.nameBn, thana.name).toMatch(/^[ঀ-৿ ]+$/)
  }
})

test('the Dhaka district has its city thanas, Mirpur, Dhanmondi and Uttara among them, and Chattogram its 16', () => {
  const dhaka = THANAS.filter((t) => t.district === 'Dhaka').map((t) => t.name)
  expect(dhaka.length).toBeGreaterThanOrEqual(45)
  expect(dhaka).toEqual(expect.arrayContaining(['Mirpur', 'Dhanmondi', 'Uttara East', 'Uttara West']))
  expect(THANAS.filter((t) => t.district === 'Chattogram')).toHaveLength(16)
})

test('no district offers the same area twice', () => {
  for (const { name } of DISTRICTS) {
    const thanas = THANAS.filter((t) => t.district === name)
    for (const [i, of] of [(t: { name: string }) => t.name, (t: { nameBn: string }) => t.nameBn].entries()) {
      const areas = [...UPAZILAS.get(name)!.map(([en, bn]) => [en, bn][i]!), ...thanas.map(of)]
      expect(areas.length - new Set(areas).size, name).toBe(0)
    }
  }
})
