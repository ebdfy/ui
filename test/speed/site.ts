// The built site, served as the three ebdfy hosts serve it: the docs and playground, the CDN and the
// sample app, each on its own local origin, gzipped as the CDN sends them, so a page's bytes and its
// timings over a throttled network are what a phone would get.
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { buildSite } from '../../scripts/build.ts'
import { sitePage } from '../../src/site-routes.ts'

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

// A path as the hosts' assets layer finds it: /playground is playground.html, /orders orders.html.
function fileFor(folder: string, path: string): string | null {
  const plain = join(folder, decodeURIComponent(path))
  for (const candidate of [plain, `${plain}.html`, join(plain, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

function serve(folder: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname
    // A page that stands for many addresses, such as each order's, as the hosting Worker serves it.
    const file = fileFor(folder, sitePage(basename(folder), path) ?? path)
    if (!file) {
      res.writeHead(404).end('Not found')
      return
    }
    const body = readFileSync(file)
    const type = types[extname(file)] ?? 'application/octet-stream'
    // Fonts are compressed already, as the CDN leaves them.
    const zip = !type.startsWith('font/') && String(req.headers['accept-encoding']).includes('gzip')
    res.setHeader('content-type', type)
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('cache-control', 'no-store')
    if (zip) res.setHeader('content-encoding', 'gzip')
    res.writeHead(200)
    res.end(zip ? gzipSync(body, { level: 9 }) : body)
  })
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolve({ server, origin: `http://127.0.0.1:${port}` })
    }),
  )
}

export async function startSite() {
  const out = mkdtempSync(join(tmpdir(), 'ebdfy-speed-'))
  const [ui, cdn, sampleApp] = await Promise.all([
    serve(join(out, 'ui')),
    serve(join(out, 'cdn')),
    serve(join(out, 'sample-app')),
  ])
  // Three ports are three origins, as the three ebdfy hosts are.
  await buildSite(out, { ui: ui.origin, cdn: cdn.origin, sampleApp: sampleApp.origin })
  return {
    out,
    ui: ui.origin,
    cdn: cdn.origin,
    sampleApp: sampleApp.origin,
    close: () => Promise.all([ui, cdn, sampleApp].map(({ server }) => new Promise((done) => server.close(done)))),
  }
}
