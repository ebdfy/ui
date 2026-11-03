import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'

interface Theme {
  name: 'light' | 'dark'
  focus: string
  bg: string
}

const themes: Theme[] = [
  { name: 'light', focus: 'oklch(0.52 0.19 268)', bg: 'oklch(0.985 0.002 85)' },
  { name: 'dark', focus: 'oklch(0.74 0.13 268)', bg: 'oklch(0.16 0.004 85)' },
]

const fixture = `
  <div style="display: flex; flex-direction: column; gap: 16px; padding: 24px">
    <eb-button>Save</eb-button>
    <p><eb-link href="#focus-test">Track</eb-link></p>
    <eb-text-field label="Name"></eb-text-field>
    <eb-text-area label="Note"></eb-text-area>
    <eb-select label="Size"><option value="s">Small</option><option value="m">Medium</option></eb-select>
    <eb-checkbox label="Gift wrap"></eb-checkbox>
    <eb-choice-list label="Pay by"><option value="cash">Cash</option><option value="card">Card</option></eb-choice-list>
    <eb-switch label="Notify me"></eb-switch>
    <eb-search-field label="Search"></eb-search-field>
    <eb-date-field label="Day"></eb-date-field>
    <eb-phone-field label="Phone"></eb-phone-field>
    <eb-taka-field label="Price"></eb-taka-field>
    <eb-district-picker></eb-district-picker>
    <eb-pagination has-previous has-next></eb-pagination>
    <eb-menu label="More actions">
      <eb-button slot="trigger">More</eb-button>
      <eb-menu-item>Print</eb-menu-item>
      <eb-menu-item>Cancel order</eb-menu-item>
    </eb-menu>
  </div>`

// Every tag in the fixture that holds a focusable part.
const interactive = [
  'eb-button',
  'eb-link',
  'eb-text-field',
  'eb-text-area',
  'eb-select',
  'eb-checkbox',
  'eb-choice-list',
  'eb-switch',
  'eb-search-field',
  'eb-date-field',
  'eb-phone-field',
  'eb-taka-field',
  'eb-district-picker',
  'eb-pagination',
  'eb-menu',
]

type Updatable = HTMLElement & { updateComplete: Promise<unknown> }

function isUpdatable(el: Element): el is Updatable {
  return 'updateComplete' in el
}

async function render(html: string): Promise<void> {
  document.body.innerHTML = html
  for (const el of document.querySelectorAll('*')) {
    if (el.localName.startsWith('eb-') && isUpdatable(el)) await el.updateComplete
  }
}

function setTheme(theme: Theme): void {
  if (theme.name === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
  document.body.innerHTML = ''
})

// The element with focus, through every shadow root.
function deepActive(): Element | null {
  let el: Element | null = document.activeElement
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

// The parent in the flattened tree: a slotted element sits under its slot, a shadow root under its host.
function parentOf(el: Element): Element | null {
  if (el.assignedSlot) return el.assignedSlot
  if (el.parentElement) return el.parentElement
  const root = el.getRootNode()
  return root instanceof ShadowRoot ? root.host : null
}

// The topmost host of a part, which is the eb- element a person put on the page.
function hostOf(part: Element): Element {
  let el = part
  for (let root = el.getRootNode(); root instanceof ShadowRoot; root = el.getRootNode()) el = root.host
  return el
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))

function linear(theme: string): [number, number, number] {
  const m = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/.exec(theme)
  if (!m) throw new Error(`not an oklch colour: ${theme}`)
  const [L, C, h] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180]
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
  ]
}

