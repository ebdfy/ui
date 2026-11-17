// The docs, the playground and the sample app are plain HTML pages. They name the CDN and the
// sample app's origin with placeholders, filled with local servers in development and with the
// ebdfy hosts in the build.
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import { bundle } from 'lightningcss'
import type { Plugin } from 'vite'

import { reportsPath } from '../src/playground-admin.ts'
import { createPlaygroundApi, type Jwks, verifyIdToken } from '../src/playground-api.ts'
import { sitePage, siteRedirect } from '../src/site-routes.ts'
import { panelHeader } from '../src/v2-host-panel.ts'
import { adminChrome } from './admin-chrome.ts'
import { contentFake } from './content-fake.ts'
import { framePage, pathOf } from './docs.ts'
import { newReportPath, reportFake, reportsFake } from './reports-fake.ts'
import { storeFake, storePath } from './store-fake.ts'

export interface Origins {
  cdn: string
  sampleApp: string
  ui: string
}

export const production: Origins = {
  cdn: 'https://cdn.ebdfy.com',
  sampleApp: 'https://sample-app.ebdfy.com',
  ui: 'https://ui.ebdfy.com',
}

const uiSite = fileURLToPath(new URL('../site/ui/', import.meta.url))

// file is the page's path on disk; a docs page under site/ui also gets the docs frame.
// A playground page names the Admin's chrome, drawn for its own address.
export function fillPage(html: string, origins: Origins, file = ''): string {
  if (file.startsWith(uiSite)) {
    const path = pathOf(file.slice(uiSite.length))
    html = framePage(html, path)
    if (html.includes('%EB_ADMIN_CHROME%')) html = html.replace('%EB_ADMIN_CHROME%', adminChrome(path))
  }
  return html
    .replaceAll('%EB_CDN%', origins.cdn)
    .replaceAll('%EB_SAMPLE_APP%', origins.sampleApp)
    .replaceAll('%EB_UI%', origins.ui)
}

const src = fileURLToPath(new URL('../src/', import.meta.url))

// A v2 stylesheet bundled as the build bundles it, its url()s as written: they name files beside it.
export function bundleSheet(name: 'v2' | 'v2-host', minify: boolean): Uint8Array {
  return bundle({ filename: `${src}${name}.css`, minify }).code
}

// v2.css, the fonts it names and the ebdfy mark, answered at the paths the CDN has them, so a page
// names the same URL in development as in production.
function v2Files(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const path = req.url?.split('?')[0] ?? ''
  const sheet = /^\/ui\/(v2|v2-host)\.css$/.exec(path)?.[1]
  const font = /^\/ui\/fonts\/([\w.-]+\.woff2)$/.exec(path)?.[1]
  if (sheet === 'v2' || sheet === 'v2-host') {
    res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'no-cache' })
    return res.end(bundleSheet(sheet, false))
  }
  if (path === '/ui/ebdfy-mark.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml' })
    return res.end(readFileSync(`${src}v2/ebdfy-mark.svg`))
  }
  if (font && existsSync(`${src}fonts/${font}`)) {
    res.writeHead(200, { 'content-type': 'font/woff2', 'access-control-allow-origin': '*' })
    return res.end(readFileSync(`${src}fonts/${font}`))
  }
  next()
}

// The HTML file a page's path names under a site's folder, if there is one.
function pageFile(root: string, path: string): string | null {
  if (!path.startsWith('/') || path.includes('..') || /\.\w+$/.test(path)) return null
  for (const file of [`${root}${path}.html`, `${root}${path.replace(/\/$/, '')}/index.html`]) {
    if (existsSync(file)) return file
  }
  return null
}

// A page's title and its e-admin-panel, which is all a move between Admin pages takes.
export function panelOf(html: string): string {
  const title = /<title>[\s\S]*?<\/title>/.exec(html)?.[0] ?? ''
  const panel = /<e-admin-panel\b[\s\S]*<\/e-admin-panel>/.exec(html)?.[0] ?? ''
  return `${title}\n${panel}`
}

