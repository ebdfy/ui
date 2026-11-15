import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, expect, test } from 'vitest'

// What npm users get: the tarball pnpm packs from a fresh build, as the release publishes it.
const root = fileURLToPath(new URL('../..', import.meta.url))
let files: string[] = []
let packed: Record<string, unknown> & { exports: Record<string, string | Record<string, string>> }
let packedText = ''
let license = ''
let tarball = ''

beforeAll(() => {
  // Vitest sets NODE_ENV to test; the release's build has no NODE_ENV, so this one has none either.
  const { NODE_ENV: _test, ...env } = process.env
  execFileSync(process.execPath, ['scripts/build.ts'], { cwd: root, stdio: 'pipe', env })
  const out = mkdtempSync(join(tmpdir(), 'ebdfy-ui-pack-'))
  const answer = execFileSync('pnpm', ['pack', '--json', '--pack-destination', out], { cwd: root, encoding: 'utf8' })
  // SAFETY: pnpm pack --json prints the tarball's path and the files it holds.
  const { filename, files: list } = JSON.parse(answer) as { filename: string; files: { path: string }[] }
  files = list.map((file) => file.path)
  tarball = filename
  packedText = execFileSync('tar', ['-xzOf', filename, 'package/package.json'], { encoding: 'utf8' })
  packed = JSON.parse(packedText)
  license = execFileSync('tar', ['-xzOf', filename, 'package/LICENSE'], { encoding: 'utf8' })
}, 120_000)

test('the tarball holds the scripts, their fonts, the types, the manifest and the licence', () => {
  expect(files).toEqual(
    expect.arrayContaining([
      'dist/site/cdn/ui/v2.js',
      'dist/site/cdn/ui/v2.css',
      'dist/types/v2/button.d.ts',
      'dist/types/v2-elements.d.ts',
      'dist/types/v2-react.d.ts',
      'dist/custom-elements-v2.json',
      'LICENSE',
      'package.json',
    ]),
  )
  // v2.css loads its fonts from fonts/ beside itself.
  expect(files.filter((file) => file.startsWith('dist/site/cdn/ui/fonts/') && file.endsWith('.woff2'))).not.toEqual([])
})

test('the tarball holds nothing else: no source, tests, docs site or playground', () => {
  const shipped = /^(dist\/site\/cdn\/ui\/|dist\/types\/|dist\/custom-elements-v2\.json$|LICENSE$|package\.json$)/
  expect(files.filter((file) => !shipped.test(file))).toEqual([])
  expect(files.filter((file) => file.includes('playground'))).toEqual([])
})

test('the packed package.json is the public 2.1.0, with nothing to install beside it', () => {
  expect(packed).toMatchObject({ name: '@ebdfy/ui', version: '2.1.0', license: 'MIT' })
  expect(packed).not.toHaveProperty('private')
  expect(packedText).not.toContain('catalog:')
  // v2's scripts bundle no library, so an app installs nothing else with the kit.
  expect(packed).not.toHaveProperty('dependencies')
})

test('the package itself is v2: its main export is v2.js, and v2.css is exported beside it', () => {
  expect(packed.exports['.']).toEqual({ types: './dist/types/v2-elements.d.ts', default: './dist/site/cdn/ui/v2.js' })
  expect(packed.exports['./v2.css']).toBe('./dist/site/cdn/ui/v2.css')
  expect(packed.customElements).toBe('dist/custom-elements-v2.json')
})

test('each export names a file in the tarball', () => {
  const targets = Object.values(packed.exports).flatMap((target) =>
    typeof target === 'string' ? [target] : Object.values(target),
  )
  expect(targets.length).toBeGreaterThan(0)
  for (const target of targets) expect(files).toContain(target.replace(/^\.\//, ''))
})

test('the licence is MIT', () => {
  expect(license).toMatch(/^MIT License\n\nCopyright \(c\) 2026 ebdfy\n/)
})

// An app that installs the package and imports it, as a TypeScript user of npm would. A .tsx app
// is a React 19 app, with React's types beside the package.
function consumer(code: string, file = 'app.ts'): string {
  const app = mkdtempSync(join(tmpdir(), 'ebdfy-ui-consumer-'))
  mkdirSync(join(app, 'node_modules/@ebdfy/ui'), { recursive: true })
  execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', join(app, 'node_modules/@ebdfy/ui')])
  writeFileSync(join(app, 'package.json'), '{"type":"module"}')
  writeFileSync(join(app, file), code)
  const react = file.endsWith('.tsx')
  if (react) {
    mkdirSync(join(app, 'node_modules/@types'))
    symlinkSync(join(root, 'node_modules/@types/react'), join(app, 'node_modules/@types/react'))
  }
  const options: Record<string, unknown> = {
    module: 'nodenext',
    lib: ['es2023', 'dom'],
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    types: [],
  }
  if (react) options.jsx = 'react-jsx'
  writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: options, files: [file] }))
  try {
    execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', app], { encoding: 'utf8' })
    return ''
  } catch (error) {
    // SAFETY: execFileSync throws an error carrying the child's stdout, where tsc writes.
    return (error as { stdout: string }).stdout
  }
}

