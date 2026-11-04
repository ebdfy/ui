import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'

type Updatable = HTMLElement & { updateComplete: Promise<unknown> }

async function render(html: string): Promise<void> {
  document.body.innerHTML = html
  for (const el of document.querySelectorAll('*')) {
    if (el.localName.startsWith('eb-') && 'updateComplete' in el) await (el as Updatable).updateComplete
  }
  await document.fonts.load('500 13px "Noto Sans Bengali"', 'নতুন')
  await document.fonts.load('600 13px "Noto Sans Bengali"', 'নতুন')
  await document.fonts.load('400 14px "Noto Sans Bengali"', 'নতুন')
  await document.fonts.ready
}

// The middle of a text's ink: its baseline sits the font's ascent below the top of the text's own
// box, and the glyphs rise and fall from there by what the font measures for these words.
function inkMiddle(text: Text): number {
  const style = getComputedStyle(text.parentElement!)
  const context = document.createElement('canvas').getContext('2d')!
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  const ink = context.measureText(text.data)
  const range = document.createRange()
  range.selectNodeContents(text)
  const baseline = range.getBoundingClientRect().top + ink.fontBoundingBoxAscent
  return baseline + (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent) / 2
}

const middle = (el: Element) => {
  const box = el.getBoundingClientRect()
  return box.top + box.height / 2
}

const pills = [
  ['status="new"', 'নতুন'],
  ['status="returned"', 'ফেরত এসেছে'],
  ['status="confirmed"', 'কনফার্মড'],
  ['status="shipped"', 'পাঠানো হয়েছে'],
] as const

test.for(pills)('a Bangla word sits in the middle of a %s badge, within 1 px', async ([attributes, words]) => {
  await render(`<div lang="bn"><eb-badge ${attributes}>${words}</eb-badge></div>`)
  const badge = document.querySelector('eb-badge')!
  const offset = inkMiddle(badge.firstChild as Text) - middle(badge)
  expect(Math.abs(offset), `${offset.toFixed(2)} px off`).toBeLessThanOrEqual(1)
})

test('a courier status pill centres its Bangla word too', async () => {
  await render('<div lang="bn"><eb-courier-status status="RETURNED"></eb-courier-status></div>')
  const badge = document.querySelector('eb-courier-status')!.shadowRoot!.querySelector('eb-badge')!
  await badge.updateComplete
  const words = [...badge.childNodes].find((node): node is Text => node instanceof Text && node.data.trim() !== '')!
  const offset = inkMiddle(words) - middle(badge)
  expect(Math.abs(offset), `${offset.toFixed(2)} px off`).toBeLessThanOrEqual(1)
})

afterEach(() => page.viewport(360, 800))

test('the dot of a Bangla New pill sits on the middle of the pill and its word, within 1 px', async () => {
  await render('<div lang="bn"><eb-badge status="new">নতুন</eb-badge></div>')
  const badge = document.querySelector('eb-badge')!
  const dot = badge.shadowRoot!.querySelector('.dot')!
  expect(Math.abs(middle(dot) - middle(badge))).toBeLessThanOrEqual(1)
  expect(Math.abs(middle(dot) - inkMiddle(badge.firstChild as Text))).toBeLessThanOrEqual(1)
})

test('a Bangla name sits in the middle of its table row, within 1 px', async () => {
  const words = 'সুমাইয়া আক্তার'
  await page.viewport(1280, 800)
  await render(`<div lang="bn"><eb-table>
    <eb-column>অর্ডার</eb-column><eb-column>গ্রাহক</eb-column>
    <eb-row><span>#1041</span><span>${words}</span></eb-row>
  </eb-table></div>`)
  const row = document.querySelector('eb-row')!
  const offset = inkMiddle(row.children[1]!.firstChild as Text) - middle(row.shadowRoot!.querySelector('[part="row"]')!)
  expect(Math.abs(offset), `${offset.toFixed(2)} px off`).toBeLessThanOrEqual(1)
})