// In development the pages load v2's scripts and stylesheets, which this serves from the source.
export function pagesPlugin(origins: Origins): Plugin {
  return {
    name: 'ebdfy-pages',
    configureServer(server) {
      server.middlewares.use(v2Files)
      // An old /v2/ link moves to the root, and a deep link is served the one page that stands for
      // it, as the hosting Worker does both.
      const folder = basename(server.config.root)
      // The sample app's dev backend checks the ID token as a real app's backend would, and answers
      // what it read. The production sample app stays static.
      if (folder === 'sample-app') {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'GET' || req.url?.split('?')[0] !== '/api/orders') return next()
          const send = (status: number, body: { store: string; language?: string } | { error: string }) => {
            res.writeHead(status, { 'content-type': 'application/json' })
            res.end(JSON.stringify(body))
          }
          try {
            const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
            if (!bearer) throw new Error('The request has no bearer token.')
            // SAFETY: the dev ui server's /dev/jwks.json answers a JWKS.
            const jwks = (await (await fetch(`${origins.ui}/dev/jwks.json`)).json()) as Jwks
            const claims = await verifyIdToken(bearer, jwks, { audience: 'app_sample' })
            send(200, { store: claims.store, language: req.headers['accept-language'] })
          } catch (error) {
            send(401, { error: error instanceof Error ? error.message : String(error) })
          }
        })
      }
      // The playground's Store page answers a save, as the Admin's Worker will, its Reports page
      // keeps the cards a staff member arranged, its reports answer and save, and so do its Content
      // pages and Products' import.
      if (folder === 'ui') {
        const served = (path: string) => () => {
          const file = `${server.config.root}${path}.html`
          return server.transformIndexHtml(file.slice(server.config.root.length), readFileSync(file, 'utf8'))
        }
        server.middlewares.use(storeFake(served(storePath), panelOf))
        server.middlewares.use(reportsFake(served(reportsPath), panelOf, panelHeader))
        server.middlewares.use(reportFake(served(newReportPath), panelOf, panelHeader))
        server.middlewares.use(contentFake((path) => served(path)(), panelOf))
      }
      server.middlewares.use((req, res, next) => {
        const [path = '', query] = (req.url ?? '').split('?')
        const moved = siteRedirect(folder, path, query === undefined ? '' : `?${query}`)
        if (moved) return res.writeHead(301, { location: moved }).end()
        const page = sitePage(folder, path)
        if (page) req.url = `${page}.html${query === undefined ? '' : `?${query}`}`
        // One address answers a whole page or, asked with the panel header, its panel alone.
        const file = pageFile(server.config.root, page ?? path)
        if (!file) return next()
        res.setHeader('vary', panelHeader)
        if (!req.headers[panelHeader.toLowerCase()]) return next()
        const answer = async () => {
          try {
            const html = await server.transformIndexHtml(
              file.slice(server.config.root.length),
              readFileSync(file, 'utf8'),
            )
            res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store', vary: panelHeader })
            res.end(panelOf(html))
          } catch (error) {
            next(error instanceof Error ? error : new Error(String(error)))
          }
        }
        void answer()
      })
    },
    resolveId(id) {
      const script = /^\/ui\/(v2|v2-host)\.js$/.exec(id)?.[1]
      return script ? `${src}${script}.ts` : undefined
    },
    transformIndexHtml: (html, ctx) => fillPage(html, origins, ctx.filename),
  }
}

// Lets a Vite server's Node middleware stack run the same handler as the Worker.
function playgroundMiddleware(api: ReturnType<typeof createPlaygroundApi>) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    if (!req.url?.startsWith('/dev/')) return next()
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
        const request = new Request(`http://${req.headers.host}${req.url}`, {
          method: req.method,
          headers,
          body: hasBody ? Buffer.concat(chunks) : undefined,
        })
        const response = await api(request)
        if (!response) return next()
        res.writeHead(response.status, Object.fromEntries(response.headers))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}

// Serves the playground's ID tokens, keys and fake Admin API under /dev/, signed with a key made
// when the server starts, as the ui-hosting Worker serves them on ui.ebdfy.com.
export function playgroundApiPlugin(): Plugin {
  return {
    name: 'ebdfy-playground-api',
    configureServer(server) {
      server.middlewares.use(playgroundMiddleware(createPlaygroundApi()))
    },
  }
}