test("importing the package gives an npm user's TypeScript every element's type", () => {
  // SAFETY: the manifest is the custom-elements schema, whose declarations may carry a tagName.
  const manifest = JSON.parse(readFileSync(join(root, 'dist/custom-elements-v2.json'), 'utf8')) as {
    modules: { declarations?: { tagName?: string }[] }[]
  }
  const tags = manifest.modules.flatMap((m) => (m.declarations ?? []).flatMap((d) => (d.tagName ? [d.tagName] : [])))
  expect(tags).toContain('e-button')
  const lines = tags.map((tag, i) => `export const e${i}: HTMLElementTagNameMap['${tag}'] | undefined = undefined`)
  expect(consumer(`import '@ebdfy/ui'\n${lines.join('\n')}\n`)).toBe('')
})

// The docs tell an app to call the ebdfy global, as v2.js sets it on the page.
test("importing the package gives an npm user's TypeScript the ebdfy global", () => {
  const code = `import '@ebdfy/ui'
ebdfy.modal.show('edit-customer')
ebdfy.toast('Saved')
`
  expect(consumer(code)).toBe('')
})

test("an npm user's TypeScript refuses a value an element's property does not allow", () => {
  const code = `import '@ebdfy/ui'
const box = document.createElement('e-checkbox')
box.checked = true
box.checked = 'yes'
`
  expect(consumer(code)).toMatch(/app\.ts\(4,1\): error TS2322/)
})

// v2's tags, for a React 19 app: its types come with `@ebdfy/ui/v2/react`, and need nothing at run time.
const reactApp = (body: string) => `import type {} from '@ebdfy/ui/v2/react'
export const view = (
  <form>
    ${body}
  </form>
)
`

test("a React 19 app's TSX renders v2 tags with their own attributes", () => {
  const app = reactApp(`<e-button tone="primary">Save</e-button>
    <e-text-field label="Phone" name="phone" />
    <e-courier-status status="PICKED_UP" />
    <e-progress-bar value={50} label="Upload" />`)
  expect(consumer(app, 'app.tsx')).toBe('')
})

test("a React 19 app's TSX refuses a tone e-button does not have", () => {
  expect(consumer(reactApp('<e-button tone="loud">Save</e-button>'), 'app.tsx')).toMatch(
    /app\.tsx\(4,15\): error TS2322/,
  )
})

test("a React 19 app's TSX refuses an attribute e-button does not have", () => {
  expect(consumer(reactApp('<e-button colour="red">Save</e-button>'), 'app.tsx')).toMatch(
    /app\.tsx\(4,15\): error TS2322/,
  )
})

test("importing @ebdfy/ui/v2 types document.querySelector('e-table') as the table's class", () => {
  const code = `import '@ebdfy/ui/v2'
export const table: number = document.querySelector('e-table')
`
  expect(consumer(code)).toMatch(/Type 'ETable \| null' is not assignable to type 'number'/)
})

test('every tag in the v2 manifest is in HTMLElementTagNameMap', () => {
  // SAFETY: the manifest is the custom-elements schema, whose declarations may carry a tagName.
  const manifest = JSON.parse(readFileSync(join(root, 'dist/custom-elements-v2.json'), 'utf8')) as {
    modules: { declarations?: { tagName?: string; name: string }[] }[]
  }
  const tags = manifest.modules.flatMap((m) => (m.declarations ?? []).filter((d) => d.tagName))
  expect(tags.map((d) => d.tagName)).toEqual(expect.arrayContaining(['e-button', 'e-text-field', 'e-table', 'e-row']))
  const lines = tags.map((d, i) => `export const e${i}: HTMLElementTagNameMap['${d.tagName}'] | undefined = undefined`)
  expect(consumer(`import '@ebdfy/ui/v2'\n${lines.join('\n')}\n`)).toBe('')
})
