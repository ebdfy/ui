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
] as const)('tone %s draws its words in the %s colour on its tint', ([tone, colours]) => {
  document.body.innerHTML = `<e-badge${tone ? ` tone="${tone}"` : ''}>Status</e-badge>`
  const badge = getComputedStyle(document.querySelector('e-badge')!)
  expect(badge.color).toBe(token(`--e-color-${colours}-fg`))
  expect(badge.backgroundColor).toBe(token(`--e-color-${colours}-bg`))
})

test('a badge is a square-ish tag one line tall that sits in a 42 px table row', () => {
  document.body.innerHTML =
    '<e-table><e-row><span>#1042</span><span><e-badge tone="courier">With courier</e-badge></span></e-row></e-table>'
  const badge = document.querySelector('e-badge')!
  const box = badge.getBoundingClientRect()
  expect(box.height).toBe(22)
  expect(Number.parseFloat(getComputedStyle(badge).borderTopLeftRadius)).toBeLessThanOrEqual(4)
  expect(getComputedStyle(badge).whiteSpace).toBe('nowrap')
  expect(badge.parentElement!.getBoundingClientRect().height).toBe(42)
})
