import { afterEach, expect, test } from 'vitest'

// e-badge: an order's status as a tinted tag, drawn by v2.css alone in its status's colours.
import '../../src/v2.css'

afterEach(() => {
  document.body.replaceChildren()
})

const token = (name: string) => {
  const probe = document.createElement('i')
  probe.style.color = `var(${name})`
  document.body.append(probe)
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

test.for([
  ['new', 'new'],
  ['confirmed', 'confirmed'],
  ['courier', 'courier'],
  ['delivered', 'delivered'],
  ['returned', 'returned'],
  [null, 'neutral'],
  ['neutral', 'neutral'],
  ['info', 'confirmed'],
  ['success', 'delivered'],
] as const)('tone %s draws its words in the %s colour on its tint', ([tone, colours]) => {
  document.body.innerHTML = `<e-badge${tone ? ` tone="${tone}"` : ''}>Status</e-badge>`
  const badge = getComputedStyle(document.querySelector('e-badge')!)
  expect(badge.color).toBe(token(`--e-color-${colours}-fg`))
  expect(badge.backgroundColor).toBe(token(`--e-color-${colours}-bg`))
})

test.for([
  ['warn', '--e-color-warn-fg', '--e-color-warn-soft'],
  ['danger', '--e-color-danger', '--e-color-danger-soft'],
] as const)('tone %s draws %s on %s', ([tone, fg, bg]) => {
  document.body.innerHTML = `<e-badge tone="${tone}">Status</e-badge>`
  const badge = getComputedStyle(document.querySelector('e-badge')!)
  expect(badge.color).toBe(token(fg))
  expect(badge.backgroundColor).toBe(token(bg))
})

test('a badge with a dot has a 6 px round dot left of its words', () => {
  document.body.innerHTML = '<e-badge tone="warn" dot>Unpaid</e-badge>'
  const el = document.querySelector('e-badge')!
  const badge = getComputedStyle(el)
  const dot = getComputedStyle(el, '::before')
  expect(badge.height).toBe('22px')
  expect(badge.borderTopLeftRadius).toBe('6px')
  expect(badge.paddingLeft).toBe('8px')
  expect(badge.columnGap).toBe('6px')
  expect(dot.width).toBe('6px')
  expect(dot.height).toBe('6px')
  expect(dot.borderTopLeftRadius).toBe('50%')
  expect(dot.backgroundColor).toBe(token('--e-color-warn-fg'))
  const text = document.createRange()
  text.selectNodeContents(el)
  const words = text.getBoundingClientRect()
  expect(words.left).toBeLessThan(el.getBoundingClientRect().left + 8 + 6 + 6 + 1)
  expect(words.width).toBeGreaterThan(6 + 6)
})

test('a badge without a dot draws no dot', () => {
  document.body.innerHTML = '<e-badge>Draft</e-badge>'
  expect(getComputedStyle(document.querySelector('e-badge')!, '::before').content).not.toBe('""')
})

test('the words are 12 px in English and 13 px in Bangla', () => {
  document.body.innerHTML = '<e-badge>Paid</e-badge><div lang="bn"><e-badge>পরিশোধিত</e-badge></div>'
  const en = document.querySelector('e-badge')!
  const bn = document.querySelector('[lang="bn"] e-badge')!
  expect(getComputedStyle(en).fontSize).toBe('12px')
  expect(getComputedStyle(en).fontWeight).toBe('550')
  expect(getComputedStyle(bn).fontSize).toBe('13px')
  expect(Number.parseFloat(getComputedStyle(bn).lineHeight)).toBeGreaterThanOrEqual(13 * 1.4)
})

test('a badge is a square-ish tag one line tall that sits in a 44 px table row', () => {
  document.body.innerHTML =
    '<e-table><e-row><span>#1042</span><span><e-badge tone="courier">With courier</e-badge></span></e-row></e-table>'
  const badge = document.querySelector('e-badge')!
  const box = badge.getBoundingClientRect()
  expect(box.height).toBe(22)
  expect(getComputedStyle(badge).borderTopLeftRadius).toBe('6px')
  expect(getComputedStyle(badge).whiteSpace).toBe('nowrap')
  expect(badge.parentElement!.getBoundingClientRect().height).toBe(44)
})
