// Builds what the three hosts serve into dist/site: cdn holds v2.css, v2.js, v2-host.css, v2-host.js
// and the fonts; ui holds the docs and the playground, and sample-app the playground's app. dist also
// gets the v2 manifest and the TypeScript declarations.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'vite'

import { generateTypes, generateV2Manifest, writeV2Types } from './declarations.ts'
import { bundleSheet, fillPage, production, type Origins } from './pages.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

// Each entry is a self-contained ES module, so no page loads a shared chunk.
export async function buildEntry(name: 'v2' | 'v2-host', outDir: string): Promise<void> {
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

// A stylesheet and the files it imports, as one minified file. Its url()s stay as written, so they
// name files beside it on the CDN.
export async function buildCss(name: 'v2' | 'v2-host', outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true })
  await writeFile(`${outDir}/${name}.css`, bundleSheet(name, true))
}

// v2.js fetches the icon sprite from icons.svg beside itself, and the district picker's upazilas
// from areas.json.
export async function copySprite(outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true })
  await cp(`${root}src/v2/icons.svg`, `${outDir}/icons.svg`)
  await cp(`${root}src/v2/areas.json`, `${outDir}/areas.json`)
}

// What the three hosts serve, under out/cdn/ui, out/ui and out/sample-app, with the pages naming the
// given origins: the ebdfy hosts for a release, local servers for the speed checks.
export async function buildSite(out: string, origins: Origins): Promise<void> {
  const cdn = `${out}/cdn/ui`
  await buildEntry('v2', cdn)
  await buildEntry('v2-host', cdn)
  await buildCss('v2', cdn)
  await buildCss('v2-host', cdn)
  await copySprite(cdn)
  // v2.css names the fonts in fonts/ beside itself.
  await cp(`${root}src/fonts`, `${cdn}/fonts`, { recursive: true })

  for (const site of ['ui', 'sample-app']) {
    for (const entry of await readdir(`${root}site/${site}`, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue
      const from = `${entry.parentPath}/${entry.name}`
      const to = from.replace(`${root}site/`, `${out}/`)
      await mkdir(dirname(to), { recursive: true })
      if (entry.name.endsWith('.html')) await writeFile(to, fillPage(await readFile(from, 'utf8'), origins, from))
      else await cp(from, to)
    }
  }
}

async function buildAll(): Promise<void> {
  await rm(`${root}dist`, { recursive: true, force: true })
  await buildSite(`${root}dist/site`, production)
  generateTypes()
  writeV2Types(generateV2Manifest())
}

if (import.meta.main) await buildAll()
