import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

const actions = `
  <eb-button variant="ghost" size="sm">Confirm</eb-button>
  <eb-button variant="ghost" size="sm">Book courier</eb-button>
  <eb-button variant="ghost" size="sm">Print labels</eb-button>`

async function settle(bar: Element & { updateComplete: Promise<unknown> }) {
  await bar.updateComplete
  await Promise.all([...document.querySelectorAll('eb-button, eb-menu')].map((b) => (b as typeof bar).updateComplete))
}

async function mount(count: number, lang: 'bn' | 'en' = 'en') {
  document.body.innerHTML = `<div lang="${lang}"><button id="before">Before</button><eb-bulk-bar count="${count}">${actions}</eb-bulk-bar></div>`
  const bar = document.querySelector('eb-bulk-bar')!
  await settle(bar)
  return bar
}

// The inverse bar a person sees; the host only holds its place in the list.
const surface = (bar: Element) => bar.shadowRoot!.querySelector<HTMLElement>('[part="bar"]')!
const clearButton = (bar: Element) => bar.shadowRoot!.querySelector<HTMLButtonElement>('button')!
const more = (bar: Element) => bar.shadowRoot!.querySelector('eb-button')
const visible = (el: Element) => el.getBoundingClientRect().width > 0
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

// The element that holds focus, looking through every shadow root.
function focused(): Element {
  let el = document.activeElement!
  while (el.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

// Tabs from the button before the bar through each part, copying what each ring looks like.
async function walk(bar: Element, steps: number) {
  document.querySelector<HTMLElement>('#before')!.focus()
  const background = getComputedStyle(surface(bar)).backgroundColor
  const seen = []
  for (let i = 0; i < steps; i += 1) {
    await userEvent.keyboard('{Tab}')
    const el = focused()
    const style = getComputedStyle(el)
    seen.push({
      name: el.getAttribute('aria-label') ?? (el.getRootNode() as ShadowRoot).host.textContent!.trim(),
      width: style.outlineWidth,
      style: style.outlineStyle,
      offset: style.outlineOffset,
      ratio: contrast(style.outlineColor, background),
    })
  }
  return seen
}

// A list taller than the screen: 20 rows of 60 px, then the pager, then wherever the bar goes,
// 12 px apart as the sample app's column is.
async function list(barAfterPager: boolean) {
  const rows = Array.from({ length: 20 }, (_, i) => `<div class="row" style="height: 60px">Row ${i + 1}</div>`)
  const bar = `<eb-bulk-bar count="0">${actions}</eb-bulk-bar>`
  const pager = '<div id="pager" style="height: 44px">Pager</div>'
  document.body.innerHTML = `<div style="display: flex; flex-direction: column; gap: 12px">
    <div>${rows.join('')}</div>${barAfterPager ? pager + bar : bar + pager}</div>`
  const el = document.querySelector('eb-bulk-bar')!
  await settle(el)
  return el
}

const lastRow = () => document.querySelector('.row:last-child')!
const pager = () => document.querySelector('#pager')!

const overlaps = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

test("the count reads in the bar's language, in that language's digits", async () => {
  const en = await mount(2)
  expect(en.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).toBe('2 selected')
  const bn = await mount(2, 'bn')
  expect(bn.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).toBe('২টি নির্বাচিত')
})

test('a bar with a count of 0 draws no box and Tab skips it', async () => {
  const bar = await mount(0)
  const box = surface(bar).getBoundingClientRect()
  expect([box.width, box.height]).toEqual([0, 0])
  expect(bar.getBoundingClientRect().height).toBe(0)
  document.querySelector<HTMLElement>('#before')!.focus()
  await userEvent.keyboard('{Tab}')
  expect(bar.contains(document.activeElement)).toBe(false)
})

test.for([
  { place: 'after the pager', after: true },
  { place: 'between the list and the pager', after: false },
])('showing the bar $place moves neither the last row nor the pager', async ({ after }) => {
  await page.viewport(1280, 800)
  const bar = await list(after)
  const before = [lastRow().getBoundingClientRect().toJSON(), pager().getBoundingClientRect().toJSON()]
  bar.count = 2
  await settle(bar)
  expect([lastRow().getBoundingClientRect().toJSON(), pager().getBoundingClientRect().toJSON()]).toEqual(before)
})

test('scrolled to the top the bar floats 16 px above the bottom of the screen', async () => {
  await page.viewport(1280, 800)
  const bar = await list(true)
  bar.count = 2
  await settle(bar)
  window.scrollTo(0, 0)
  await frame()
  expect(surface(bar).getBoundingClientRect().bottom).toBe(800 - 16)
})

test('scrolled to the end the bar covers neither the last row nor the pager', async () => {
  await page.viewport(1280, 800)
  const bar = await list(true)
  bar.count = 2
  await settle(bar)
  window.scrollTo(0, document.documentElement.scrollHeight)
  await frame()
  const box = surface(bar).getBoundingClientRect()
  expect(box.height).toBe(44)
  expect(overlaps(box, lastRow().getBoundingClientRect())).toBe(false)
  expect(overlaps(box, pager().getBoundingClientRect())).toBe(false)
  window.scrollTo(0, 0)
})

test('tab visits the three actions then Clear selection, each with a 2 px ring at 3:1 in light and dark', async () => {
  await page.viewport(1280, 800)
  const bar = await mount(2)
  const names = ['Confirm', 'Book courier', 'Print labels', 'Clear selection']
  const check = (seen: Awaited<ReturnType<typeof walk>>) => {
    expect(seen.map((s) => s.name)).toEqual(names)
    for (const s of seen) {
      expect([s.width, s.style, s.offset]).toEqual(['2px', 'solid', '2px'])
      expect(s.ratio).toBeGreaterThanOrEqual(3)
    }
  }
  check(await walk(bar, 4))
  check(await inDark(() => walk(bar, 4)))
  await page.viewport(360, 800)
})

test('the clear button is named in Bangla under a Bangla page', async () => {
  const bar = await mount(2, 'bn')
  expect(clearButton(bar).getAttribute('aria-label')).toBe('নির্বাচন মুছুন')
})

test('in Bangla the more actions button is named আরও কাজ', async () => {
  await page.viewport(360, 800)
  const bar = await mount(2, 'bn')
  expect(more(bar)!.shadowRoot!.querySelector('button')!.getAttribute('aria-label')).toBe('আরও কাজ')
})

test('pressing Clear selection fires one eb-clear that bubbles and is composed, and keeps count', async () => {
  const bar = await mount(2)
  const heard: Event[] = []
  document.body.addEventListener('eb-clear', (event) => heard.push(event))
  await userEvent.click(clearButton(bar))
  expect(heard).toHaveLength(1)
  expect([heard[0]!.bubbles, heard[0]!.composed]).toEqual([true, true])
  expect(bar.count).toBe(2)
})

test('the bar is the inverse surface, 44 px tall, with readable words, and an edge ring in dark', async () => {
  const look = async () => {
    const bar = await mount(2)
    const style = getComputedStyle(surface(bar))
    const background = style.backgroundColor
    const count = getComputedStyle(bar.shadowRoot!.querySelector('[role="status"]')!)
    const word = getComputedStyle(document.querySelector('eb-button')!.shadowRoot!.querySelector('button')!)
    return {
      background,
      height: surface(bar).getBoundingClientRect().height,
      shadow: style.boxShadow,
      weight: count.fontWeight,
      count: contrast(count.color, background),
      word: contrast(word.color, background),
    }
  }
  const light = await look()
  const dark = await inDark(look)
  expect(light.background).toBe('oklch(0.22 0.006 85)')
  expect(dark.background).toBe('oklch(0.29 0.005 85)')
  for (const mode of [light, dark]) {
    expect(mode.height).toBe(44)
    expect(mode.weight).toBe('600')
    expect(mode.count).toBeGreaterThanOrEqual(4.5)
    expect(mode.word).toBeGreaterThanOrEqual(4.5)
  }
  expect(light.shadow).not.toContain('oklch(0.35 0.006 85) 0px 0px 0px 1px inset')
  expect(dark.shadow).toContain('oklch(0.35 0.006 85) 0px 0px 0px 1px inset')
  // It floats at shadow level 3, the overlays' depth.
  expect(light.shadow).toContain('0px 16px 40px 0px')
  expect(dark.shadow).toContain('0px 18px 48px 0px')
})

test('on a 360 px phone the bar shows the count, the first action and More actions, nothing clipped', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = `<div style="width: 328px; margin: 0 16px"><eb-bulk-bar count="2">${actions}</eb-bulk-bar></div>`
  const bar = document.querySelector('eb-bulk-bar')!
  await settle(bar)
  await document.fonts.ready
  const box = surface(bar).getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(360)
  expect(box.height).toBe(44)
  const [confirm, book, print] = [...document.querySelectorAll('eb-button')]
  const trigger = more(bar)!
  expect([visible(confirm!), visible(book!), visible(print!), visible(trigger)]).toEqual([true, false, false, true])
  const parts = [bar.shadowRoot!.querySelector('[role="status"]')!, confirm!, trigger, clearButton(bar)]
  for (const part of parts) {
    const inner = part.shadowRoot?.querySelector('button') ?? part
    for (const el of [part, inner]) {
      const r = el.getBoundingClientRect()
      expect(r.left).toBeGreaterThanOrEqual(box.left)
      expect(r.right).toBeLessThanOrEqual(box.right)
      expect(r.top).toBeGreaterThanOrEqual(box.top)
      expect(r.bottom).toBeLessThanOrEqual(box.bottom)
    }
  }
  expect(clearButton(bar).getBoundingClientRect().width).toBe(44)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
})

test('on a 360 px phone More actions holds the other two, and Print labels there presses the real one', async () => {
  await page.viewport(360, 800)
  const bar = await mount(2)
  const print = document.querySelectorAll('eb-button')[2]!
  let pressed = 0
  print.addEventListener('click', () => (pressed += 1))
  await userEvent.click(more(bar)!.shadowRoot!.querySelector('button')!)
  await frame()
  const items = [...bar.shadowRoot!.querySelectorAll('eb-menu-item')]
  expect(items.filter(visible).map((item) => item.textContent!.trim())).toEqual(['Book courier', 'Print labels'])
  // The panel is a menu like any other, not the bar's inverse surface.
  expect(getComputedStyle(items[0]!).color).toBe('oklch(0.21 0.006 85)')
  await userEvent.click(items[1]!)
  expect(pressed).toBe(1)
})

test("in dark the More actions menu's items read in the page's text colour", async () => {
  await page.viewport(360, 800)
  const color = await inDark(async () => {
    const bar = await mount(2)
    return getComputedStyle(bar.shadowRoot!.querySelector('eb-menu-item')!).color
  })
  expect(color).toBe('oklch(0.955 0.003 85)')
})

test('at 1280 px all three actions show and there is no More actions button', async () => {
  await page.viewport(1280, 800)
  const bar = await mount(2)
  expect([...document.querySelectorAll('eb-button')].map(visible)).toEqual([true, true, true])
  const trigger = more(bar)
  expect(trigger === null || !visible(trigger)).toBe(true)
  await page.viewport(360, 800)
})

test("an action's icon draws at 16 px in the bar's text colour", async () => {
  document.body.innerHTML = `<eb-bulk-bar count="2"><eb-button variant="ghost" size="sm"><eb-icon slot="icon" name="check"></eb-icon>Confirm</eb-button></eb-bulk-bar>`
  const bar = document.querySelector('eb-bulk-bar')!
  await settle(bar)
  const icon = document.querySelector('eb-icon')!
  const box = icon.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([16, 16])
  expect(getComputedStyle(icon).color).toBe('oklch(0.97 0 0)')
  expect(getComputedStyle(surface(bar)).color).toBe('oklch(0.97 0 0)')
})

test('on a phone Clear selection is a 44 px target, like the actions beside it', async () => {
  await page.viewport(360, 800)
  const bar = await mount(2)
  const clear = clearButton(bar).getBoundingClientRect()
  expect([clear.width, clear.height]).toEqual([44, 44])
  expect(surface(bar).getBoundingClientRect().height).toBe(44)
})

test('on a computer Clear selection stays 28 px', async () => {
  await page.viewport(1280, 800)
  const clear = clearButton(await mount(2)).getBoundingClientRect()
  await page.viewport(360, 800)
  expect([clear.width, clear.height]).toEqual([28, 28])
})
