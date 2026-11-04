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
  // Vitest sets NODE_ENV to test, which would build lit's development code; the release's build
  // has no NODE_ENV.
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
      'dist/site/cdn/ui/v1.js',
      'dist/site/cdn/ui/host.js',
      'dist/types/v1.d.ts',
      'dist/types/host.d.ts',
      'dist/types/components/button.d.ts',
      'dist/custom-elements.json',
      'LICENSE',
      'package.json',
    ]),
  )
  // v1.js loads its fonts from fonts/ beside itself.
  expect(files.filter((file) => file.startsWith('dist/site/cdn/ui/fonts/') && file.endsWith('.woff2'))).not.toEqual([])
})

test('the tarball holds nothing else: no source, tests, docs site or playground', () => {
  const shipped = /^(dist\/site\/cdn\/ui\/|dist\/types\/|dist\/custom-elements\.json$|LICENSE$|package\.json$)/
  expect(files.filter((file) => !shipped.test(file))).toEqual([])
  expect(files.filter((file) => file.includes('playground'))).toEqual([])
})

test('the packed package.json is the public 1.1.0 with its catalog versions written out', () => {
  expect(packed).toMatchObject({ name: '@ebdfy/ui', version: '1.1.0', license: 'MIT' })
  expect(packed).not.toHaveProperty('private')
  expect(packedText).not.toContain('catalog:')
  expect(packed.dependencies).toEqual({ lit: expect.stringMatching(/^\^?\d+\.\d+\.\d+$/) })
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

// An app that installs the package and imports it, as a TypeScript user of npm would.
function consumer(code: string): string {
  const app = mkdtempSync(join(tmpdir(), 'ebdfy-ui-consumer-'))
  mkdirSync(join(app, 'node_modules/@ebdfy/ui'), { recursive: true })
  execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', join(app, 'node_modules/@ebdfy/ui')])
  symlinkSync(join(root, 'node_modules/lit'), join(app, 'node_modules/lit'))
  writeFileSync(join(app, 'package.json'), '{"type":"module"}')
  writeFileSync(join(app, 'app.ts'), code)
  const options = { module: 'nodenext', lib: ['es2023', 'dom'], strict: true, noEmit: true, skipLibCheck: false }
  writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: options, files: ['app.ts'] }))
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
  const manifest = JSON.parse(readFileSync(join(root, 'dist/custom-elements.json'), 'utf8')) as {
    modules: { declarations?: { tagName?: string }[] }[]
  }
  const tags = manifest.modules.flatMap((m) => (m.declarations ?? []).flatMap((d) => (d.tagName ? [d.tagName] : [])))
  expect(tags).toContain('eb-button')
  const lines = tags.map((tag, i) => `export const e${i}: HTMLElementTagNameMap['${tag}'] | undefined = undefined`)
  expect(consumer(`import '@ebdfy/ui'\nimport '@ebdfy/ui/host'\n${lines.join('\n')}\n`)).toBe('')
})

test("an npm user's TypeScript refuses a value an element's attribute does not allow", () => {
  const code = `import '@ebdfy/ui'
const button = document.createElement('eb-button')
button.variant = 'primary'
button.variant = 'shiny'
`
  expect(consumer(code)).toMatch(/app\.ts\(4,1\): error TS2322/)
})

test('the tarball holds the release build, not a test build', () => {
  const built = execFileSync('tar', ['-xzOf', tarball, 'package/dist/site/cdn/ui/v1.js'], { encoding: 'utf8' })
  expect(built).not.toContain('Lit is in dev mode')
})
