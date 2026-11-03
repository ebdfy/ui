// The docs, the playground and the sample app are plain HTML pages. They name the CDN and the
// sample app's origin with placeholders, filled with local servers in development and with the
// ebdfy hosts in the build.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

import { createPlaygroundApi } from '../src/playground-api.ts'

export interface Origins {
  cdn: string
  sampleApp: string
}

export const production: Origins = {
  cdn: 'https://cdn.ebdfy.com',
  sampleApp: 'https://sample-app.ebdfy.com',
}

export function fillPage(html: string, origins: Origins): string {
  return html.replaceAll('%EB_CDN%', origins.cdn).replaceAll('%EB_SAMPLE_APP%', origins.sampleApp)
}

// In development the pages load /ui/v1.js and /ui/host.js, which this serves from the source.
export function pagesPlugin(origins: Origins): Plugin {
  return {
    name: 'ebdfy-pages',
    resolveId(id) {
      const entry = /^\/ui\/(v1|host)\.js$/.exec(id)?.[1]
      return entry ? fileURLToPath(new URL(`../src/${entry}.ts`, import.meta.url)) : undefined
    },
    transformIndexHtml: (html) => fillPage(html, origins),
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
