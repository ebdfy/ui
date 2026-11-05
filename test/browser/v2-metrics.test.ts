import { afterEach, expect, test } from 'vitest'
// e-metrics: two to four numbers above a list, drawn by v2.css alone. One row from 600 px, two by two
// on a phone, with the change after the number and the label above it.
import { page } from 'vitest/browser'

import '../../src/v2.css'

afterEach(async () => {
  document.body.replaceChildren()
  await page.viewport(360, 800)
})

const metric = (label: string, number: string, change = '') =>
  `<div><span slot="label">${label}</span> <strong>${number}</strong>${change ? ` <span slot="change" tone="up">${change}</span>` : ''}</div>`

const four = (lang = 'en', digits: string[] = ['38', '12', '54', '2.1%'], change = '+12%') =>
  `<e-metrics lang="${lang}" label="Today">${metric('Orders today', digits[0]!, change)}${metric('To confirm', digits[1]!)}${metric('With courier', digits[2]!)}${metric('Return rate, 7 days', digits[3]!)}</e-metrics>`

function render(html: string): void {
  document.body.innerHTML = html
}

const boxes = () => [...document.querySelectorAll('e-metrics > div')].map((m) => m.getBoundingClientRect())

test('at 1280 px four metrics sit in one row of equal widths', async () => {
  await page.viewport(1280, 800)
  render(four())
  const b = boxes()
  expect(b.length).toBe(4)
  expect(new Set(b.map((r) => Math.round(r.top))).size).toBe(1)
  for (const r of b) expect(Math.abs(r.width - b[0]!.width)).toBeLessThanOrEqual(1)
  expect(Math.round(b[0]!.width)).toBeGreaterThan(200)
})

test('at 360 px four metrics make two rows of two and the page does not scroll sideways', () => {
  render(four())
  const b = boxes()
  const tops = b.map((r) => Math.round(r.top))
  expect(tops[0]).toBe(tops[1])
  expect(tops[2]).toBe(tops[3])
  expect(tops[2]!).toBeGreaterThan(tops[0]!)
  expect(Math.round(b[0]!.left)).toBe(Math.round(b[2]!.left))
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('at 360 px two metrics share one row', () => {
  render(`<e-metrics>${metric('Orders today', '38')}${metric('To confirm', '12')}</e-metrics>`)
  const b = boxes()
  expect(Math.round(b[0]!.top)).toBe(Math.round(b[1]!.top))
  expect(b[1]!.left).toBeGreaterThan(b[0]!.right - 1)
})

test('a long label wraps inside its metric and nothing scrolls sideways', () => {
  render(
    `<e-metrics>${metric('Orders waiting for the courier to collect them from the warehouse', '38')}${metric('To confirm', '12')}</e-metrics>`,
  )
  const first = document.querySelector('e-metrics > div > [slot="label"]')!
  expect(first.getBoundingClientRect().height).toBeGreaterThan(20)
  expect(document.documentElement.scrollWidth).toBe(360)
})

test('the change sits after the number on its line and the label is above', async () => {
  await page.viewport(1280, 800)
  render(four())
  const label = document.querySelector('[slot="label"]')!.getBoundingClientRect()
  const number = document.querySelector('e-metrics strong')!.getBoundingClientRect()
  const change = document.querySelector('[slot="change"]')!.getBoundingClientRect()
  expect(label.bottom).toBeLessThanOrEqual(number.top + 1)
  expect(change.left).toBeGreaterThanOrEqual(number.right)
  expect(Math.abs(change.bottom - number.bottom)).toBeLessThanOrEqual(6)
  expect(Math.round(change.top)).toBeGreaterThanOrEqual(Math.round(number.top))
})

test('the change takes its tone and the number is large, semibold and tabular', () => {
  render(`<e-metrics>${metric('Orders today', '38', '+12%')}${metric('To confirm', '12')}</e-metrics>`)
  const probe = (name: string) => {
    const p = document.createElement('div')
    p.style.color = `var(--e-color-${name})`
    document.body.append(p)
    const c = getComputedStyle(p).color
    p.remove()
    return c
  }
  const change = document.querySelector('[slot="change"]')!
  expect(getComputedStyle(change).color).toBe(probe('delivered-fg'))
  change.setAttribute('tone', 'down')
  expect(getComputedStyle(change).color).toBe(probe('returned-fg'))
  change.removeAttribute('tone')
  expect(getComputedStyle(change).color).toBe(probe('fg2'))
  const number = getComputedStyle(document.querySelector('e-metrics strong')!)
  expect(number.fontSize).toBe('22px')
  expect(number.fontWeight).toBe('600')
  expect(number.fontVariantNumeric).toBe('tabular-nums')
})

test('a metric sits on a surface with a line border and the second radius', () => {
  render(four())
  const style = getComputedStyle(document.querySelector('e-metrics > div')!)
  expect(style.borderTopWidth).toBe('1px')
  expect(style.borderTopLeftRadius).toBe('10px')
})

test('a Bangla e-metrics has the same layout', async () => {
  await page.viewport(1280, 800)
  render(four('bn', ['৩৮', '১২', '৫৪', '২.১%'], '+১২%'))
  const b = boxes()
  expect(new Set(b.map((r) => Math.round(r.top))).size).toBe(1)
  expect(document.querySelector('e-metrics strong')!.textContent).toBe('৩৮')
  const number = document.querySelector('e-metrics strong')!.getBoundingClientRect()
  const change = document.querySelector('[slot="change"]')!.getBoundingClientRect()
  expect(change.left).toBeGreaterThanOrEqual(number.right)
  expect(Math.abs(change.bottom - number.bottom)).toBeLessThanOrEqual(6)
})
