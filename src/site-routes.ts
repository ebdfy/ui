// The pages that stand for many addresses, as both the dev servers and the hosting Worker serve
// them: the playground for every app page under it, and the sample app's order page for each order.
export function sitePage(folder: string, path: string): string | null {
  if (folder === 'ui' && path.startsWith('/playground/')) return '/playground'
  if (folder === 'sample-app' && /^\/orders\/\d+$/.test(path)) return '/order'
  return null
}

// The docs, the playground and the sample app lived under /v2/ until 2.0.0 moved them to the root,
// so an old link answers 301 to the same page there, its query kept. Leading slashes and
// backslashes collapse to one slash, as /v2//host or /v2/\host would otherwise send the browser to
// that host.
export function siteRedirect(folder: string, path: string, search: string): string | null {
  if (folder !== 'ui' && folder !== 'sample-app') return null
  if (path !== '/v2' && !path.startsWith('/v2/')) return null
  return `${path.slice('/v2'.length).replace(/^[/\\]+/, '/') || '/'}${search}`
}
