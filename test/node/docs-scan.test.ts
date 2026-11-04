// Scans every docs page as a reader sees it: the type on the Ink scale with Bangla never below its
// floor, no sideways scroll on a phone, and the focus ring on every stop of the keyboard.
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

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

// Every colour the page's own elements draw, read where it renders, that no design token gives.
// The components' shadow roots are tokens.test.ts's to check; a component that sets a token of its
// own, as the bulk bar does for its dark surface, adds that value for what is slotted into it.
function colourProblems(): string[] {
  const names = [
    ...new Set(
      [...document.styleSheets, ...document.adoptedStyleSheets].flatMap((sheet) => {
        try {
          return [...sheet.cssRules].flatMap((rule) => (rule instanceof CSSStyleRule ? [...rule.style] : []))
        } catch {
          return []
        }
      }),
    ),
  ].filter((name) => name.startsWith('--eb-color-'))
  const probe = document.createElement('i')
  document.body.append(probe)
  const canonical = (value: string) => {
    probe.style.color = ''
    probe.style.color = value
    return getComputedStyle(probe).color
  }
  // A token's value in either theme: Foundations shows each token's light and dark swatch side by side.
  const allowed = new Set(['rgba(0, 0, 0, 0)'])
  const root = document.documentElement
  const chosen = root.dataset.theme
  for (const theme of ['light', 'dark']) {
    root.dataset.theme = theme
    for (const scope of [root, ...document.querySelectorAll('*')].filter((el) => el === root || el.shadowRoot)) {
      const style = getComputedStyle(scope)
      for (const name of names) {
        const value = style.getPropertyValue(name).trim()
        if (value) allowed.add(canonical(value))
      }
    }
  }
  if (chosen) root.dataset.theme = chosen
  else delete root.dataset.theme
  probe.remove()
  const found = new Set<string>()
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('script, style, template, svg') || !el.getClientRects().length) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden') continue
    const used = [
      ['color', style.color],
      ['background', style.backgroundColor],
      ...(['Top', 'Right', 'Bottom', 'Left'] as const)
        .filter((side) => style[`border${side}Style`] !== 'none' && Number.parseFloat(style[`border${side}Width`]) > 0)
        .map((side) => [`border-${side.toLowerCase()}`, style[`border${side}Color`]]),
      ...(style.outlineStyle !== 'none' ? [['outline', style.outlineColor]] : []),
    ]
    for (const [what, value] of used) {
      if (!allowed.has(value!))
        found.add(`<${el.localName}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}> ${what} ${value}`)
    }
  }
  return [...found]
}

// Every example's frame shows all of its demo, or lets it scroll, and its Copy button sits clear of
// the code, a phone's 44 px tall.
function frameProblems(width: number): string[] {
  const found: string[] = []
  for (const demo of document.querySelectorAll<HTMLElement>('.demo')) {
    if (demo.scrollWidth > demo.clientWidth + 1 && getComputedStyle(demo).overflowX !== 'auto')
      found.push(`a demo is ${demo.scrollWidth} px wide in a ${demo.clientWidth} px frame and cut off`)
  }
  for (const copy of document.querySelectorAll<HTMLElement>('button.copy')) {
    const button = copy.getBoundingClientRect()
    const code = copy.parentElement!.querySelector('pre')!.getBoundingClientRect()
    if (width < 640 && button.height < 44) found.push(`Copy is ${button.height} px tall`)
    if (button.bottom > code.top && button.top < code.bottom) found.push('Copy sits over the code')
  }
  return [...new Set(found)]
}

// Each page at a phone's width and a computer's, read in light and dark, in English and, where it
// has a switch to it, in Bangla: no sideways scroll, every run of text on the Ink scale with Bangla
// never below its floor, and every colour from the tokens.
for (const path of paths) {
  for (const width of [360, 1280]) {
    test(
      `${path} at ${width} px, light and dark, English and Bangla: no sideways scroll, type on the scale, colours from the tokens`,
      async () => {
        const { page, errors } = await open(path, width)
        const bangla = page.locator('#language eb-button[data-lang="bn"]')
        const english = page.locator('#language eb-button[data-lang="en"]')
        const hasBangla = (await bangla.count()) > 0
        const problems: string[] = []
        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme })
          for (const lang of hasBangla ? ['en', 'bn'] : ['en']) {
            if (hasBangla) await (lang === 'bn' ? bangla : english).click()
            await page.evaluate(() => document.fonts.ready)
            const where = `${scheme} ${lang}`
            const scroll = await page.evaluate(() => document.documentElement.scrollWidth)
            if (scroll > width) problems.push(`${where}: scrolls sideways to ${scroll} px`)
            for (const problem of await page.evaluate(typeProblems)) problems.push(`${where}: ${problem}`)
            for (const problem of await page.evaluate(colourProblems)) problems.push(`${where}: ${problem}`)
            for (const problem of await page.evaluate(frameProblems, width)) problems.push(`${where}: ${problem}`)
          }
        }
        expect(problems).toEqual([])
        expect(errors).toEqual([])
      },
      slow,
    )
  }

  test(
    `on ${path} the first Tab lands on "Skip to content"`,
    async () => {
      const { page } = await open(path, 1280)
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Skip to content')
    },
    slow,
  )
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
  // The loop ends when the focus comes back to the element it first reached: two buttons can read
  // the same, so it goes by the element, not its words.
  const seen = window as unknown as { firstStop?: Element }
  const again = seen.firstStop === el
  seen.firstStop ??= el
  return {
    again,
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
        // A disabled button is no Tab stop, nor is a bulk bar's action it folds into its menu on a
        // phone, so only the others count.
        const expected = await page.evaluate(
          () =>
            [...document.querySelectorAll('#examples eb-button:not([disabled]), #examples eb-link[href]')].filter(
              (el) => !(el.parentElement?.localName === 'eb-bulk-bar' && getComputedStyle(el).display === 'none'),
            ).length,
        )
        // The skip link takes the keyboard past the header and the sidebar into the page. A Forms
        // page focuses its Focused example on load, so the walk starts on the link itself.
        await page.locator('a.skip').focus()
        await page.keyboard.press('Enter')
        const rings = new Set<string>()
        let reached = 0
        for (let i = 0; i < 80; i++) {
          await page.keyboard.press('Tab')
          const state = await page.evaluate(focusState)
          if (!state) continue
          if (state.again) break
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
