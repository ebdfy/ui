// v2's type: Geist is self-hosted and preloaded for Latin; Bangla uses the device's own Noto Sans
// Bengali through local() and downloads the self-hosted copy only on a device without it.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { type Browser, chromium, type Page } from 'playwright'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

const bangla = 'noto-sans-bengali-bangla.woff2'
const geist = 'geist-latin-wght-normal.woff2'

// A fontconfig setup that hides Noto Sans Bengali, as on a phone that does not carry it.
const fontsConf = join(mkdtempSync(join(tmpdir(), 'ebdfy-v2-fonts-')), 'fonts.conf')
writeFileSync(
  fontsConf,
  `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig><include ignore_missing="yes">/etc/fonts/fonts.conf</include><selectfont><rejectfont><pattern><patelt name="family"><string>Noto Sans Bengali</string></patelt></pattern></rejectfont></selectfont></fontconfig>`,
)

let pages: Awaited<ReturnType<typeof startPages>>
let withoutBangla: Browser

beforeAll(async () => {
  pages = await startPages()
  withoutBangla = await chromium.launch({ env: { ...process.env, FONTCONFIG_FILE: fontsConf } })
})

afterAll(async () => {
  await withoutBangla?.close()
  await pages?.close()
})

// A Bangla v2 page, answered on the docs origin so its stylesheet and fonts come from the dev server.
async function openBangla(page: Page): Promise<string[]> {
  const fonts: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/fonts/')) fonts.push(request.url().split('/').pop()!)
  })
  const url = `${pages.ui}/bangla-fixture`
  await page.route(url, (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="bn"><head><meta charset="utf-8"><link rel="stylesheet" href="/ui/v2.css"></head>
<body><p>আপনার অর্ডার আমরা পেয়েছি। কুরিয়ার শীঘ্রই আসবে।</p></body></html>`,
    }),
  )
  await page.goto(url)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  return fonts
}

// Whether this Chromium finds the system's Noto Sans Bengali by the name the face asks for.
const findsSystemBangla = (page: Page) =>
  page.evaluate(() =>
    new FontFace('probe', "local('Noto Sans Bengali Regular')").load().then(
      () => true,
      () => false,
    ),
  )

test('a Bangla page on a device with Noto Sans Bengali downloads no Bangla font and draws in the system one', async () => {
  const { page } = await pages.open('')
  expect(await findsSystemBangla(page)).toBe(true)
  const fonts = await openBangla(page)
  expect(fonts.filter((file) => file === bangla)).toEqual([])
  const face = await page.evaluate(() =>
    [...document.fonts].filter((font) => font.family === 'e Bangla').map((font) => font.status),
  )
  expect(face).toEqual(['loaded'])
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument')
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'p' })
  const { fonts: drawn } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
  expect(drawn.find((font) => font.glyphCount > 10)?.postScriptName).toMatch(/^NotoSansBengali-/)
})

test('a Bangla page on a device without Noto Sans Bengali downloads the Bangla font once', async () => {
  const page = await withoutBangla.newPage()
  try {
    expect(await findsSystemBangla(page)).toBe(false)
    const fonts = await openBangla(page)
    expect(fonts.filter((file) => file === bangla)).toEqual([bangla])
  } finally {
    await page.close()
  }
})

test('each v2 page preloads Geist at the URL its stylesheet asks for, so it is fetched once and used', async () => {
  const urls = [`${pages.ui}/components/button`, `${pages.ui}/playground`, `${pages.sampleApp}/orders`]
  const results = await Promise.all(
    urls.map(async (url) => {
      const { page } = await pages.open('')
      const requests: string[] = []
      page.on('request', (request) => {
        // The playground's framed sample app loads its own copy from its own origin.
        if (request.frame() === page.mainFrame() && request.url().endsWith(`/${geist}`))
          requests.push(new URL(request.url()).pathname)
      })
      await page.goto(url)
      // Headless Chromium logs no "preloaded but not used" warning, so the face's own status says
      // the stylesheet used the font, and the single request says it used the preloaded copy.
      const found = await page.evaluate(async () => {
        await document.fonts.ready
        const link = document.head.querySelector('link[rel=preload][as=font]')
        return {
          preload: link?.getAttribute('href'),
          crossorigin: link?.hasAttribute('crossorigin'),
          face: [...document.fonts].find((font) => font.family === 'e Geist')?.status,
        }
      })
      return { url, ...found, requests }
    }),
  )
  expect(results).toEqual(
    urls.map((url) => ({
      url,
      preload: `/ui/fonts/${geist}`,
      crossorigin: true,
      face: 'loaded',
      requests: [`/ui/fonts/${geist}`],
    })),
  )
})

test('both faces swap in rather than hide text while they load', async () => {
  const { page } = await pages.open(`${pages.ui}/components/button`)
  const display = await page.evaluate(() =>
    Object.fromEntries([...document.fonts].map((font) => [font.family, font.display])),
  )
  expect(display).toEqual({ 'e Geist': 'swap', 'e Bangla': 'swap' })
})

test('body text in Bangla is at least 13 px with a line height of at least 1.4', async () => {
  const { page } = await pages.open('')
  await openBangla(page)
  const { size, lineHeight, family } = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('p')!)
    return {
      size: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
      family: style.fontFamily,
    }
  })
  expect(family).toMatch(/^"e Geist", "e Bangla"/)
  expect(size).toBeGreaterThanOrEqual(13)
  expect(lineHeight / size).toBeGreaterThanOrEqual(1.4)
})

test("letters in Bangla draw at least as tall as Geist's x-height at the same size", async () => {
  const { page } = await pages.open('')
  await openBangla(page)
  const { sizeAdjust, ratio } = await page.evaluate(async () => {
    await document.fonts.load('14px "e Geist"', 'x')
    await document.fonts.load('14px "e Bangla"', 'ক')
    const context = document.createElement('canvas').getContext('2d')!
    const height = (font: string, text: string) => {
      context.font = font
      return context.measureText(text).actualBoundingBoxAscent
    }
    const rule = [...document.styleSheets]
      .flatMap((sheet) => [...sheet.cssRules])
      .flatMap((rule) => (rule instanceof CSSLayerBlockRule ? [...rule.cssRules] : [rule]))
      .find((rule) => rule instanceof CSSFontFaceRule && rule.style.getPropertyValue('font-family') === '"e Bangla"')
    return {
      sizeAdjust: (rule as CSSFontFaceRule | undefined)?.style.getPropertyValue('size-adjust'),
      // The top of Bangla's headline against the top of Manrope's x. The canvas rounds heights to
      // whole pixels, 9 against 8 at 14 px, so this measures at 1400 px.
      ratio: height('1400px "e Bangla"', 'ক') / height('1400px "e Geist"', 'x'),
    }
  })
  // At 100% the headline stands at 0.625 em against Manrope's 0.547 em x-height, so Bangla already
  // reads a little larger; shrinking it to match would draw 13 px meta text like 11.4 px.
  expect(sizeAdjust).toBe('100%')
  expect(ratio).toBeGreaterThan(1.1)
  expect(ratio).toBeLessThan(1.18)
})
