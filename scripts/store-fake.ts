// The playground's Store page saves to nothing, but the dev server answers a save as the Admin's
// Worker will, so the save bar can be tried against every answer it has to meet: the panel saved,
// the panel with a field's error, a conflict, an expired session and no answer at all.
import type { IncomingMessage, ServerResponse } from 'node:http'

export const saveBarHeader = 'Ebdfy-Save-Bar'
export const storePath = '/playground/settings/store'

const cookieName = 'ebdfy-store-fake'
const phoneError = 'Enter an 11-digit mobile number that starts with 01.'
const phoneErrorBn = '০১ দিয়ে শুরু ১১ সংখ্যার মোবাইল নম্বর লিখুন।'

const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

// A start tag with the attribute set, or dropped when value is false. The tag's other attributes
// keep their place.
export function withAttribute(tag: string, name: string, value: string | boolean): string {
  const bare = tag.replace(new RegExp(`\\s${name}(?:="[^"]*")?(?=[\\s>/])`), '')
  if (value === false) return bare
  // A function, so a $ in the value is not read as a replacement pattern.
  return bare.replace(
    /\s*(\/?)>$/,
    (_, slash: string) => ` ${value === true ? name : `${name}="${escape(value)}"`}${slash}>`,
  )
}

// An empty phone is allowed, as the Admin allows a store to have none.
function phoneRefused(phone: string | undefined): boolean {
  if (!phone) return false
  return !/^01\d{9}$/.test(phone.replaceAll(/\D/g, ''))
}

interface Answer {
  status: 200 | 422
  html: string
}

// The page as the form was posted: each field shows what it was sent, and the answer is the toast
// or the phone's error. Nothing is kept between saves, so a reload shows the page as it is on disk.
export function answerOf(page: string, posted: FormData): Answer {
  // The form has no file input, so a posted value is text.
  const text = (name: string) => (posted.has(name) ? String(posted.get(name)) : undefined)
  const refused = phoneRefused(text('contactPhone'))
  let html = page.replaceAll(/<e-(?:text-field|phone-field|switch)\b[^>]*>/g, (tag) => {
    const name = /\sname="([^"]*)"/.exec(tag)?.[1]
    if (name === undefined) return tag
    if (tag.startsWith('<e-switch')) return withAttribute(tag, 'checked', posted.has(name))
    const value = text(name)
    if (value === undefined) return tag
    const shown = withAttribute(tag, 'value', value)
    if (!refused || name !== 'contactPhone') return shown
    return withAttribute(withAttribute(shown, 'error', phoneError), 'data-bn-error', phoneErrorBn)
  })
  html = html.replaceAll(/<e-select\b[^>]*\sname="([^"]*)"[\s\S]*?<\/e-select>/g, (select, name: string) => {
    const value = text(name)
    if (value === undefined) return select
    return select.replaceAll(/<option\b[^>]*>/g, (option) => {
      const own = /\svalue="([^"]*)"/.exec(option)?.[1]
      return withAttribute(option, 'selected', own === value)
    })
  })
  if (!refused) {
    html = html.replace(/<e-admin-panel\b[^>]*>/, (tag) =>
      withAttribute(withAttribute(tag, 'toast', 'Store saved'), 'data-bn-toast', 'স্টোর সংরক্ষিত হয়েছে'),
    )
  }
  return { status: refused ? 422 : 200, html }
}

const modeOf = (cookie: string | undefined) =>
  cookie
    ?.split(';')
    .map((pair) => pair.trim().split('='))
    .find(([name]) => name === cookieName)?.[1]

// Answers a POST to the Store page, and leaves every other request to the next handler. page gives
// the page's HTML as the dev server serves it, and panelOf cuts a page down to its panel.
export function storeFake(page: () => Promise<string>, panelOf: (html: string) => string) {
  return (req: IncomingMessage, res: ServerResponse, next: (error?: Error) => void) => {
    if (req.method !== 'POST' || req.url?.split('?')[0] !== storePath) return next()
    const mode = modeOf(req.headers.cookie)
    if (mode === 'hang') {
      // No answer is sent and no timer is set. The client closing its connection ends the response,
      // so nothing is left open and the server can close. The request's own close fires once its body
      // is read, so it is not the signal to end on.
      return void req.resume()
    }
    if (mode === 'conflict' || mode === 'expired') {
      req.resume()
      return res.writeHead(mode === 'conflict' ? 409 : 401).end()
    }
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', async () => {
      try {
        const headers = new Headers()
        for (const [name, value] of Object.entries(req.headers)) {
          if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
        }
        const posted = await new Request(`http://${req.headers.host}${req.url}`, {
          method: 'POST',
          headers,
          body: Buffer.concat(chunks),
        }).formData()
        const answer = answerOf(await page(), posted)
        const bar = req.headers[saveBarHeader.toLowerCase()] !== undefined
        res.writeHead(answer.status, { 'content-type': 'text/html', 'cache-control': 'no-store' })
        res.end(bar ? panelOf(answer.html) : answer.html)
      } catch (error) {
        next(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }
}
