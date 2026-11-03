// Builds what the three hosts serve into dist/site: cdn holds v1.js, host.js and the fonts, ui the
// docs and the playground, and sample-app the playground's app. dist also gets the manifest and the
// TypeScript declarations.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

import { generateManifest, generateTypes } from './declarations.ts'
import { fillPage, production } from './pages.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
export const cdnDir = `${root}dist/site/cdn/ui`

// Each entry is a self-contained ES module, so no page loads a shared chunk.
export async function buildEntry(name: 'v1' | 'host', outDir: string): Promise<void> {
  await build({
    root,
    configFile: false,
    logLevel: 'warn',
    build: {
      outDir,
      emptyOutDir: false,
      target: 'chrome111',
      lib: { entry: `src/${name}.ts`, formats: ['es'], fileName: () => `${name}.js` },
    },
  })
}

async function buildAll(): Promise<void> {
  await rm(`${root}dist`, { recursive: true, force: true })
  await buildEntry('v1', cdnDir)
  await buildEntry('host', cdnDir)
  // v1.js finds the fonts in fonts/ beside itself.
  await cp(`${root}src/fonts`, `${cdnDir}/fonts`, { recursive: true })

  for (const site of ['ui', 'sample-app']) {
    for (const entry of await readdir(`${root}site/${site}`, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const from = `${entry.parentPath}/${entry.name}`
      const out = from.replace(`${root}site/`, `${root}dist/site/`)
      await mkdir(dirname(out), { recursive: true })
      if (entry.name.endsWith('.html')) await writeFile(out, fillPage(await readFile(from, 'utf8'), production))
      else await cp(from, out)
    }
  }

  generateManifest()
  generateTypes()
}

if (import.meta.main) await buildAll()
