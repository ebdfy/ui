// Scans every docs page as a reader sees it: the type on the Ink scale with Bangla never below its
// floor, no sideways scroll on a phone, and the focus ring on every stop of the keyboard.
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

// Each test drives a fresh browser context through a page, which a loaded machine slows down.
const slow = 60_000

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const ui = fileURLToPath(new URL('../../site/ui/', import.meta.url))
const paths = readdirSync(ui, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.html') && file !== 'playground.html')
  .map((file) => `/${file.replace(/(index)?\.html$/, '')}`)

const focus = { light: 'oklch(0.52 0.19 268)', dark: 'oklch(0.74 0.13 268)' }

async function open(path: string, width: number, scheme: 'light' | 'dark' = 'light') {
  const opened = await pages.open('', width)
  await opened.page.emulateMedia({ colorScheme: scheme })
  await opened.page.goto(`${pages.ui}${path}`)
  // Every element upgraded and every font in: what the reader sees, without waiting on the network
  // to fall quiet, which a busy dev server can put off past the test's time.
  await opened.page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
  await opened.page.evaluate(() => document.fonts.ready)
  return opened
}

// The page's languages: English, and Bangla when it has a switch to it.
async function languages(page: Page, read: () => Promise<string[]>): Promise<string[]> {
  const found = await read()
  const bangla = page.locator('#language eb-button[data-lang="bn"]')
  if (!(await bangla.count())) return found
  await bangla.click()
  await page.evaluate(() => document.fonts.ready)
  return [...found, ...(await read())]
}

// Every visible run of text, read where it renders: a node slotted into a shadow root takes its
// style from the slot's parent, not from the host it was written in.
function typeProblems(): string[] {
  const scale: Record<string, string[]> = {
    '12': ['16'],
    '13': ['20'],
    '14': ['20'],
    '15': ['24'],
    '17': ['24'],
    '22': ['32'],
    '30': ['40', '42'],
  }
  const weights = ['400', '500', '600', '650']
  const found = new Set<string>()
  const visit = (root: Document | ShadowRoot) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? ''
      const slot = (node as Text).assignedSlot
      const el = slot ? (slot.parentElement ?? (slot.getRootNode() as ShadowRoot).host) : node.parentElement
      if (!text || !el || el.closest('script, style, title, template')) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      if (!range.getClientRects().length) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden') continue
      const size = String(Number.parseFloat(style.fontSize))
      const lineHeight = String(Number.parseFloat(style.lineHeight))
      const bangla = /[ঀ-৿]/.test(text)
      const where = `<${el.localName}> "${text.slice(0, 24)}" ${style.fontSize}/${style.lineHeight} ${style.fontWeight}`
      if (!scale[size]?.includes(lineHeight)) found.add(`off the scale: ${where}`)
      if (!weights.includes(style.fontWeight)) found.add(`weight off the scale: ${where}`)
      if (style.fontWeight === '650' && Number(size) < 22) found.add(`650 below 22 px: ${where}`)
      if (bangla && (Number(size) < 13 || Number(lineHeight) / Number(size) < 1.4))
        found.add(`Bangla too small: ${where}`)
    }
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) visit(el.shadowRoot)
  }
  visit(document)
  return [...found]
}

for (const path of paths) {
  for (const width of [360, 1280]) {
    test(
      `${path} at ${width} px keeps every run of text on the Ink scale, Bangla at 13 px and 1.4 or more`,
      async () => {
        const { page, errors } = await open(path, width)
        expect(await languages(page, () => page.evaluate(typeProblems))).toEqual([])
        expect(errors).toEqual([])
      },
      slow,
    )
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(
      `${path} at 360 px in ${scheme} has no sideways scroll, in English or Bangla`,
      async () => {
        const { page } = await open(path, 360, scheme)
        const widths = await languages(page, async () => [
          String(await page.evaluate(() => document.documentElement.scrollWidth)),
        ])
        for (const width of widths) expect(Number(width)).toBeLessThanOrEqual(360)
      },
      slow,
    )
  }
}

// The focused element, through every shadow root it sits in.
function focusState() {
  let el = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  if (!el || el === document.body) return null
  // Tab into a framed page focuses that page's own control, which draws its ring in a document this
  // page cannot read; the iframe here only holds the place.
  if (el.localName === 'iframe') return null
  const style = getComputedStyle(el)
  let host: Element | null = el
  while (host && !host.localName.startsWith('eb-') && host.getRootNode() instanceof ShadowRoot) {
    host = (host.getRootNode() as ShadowRoot).host
  }
  const inExamples = Boolean(host?.closest('#examples'))
  // The bulk bar draws its ring in the inverse action colour, which clears 3:1 on its dark surface.
  let inBulkBar = false
  for (let node: Element | null = el; node;) {
    if (node.localName === 'eb-bulk-bar') inBulkBar = true
    const root: Node = node.getRootNode()
    node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null)
  }
  return {
    inBulkBar,
    what: `${host?.localName ?? el.localName}: ${el.textContent?.trim().slice(0, 24)}`,
    inExamples: inExamples && Boolean(host?.localName.startsWith('eb-')),
    ring: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor} ${style.outlineOffset}`,
  }
}

// Light and dark on a computer, and a phone, where a code block too wide for the page scrolls and
// so takes a stop of its own.
const ringRuns = [
  { scheme: 'light', width: 1280 },
  { scheme: 'dark', width: 1280 },
  { scheme: 'light', width: 360 },
] as const

for (const path of paths.filter((p) => p.startsWith('/components/'))) {
  for (const { scheme, width } of ringRuns) {
    test(
      `on ${path} in ${scheme} at ${width} px, Tab reaches every example button and link and each shows the ring`,
      async () => {
        const { page } = await open(path, width, scheme)
        const expected = await page.evaluate(
          () => document.querySelectorAll('#examples eb-button, #examples eb-link[href]').length,
        )
        const rings = new Set<string>()
        let reached = 0
        let first = ''
        for (let i = 0; i < 80; i++) {
          await page.keyboard.press('Tab')
          const state = await page.evaluate(focusState)
          if (!state) continue
          if (state.what === first) break
          first ||= state.what
          rings.add(`${state.what} → ${state.ring}${state.inBulkBar ? ' (bulk bar)' : ''}`)
          if (state.inExamples) reached++
        }
        expect(reached).toBeGreaterThanOrEqual(expected)
        for (const ring of rings) {
          const colour = ring.endsWith('(bulk bar)') ? 'oklch(0.82 0.1 268)' : focus[scheme]
          expect(ring).toMatch(new RegExp(`→ 2px solid ${colour.replace(/[().]/g, '\\$&')} 2px( \\(bulk bar\\))?$`))
        }
      },
      slow,
    )
  }
}
