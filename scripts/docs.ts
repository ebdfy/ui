// Puts the docs frame around a docs page's <main>, in development and in the build. Every docs page
// gets v2's frame; the playground keeps its own.
import { frameV2Page } from './docs-v2.ts'

// The page a site/ui file serves: components/button.html is /components/button, index.html is /.
export function pathOf(file: string): string {
  return `/${file.replace(/(index)?\.html$/, '')}`
}

export function framePage(html: string, path: string): string {
  if (path === '/playground') return html
  return frameV2Page(html, path)
}