function luminance(colour: string): number {
  const [r, g, b] = linear(colour)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

// The ring grown by 4 px (2 px offset plus 2 px width) must stay inside every ancestor that clips.
function clippedBy(part: Element): string | null {
  const r = part.getBoundingClientRect()
  for (let el = parentOf(part); el; el = parentOf(el)) {
    const style = getComputedStyle(el)
    if (style.display === 'contents' || (style.overflowX === 'visible' && style.overflowY === 'visible')) continue
    const box = el.getBoundingClientRect()
    const left = box.left + el.clientLeft
    const top = box.top + el.clientTop
    const inside =
      r.left - 4 >= left - 0.5 &&
      r.top - 4 >= top - 0.5 &&
      r.right + 4 <= left + el.clientWidth + 0.5 &&
      r.bottom + 4 <= top + el.clientHeight + 0.5
    if (!inside) return el.localName + (el.className ? `.${el.className}` : '')
  }
  return null
}

function expectRing(part: Element, theme: Theme): void {
  const label = `${hostOf(part).localName} ${part.localName}`
  const style = getComputedStyle(part)
  expect(part.matches(':focus-visible'), label).toBe(true)
  expect(style.outlineStyle, label).toBe('solid')
  expect(style.outlineWidth, label).toBe('2px')
  expect(style.outlineOffset, label).toBe('2px')
  expect(style.outlineColor, label).toBe(theme.focus)
  expect(clippedBy(part), `${label} is clipped by`).toBeNull()
}

test.for(themes)('tabbing shows the focus ring on every interactive part in $name', async (theme) => {
  setTheme(theme)
  await render(fixture)
  const reached = new Set<Element>()
  let previous: Element | null = null
  for (let presses = 0; presses < 60; presses++) {
    await userEvent.tab()
    const part = deepActive()
    if (!part || part === document.body || part === document.documentElement) break
    // A date input keeps focus through its day, month and year, and its picker button: one part.
    if (part === previous) continue
    // Focus came back round to the first part.
    if (reached.has(part)) break
    reached.add(part)
    expectRing(part, theme)
    previous = part
  }
  const hosts = new Set([...reached].map(hostOf))
  for (const tag of interactive) {
    expect(
      [...hosts].some((host) => host.closest(tag)),
      `${tag} took focus`,
    ).toBe(true)
  }
})

test.for(themes)('a menu item shows the focus ring in $name', async (theme) => {
  setTheme(theme)
  await render(fixture)
  const menu = document.querySelector('eb-menu')!
  menu.querySelector('eb-button')!.shadowRoot!.querySelector('button')!.focus()
  await userEvent.keyboard('{Enter}')
  await expect.poll(() => deepActive()?.localName).toBe('eb-menu-item')
  expectRing(deepActive()!, theme)
  await userEvent.keyboard('{ArrowDown}')
  expect(deepActive()?.textContent).toBe('Cancel order')
  expectRing(deepActive()!, theme)
})

test.for(themes)('the ring is at least 3:1 against the page background in $name', (theme) => {
  expect(contrast(theme.focus, theme.bg)).toBeGreaterThanOrEqual(3)
})

test('a mouse click on a button, link, checkbox or switch shows no ring', async () => {
  await render(`
    <eb-button>Save</eb-button>
    <p><eb-link href="#focus-test">Track</eb-link></p>
    <eb-checkbox label="Gift wrap"></eb-checkbox>
    <eb-switch label="Notify me"></eb-switch>`)
  try {
    for (const tag of ['eb-button', 'eb-link', 'eb-checkbox', 'eb-switch']) {
      const part = document.querySelector(tag)!.shadowRoot!.querySelector('button, a, input')!
      await userEvent.click(part)
      expect(deepActive(), `${tag} kept focus`).toBe(part)
      expect(getComputedStyle(part).outlineStyle, `${tag} outline`).toBe('none')
    }
  } finally {
    history.replaceState(null, '', location.pathname + location.search)
  }
})

// The date input's calendar button is a tab stop of its own, where the input has focus but is not
// :focus-visible. The token ring stays on the field there too, and Chromium draws no ring of its own.
async function darkPixels(element: Element): Promise<number> {
  const { base64 } = await page.screenshot({ element, base64: true })
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  const data = context.getImageData(0, 0, image.width, image.height).data
  let dark = 0
  for (let i = 0; i < data.length; i += 4) if (data[i]! < 40 && data[i + 1]! < 40 && data[i + 2]! < 40) dark++
  return dark
}

test.for(themes)("a date field's calendar button keeps the token ring and no browser ring in $name", async (theme) => {
  setTheme(theme)
  await render(
    '<eb-button>Before</eb-button><div style="padding: 8px; width: 300px"><eb-date-field label="Day"></eb-date-field></div>',
  )
  document.querySelector('eb-button')!.shadowRoot!.querySelector('button')!.focus()
  const frame = document.querySelector('div')!
  let onYear = 0
  // Day, month and year, then the calendar button.
  for (let stop = 1; stop <= 4; stop++) {
    await userEvent.tab()
    const input = deepActive()!
    expect(input.localName, `stop ${stop}`).toBe('input')
    const style = getComputedStyle(input)
    expect([style.outlineStyle, style.outlineWidth, style.outlineColor], `stop ${stop}`).toEqual([
      'solid',
      '2px',
      theme.focus,
    ])
    if (theme.name === 'light' && stop === 3) onYear = await darkPixels(frame)
    // Chromium's own ring round the button adds about 60 near-black pixels.
    if (theme.name === 'light' && stop === 4) expect(await darkPixels(frame)).toBeLessThan(onYear + 30)
  }
})
