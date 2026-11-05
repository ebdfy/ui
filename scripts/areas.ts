// Writes src/v2/areas.json: each district's upazilas and city thanas as [English, Bangla], keyed by
// the district's English name in lower case, as the v2 district picker submits it. The picker fetches
// the file on first use, so v2.js carries only the 64 districts.
import { writeFile } from 'node:fs/promises'

import { DISTRICTS } from '../src/geo/districts.ts'
import { THANAS } from '../src/geo/thanas.ts'
import { UPAZILAS } from '../src/geo/upazilas.ts'

export function areas(): Record<string, [string, string][]> {
  return Object.fromEntries(
    DISTRICTS.map(({ name }) => [
      name.toLowerCase(),
      [
        ...(UPAZILAS.get(name) ?? []),
        ...THANAS.filter((thana) => thana.district === name).map((thana): [string, string] => [
          thana.name,
          thana.nameBn,
        ]),
      ],
    ]),
  )
}

// One [English, Bangla] pair a line, as the repo's formatter lays the file out.
function format(lists: Record<string, [string, string][]>): string {
  const pair = (names: [string, string]) => `    [${names.map((name) => JSON.stringify(name)).join(', ')}]`
  const district = ([name, list]: [string, [string, string][]]) =>
    `  ${JSON.stringify(name)}: [\n${list.map(pair).join(',\n')}\n  ]`
  return `{\n${Object.entries(lists).map(district).join(',\n')}\n}\n`
}

if (import.meta.main) {
  await writeFile(new URL('../src/v2/areas.json', import.meta.url), format(areas()))
}
