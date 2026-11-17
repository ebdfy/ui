// The playground's Content pages and Products' import save to nothing, but the dev server answers a
// save as the Admin's Worker will: the page as posted with its toast, or the field the Admin refuses
// with its error. Nothing is kept between saves, so a reload shows the page as it is on disk.
import type { IncomingMessage, ServerResponse } from 'node:http'

import { contentPagePath, contentPages, productsImportPath } from '../src/playground-admin.ts'
import { saveBarHeader, withAttribute } from './store-fake.ts'

export const contentMenuPath = contentPages[0]!.path

type Words = readonly [en: string, bn: string]

interface Answer {
  status: 200 | 422
  html: string
}

const escapeText = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const escape = (text: string) => escapeText(text).replaceAll('"', '&quot;')

const titleMissing = ['Enter a title.', 'একটি শিরোনাম লিখুন।'] as const
const bodyLong = ['Write at most 512 KB of content.', 'সর্বোচ্চ ৫১২ KB কনটেন্ট লিখুন।'] as const
const menuRefused = ['These menu items could not be saved.', 'এই মেনু আইটেমগুলো সংরক্ষণ করা যায়নি।'] as const
const fileKind = ['Pick a .csv file', 'একটি .csv ফাইল বাছাই করুন'] as const
const fileLarge = ['Pick a file of at most 5 MB', 'সর্বোচ্চ ৫ MB-এর একটি ফাইল বাছাই করুন'] as const

// The page as it was, with an error on the one tag.
const refuse = (html: string, tag: RegExp, [english, bangla]: Words): Answer => ({
  status: 422,
  html: html.replace(tag, (found) => withAttribute(withAttribute(found, 'error', english), 'data-bn-error', bangla)),
})

const saved = (html: string, [english, bangla]: Words): Answer => ({
  status: 200,
  html: html.replace(/<e-admin-panel\b[^>]*>/, (tag) =>
    withAttribute(withAttribute(tag, 'toast', english), 'data-bn-toast', bangla),
  ),
})

const titleField = /<e-text-field\b[^>]*\sname="title"[^>]*>/
const withTitle = (html: string, title: string) => html.replace(titleField, (tag) => withAttribute(tag, 'value', title))

// The page's title and body as posted; the body goes back in its text area as text.
export function pageAnswer(html: string, posted: FormData): Answer {
  const title = String(posted.get('title') ?? '').trim()
  const body = String(posted.get('body') ?? '')
  if (!title) return refuse(html, titleField, titleMissing)
  if (body.length > 512 * 1024) return refuse(html, /<e-rich-text\b[^>]*>/, bodyLong)
  const page = withTitle(html, title).replace(
    /(<textarea name="body">)[\s\S]*?(<\/textarea>)/,
    (_, open: string, close: string) => `${open}${escapeText(body)}${close}`,
  )
  return saved(page, ['Page saved', 'পেজ সংরক্ষিত হয়েছে'])
}

interface Item {
  title: string
  resourceId?: string
  url?: string
  items: Item[]
}

// A menu's items as the tree writes them, or null for anything the Admin would refuse: 3 levels, 100
// items, a title of 1 to 255 letters, and either a resourceId or a url that is a path or an http(s) address.
export function menuItems(json: string): Item[] | null {
  let count = 0
  const read = (value: unknown, depth: number): Item[] | null => {
    if (!Array.isArray(value) || (depth > 3 && value.length)) return null
    const items: Item[] = []
    for (const one of value as Record<string, unknown>[]) {
      count++
      const { title, resourceId, url } = one ?? {}
      if (typeof title !== 'string' || !title.trim() || [...title].length > 255) return null
      if ((resourceId === undefined) === (url === undefined)) return null
      if (resourceId !== undefined && (typeof resourceId !== 'string' || !resourceId)) return null
      if (
        url !== undefined &&
        (typeof url !== 'string' || !/^(\/(?![/\\])|https?:\/\/)/.test(url) || /[\\\s]/.test(url))
      )
        return null
      const below = read(one.items ?? [], depth + 1)
      if (!below) return null
      items.push(
        resourceId === undefined ? { title, url: url as string, items: below } : { title, resourceId, items: below },
      )
    }
    return count > 100 ? null : items
  }
  try {
    return read(JSON.parse(json), 1)
  } catch {
    return null
  }
}

// The tree's markup for its items. Titles are the store's own words, never translated.
function treeOf(items: Item[]): string {
  return items
    .map((item) => {
      const target =
        item.resourceId === undefined ? `url="${escape(item.url!)}"` : `resource-id="${escape(item.resourceId)}"`
      return `<e-menu-tree-item label="${escape(item.title)}" ${target}>${treeOf(item.items)}</e-menu-tree-item>`
    })
    .join('')
}

export function menuAnswer(html: string, posted: FormData): Answer {
  const title = String(posted.get('title') ?? '').trim()
  if (!title) return refuse(html, titleField, titleMissing)
  const items = menuItems(String(posted.get('items') ?? ''))
  if (!items) return refuse(html, /<e-menu-tree\b[^>]*>/, menuRefused)
  const page = withTitle(html, title).replace(
    /(<e-menu-tree\b[^>]*>)[\s\S]*?(<\/e-menu-tree\s*>)/,
    (_, open: string, close: string) => `${open}${treeOf(items)}${close}`,
  )
  return saved(page, ['Menu saved', 'মেনু সংরক্ষিত হয়েছে'])
}

// An import takes a .csv of at most 5 MB, as the API's import does, and starts.
export function importAnswer(html: string, posted: FormData): Answer {
  const file = posted.get('file')
  const field = /<e-file-field\b[^>]*>/
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.csv')) return refuse(html, field, fileKind)
  if (file.size > 5_242_880) return refuse(html, field, fileLarge)
  return saved(html, ['Import started', 'ইমপোর্ট শুরু হয়েছে'])
}

const answers: Record<string, (html: string, posted: FormData) => Answer> = {
  [contentPagePath]: pageAnswer,
  [contentMenuPath]: menuAnswer,
  [productsImportPath]: importAnswer,
}

// Answers a POST to one of those pages, and leaves every other request to the next handler. page
// gives a page's HTML as the dev server serves it, and panelOf cuts a page down to its panel.
export function contentFake(page: (path: string) => Promise<string>, panelOf: (html: string) => string) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    const path = req.url?.split('?')[0] ?? ''
    const answer = answers[path]
    if (req.method !== 'POST' || !answer) return next()
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)\b/.test(headers.get('content-type') ?? '')) {
          res.writeHead(415, { 'content-type': 'text/plain' })
          res.end('Send the form')
          return
        }
        const posted = await new Request(`http://${req.headers.host}${req.url}`, {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks),
        }).formData()
        const { status, html } = answer(await page(path), posted)
        const bar = req.headers[saveBarHeader.toLowerCase()] !== undefined
        res.writeHead(status, { 'content-type': 'text/html', 'cache-control': 'no-store' })
        res.end(bar ? panelOf(html) : html)
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
