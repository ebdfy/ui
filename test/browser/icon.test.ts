import { expect, test, vi } from 'vitest'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

type Icon = HTMLElement & { updateComplete: Promise<unknown> }

const ink = 'rgb(10, 20, 30)'

async function icon(html: string): Promise<Icon> {
  document.body.innerHTML = `<div style="color: ${ink}">${html}</div>`
  const el = document.querySelector<Icon>('eb-icon')!
  await el.updateComplete
  return el
}

const lines = (svg: SVGSVGElement) => [...svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon')]

function drawn(svg: SVGSVGElement, size: number) {
  const box = svg.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([size, size])
  const found = lines(svg)
  expect(found.length).toBeGreaterThan(0)
  for (const line of found) {
    const style = getComputedStyle(line)
    expect(style.strokeWidth).toBe('1.5px')
    expect(style.vectorEffect).toBe('non-scaling-stroke')
  }
}

test('a truck icon is 16 px with a 1.5 px stroke in the colour around it', async () => {
  const el = await icon('<eb-icon name="truck"></eb-icon>')
  const svg = el.shadowRoot!.querySelector('svg')!
  drawn(svg, 16)
  for (const line of lines(svg)) expect(getComputedStyle(line).stroke).toBe(ink)
})

test('size 20 draws the icon at 20 px with the same 1.5 px stroke', async () => {
  const el = await icon('<eb-icon name="truck" size="20"></eb-icon>')
  const svg = el.shadowRoot!.querySelector('svg')!
  drawn(svg, 20)
  expect(el.getBoundingClientRect().width).toBe(20)
})

const names = [
  'plus',
  'search',
  'x',
  'check',
  'chevron-left',
  'chevron-right',
  'chevron-down',
  'more-horizontal',
  'package',
  'shopping-bag',
  'truck',
  'users',
  'user',
  'phone',
  'message-circle',
  'printer',
  'copy',
  'bell',
  'home',
  'settings',
  'store',
  'tag',
  'credit-card',
  'banknote',
  'receipt',
  'image',
  'triangle-alert',
  'info',
  'circle-check',
  'lock',
  'external-link',
  'arrow-left',
  'filter',
  'calendar',
  'map-pin',
  'trash',
  'pencil',
  'eye',
  'upload',
  'download',
]

test('every icon in the set draws an svg', async () => {
  const missing: string[] = []
  for (const name of names) {
    const el = await icon(`<eb-icon name="${name}"></eb-icon>`)
    const svg = el.shadowRoot!.querySelector('svg')
    if (!svg || !lines(svg).length) missing.push(name)
  }
  expect(missing).toEqual([])
})

const own =
  '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16" /><circle cx="12" cy="12" r="8" /></svg>'

for (const size of [16, 20]) {
  test(`an app's own svg is drawn at ${size} px with the 1.5 px stroke`, async () => {
    const el = await icon(`<eb-icon${size === 20 ? ' size="20"' : ''}>${own}</eb-icon>`)
    const svg = el.querySelector('svg')!
    await vi.waitFor(() => drawn(svg, size))
    for (const line of lines(svg)) expect(getComputedStyle(line).stroke).toBe(ink)
  })
}

// Markup pasted from another icon set often sizes its svg with a class or an inline style, which
// beat ::slotted(); the icon's box still decides the size.
test.for([
  ['a class', '<style>.w6 { width: 24px; height: 24px }</style>', 'class="w6"'],
  ['an inline style', '', 'style="width: 24px; height: 24px"'],
] as const)("an app's svg sized by %s is still drawn at 16 px", async ([, style, sizing]) => {
  const el = await icon(
    `${style}<eb-icon><svg ${sizing} viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 12h16" /></svg></eb-icon>`,
  )
  const svg = el.querySelector('svg')!
  await vi.waitFor(() => drawn(svg, 16))
})

test('an unknown name draws nothing and warns once, naming it', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const el = await icon('<eb-icon name="rocket"></eb-icon>')
    el.setAttribute('label', 'Launch')
    await el.updateComplete
    expect(el.shadowRoot!.querySelector('svg')).toBeNull()
    const calls = warn.mock.calls.filter((call) => String(call[0]).includes('rocket'))
    expect(calls).toHaveLength(1)
    expect(String(calls[0]![0])).toContain('eb-icon')
  } finally {
    warn.mockRestore()
  }
})

test('a labelled icon is an image with that name; an unlabelled one is hidden from assistive tech', async () => {
  const labelled = await icon('<eb-icon name="truck" label="Shipped"></eb-icon>')
  expect(labelled.getAttribute('role')).toBe('img')
  expect(labelled.getAttribute('aria-label')).toBe('Shipped')
  expect(labelled.hasAttribute('aria-hidden')).toBe(false)
  const plain = await icon('<eb-icon name="truck"></eb-icon>')
  expect(plain.getAttribute('aria-hidden')).toBe('true')
  expect(plain.hasAttribute('role')).toBe(false)
  expect(plain.hasAttribute('aria-label')).toBe(false)
})

test('in dark the icon still draws in the colour around it', async () => {
  const strokes = await inDark(async () => {
    const el = await icon('<eb-icon name="bell"></eb-icon>')
    return lines(el.shadowRoot!.querySelector('svg')!).map((line) => getComputedStyle(line).stroke)
  })
  expect(strokes.length).toBeGreaterThan(0)
  for (const stroke of strokes) expect(stroke).toBe(ink)
})
