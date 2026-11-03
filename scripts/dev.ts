// Serves the docs and the playground on one local origin and the sample app on a second, so the
// bridge checks origins the way it does between ui.ebdfy.com and sample-app.ebdfy.com.
import { fileURLToPath } from 'node:url'

import { createServer, type Plugin, type ViteDevServer } from 'vite'

import { pagesPlugin, playgroundApiPlugin, type Origins } from './pages.ts'

const site = (name: string) => fileURLToPath(new URL(`../site/${name}`, import.meta.url))

async function serve(name: string, port: number, origins: Origins, plugins: Plugin[] = []): Promise<ViteDevServer> {
  const server = await createServer({
    root: site(name),
    configFile: false,
    appType: 'mpa',
    logLevel: 'warn',
    plugins: [pagesPlugin(origins), ...plugins],
    // Lit is plain ES modules, so nothing needs bundling first. Discovering a new import on a page's
    // first load would otherwise rebundle and reload that page, losing what its scripts did.
    optimizeDeps: { noDiscovery: true },
    server: { host: 'localhost', port, strictPort: true },
  })
  return server.listen()
}

export async function startDev(ports = { ui: 5173, sampleApp: 5174 }) {
  const sampleAppUrl = `http://localhost:${ports.sampleApp}`
  const sampleApp = await serve('sample-app', ports.sampleApp, { cdn: '', sampleApp: sampleAppUrl })
  // Only the playground's origin serves /dev/, as only ui.ebdfy.com does in production. If its port
  // is taken, the sample app's server closes again rather than holding its port.
  let ui: ViteDevServer
  try {
    ui = await serve('ui', ports.ui, { cdn: '', sampleApp: sampleAppUrl }, [playgroundApiPlugin()])
  } catch (error) {
    await sampleApp.close()
    throw error
  }
  return {
    ui: `http://localhost:${ports.ui}`,
    sampleApp: sampleAppUrl,
    close: () => Promise.all([ui.close(), sampleApp.close()]),
  }
}

if (import.meta.main) {
  const dev = await startDev()
  console.log(`Docs:        ${dev.ui}/`)
  console.log(`Playground:  ${dev.ui}/playground`)
  console.log(`Sample app:  ${dev.sampleApp}/`)
}
