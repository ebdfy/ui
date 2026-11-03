import { readFileSync, readdirSync } from 'node:fs'

import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

const sampleApp = new URL('../../site/sample-app/', import.meta.url)
// A hex colour counts as a CSS or attribute value (`: #fff`, `="#fff"`), so an order number such as
// "Order #1001" is not one.
const literal = /[:=]\s*["']?#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi

test("the sample app's pages and scripts hold no colour of their own, only tokens", () => {
  const found = readdirSync(sampleApp).flatMap((name) =>
    (readFileSync(new URL(name, sampleApp), 'utf8').match(literal) ?? []).map((match) => `${name}: ${match}`),
  )
  expect(found).toEqual([])
})

// Every colour a screen draws, in its shadow roots too, that is not one of the theme's tokens: text
// where an element holds words, fills, drawn borders and rings, shadows, and an icon's paint.
// Token colours are read back through a probe so they compare in the browser's own form.
function strayColours() {
  const probe = document.createElement('i')
  document.body.append(probe)
  const canonical = (value: string) => {
    probe.style.color = ''
    probe.style.color = value
    return getComputedStyle(probe).color
  }
  const colour = /(?:oklch|oklab|rgba?|hsla?|lab|lch|color)\([^)]*\)/g
  const root = getComputedStyle(document.documentElement)
  const tokens = new Set(['rgba(0, 0, 0, 0)'])
  for (const name of [...document.styleSheets].flatMap((sheet) =>
    [...sheet.cssRules].flatMap((rule) => [...((rule as CSSStyleRule).style ?? [])]),
  )) {
    if (!name.startsWith('--eb-')) continue
    for (const match of root.getPropertyValue(name).match(colour) ?? []) tokens.add(canonical(match))
  }
  for (const sheet of document.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      for (const name of (rule as CSSStyleRule).style ?? []) {
        if (!name.startsWith('--eb-')) continue
        for (const match of root.getPropertyValue(name).match(colour) ?? []) tokens.add(canonical(match))
      }
    }
  }
  probe.remove()

  const stray = new Set<string>()
  const visit = (scope: Document | ShadowRoot) => {
    for (const el of scope.querySelectorAll('*')) {
      if (el.shadowRoot) visit(el.shadowRoot)
      if (['style', 'script', 'link', 'meta', 'title', 'head'].includes(el.localName)) continue
      if (el.getClientRects().length === 0) continue
      const style = getComputedStyle(el)
      const used = [style.backgroundColor]
      // Words take their colour from where they are drawn: a slotted word from its slot's place.
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue
        used.push(getComputedStyle((node as Text).assignedSlot ?? el).color)
      }
      if (['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse'].includes(el.localName))
        used.push(style.fill, style.stroke)
      for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
        if (style[`border${side}Style`] !== 'none' && style[`border${side}Width`] !== '0px')
          used.push(style[`border${side}Color`])
      }
      if (style.outlineStyle !== 'none') used.push(style.outlineColor)
      used.push(...(style.boxShadow.match(colour) ?? []))
      for (const value of used) {
        if (!value || value === 'none') continue
        for (const match of value.match(colour) ?? [value]) {
          if (!tokens.has(match)) stray.add(`${el.localName}${el.id ? `#${el.id}` : ''}: ${match}`)
        }
      }
    }
  }
  visit(document)
  return [...stray]
}

// The page's ground in each theme, so a screen that stays light in a dark browser fails.
const ground = { light: 'oklch(0.985 0.002 85)', dark: 'oklch(0.16 0.004 85)' }

for (const [screen, path, width] of [
  ['the phone orders', '/', 360],
  ['the phone order #1039', '/order-1039', 360],
  ['the desktop orders', '/', 1280],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${screen} draws only token colours in ${scheme}`, async () => {
      const { page, errors } = await pages.open('', width)
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(`${pages.sampleApp}${path}`)
      await page.locator('eb-heading:defined, eb-row').first().waitFor({ timeout: 15_000 })
      await page.waitForFunction(() => document.querySelectorAll(':not(:defined):not(eb-column)').length === 0)
      await page.evaluate(() => document.fonts.ready)
      expect(await page.locator('eb-page').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ground[scheme])
      expect(await page.evaluate(strayColours)).toEqual([])
      expect(errors).toEqual([])
    })
  }
}
