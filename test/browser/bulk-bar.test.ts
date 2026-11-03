import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

const actions = `
  <eb-button variant="ghost" size="sm">Confirm</eb-button>
  <eb-button variant="ghost" size="sm">Book courier</eb-button>
  <eb-button variant="ghost" size="sm">Print labels</eb-button>`

async function mount(count: number, lang: 'bn' | 'en' = 'en') {
  document.body.innerHTML = `<div lang="${lang}"><button id="before">Before</button><eb-bulk-bar count="${count}">${actions}</eb-bulk-bar></div>`
  const bar = document.querySelector('eb-bulk-bar')!
  await bar.updateComplete
  await Promise.all([...document.querySelectorAll('eb-button')].map((b) => b.updateComplete))
  return bar
}

const clearButton = (bar: Element) => bar.shadowRoot!.querySelector<HTMLButtonElement>('button')!

// The element that holds focus, looking through every shadow root.
function focused(): Element {
  let el = document.activeElement!
  while (el.shadowRoot?.activeElement) el = el.shadowRoot.activeElement
  return el
}

// Tabs from the button before the bar through each part, copying what each ring looks like.
async function walk(bar: Element, steps: number) {
  document.querySelector<HTMLElement>('#before')!.focus()
  const background = getComputedStyle(bar).backgroundColor
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

test("the count reads in the bar's language, in that language's digits", async () => {
  const en = await mount(2)
  expect(en.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).toBe('2 selected')
  const bn = await mount(2, 'bn')
  expect(bn.shadowRoot!.querySelector('[role="status"]')!.textContent!.trim()).toBe('২টি নির্বাচিত')
})

test('a bar with a count of 0 draws no box and Tab skips it', async () => {
  const bar = await mount(0)
  const box = bar.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([0, 0])
  document.querySelector<HTMLElement>('#before')!.focus()
  await userEvent.keyboard('{Tab}')
  expect(bar.contains(document.activeElement)).toBe(false)
})

test('tab visits the three actions then Clear selection, each with a 2 px ring at 3:1 in light and dark', async () => {
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
})

test('the clear button is named in Bangla under a Bangla page', async () => {
  const bar = await mount(2, 'bn')
  expect(clearButton(bar).getAttribute('aria-label')).toBe('নির্বাচন মুছুন')
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
    const style = getComputedStyle(bar)
    const background = style.backgroundColor
    const count = getComputedStyle(bar.shadowRoot!.querySelector('[role="status"]')!)
    const word = getComputedStyle(document.querySelector('eb-button')!.shadowRoot!.querySelector('button')!)
    return {
      background,
      height: bar.getBoundingClientRect().height,
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
})

test('on a 360 px phone the bar fits its column: the actions scroll inside it and Clear selection stays in view', async () => {
  await page.viewport(360, 800)
  document.body.innerHTML = `<div style="width: 328px; margin: 0 16px"><eb-bulk-bar count="2">${actions}</eb-bulk-bar></div>`
  const bar = document.querySelector('eb-bulk-bar')!
  await bar.updateComplete
  await Promise.all([...document.querySelectorAll('eb-button')].map((b) => b.updateComplete))
  const column = bar.parentElement!.getBoundingClientRect()
  const box = bar.getBoundingClientRect()
  expect(box.right).toBeLessThanOrEqual(column.right)
  expect(box.height).toBe(44)
  const clear = clearButton(bar).getBoundingClientRect()
  expect(clear.right).toBeLessThanOrEqual(box.right)
  expect(clear.width).toBe(44)
  for (const button of document.querySelectorAll('eb-button')) {
    expect(button.shadowRoot!.querySelector('button')!.getBoundingClientRect().height).toBeLessThanOrEqual(44)
  }
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360)
  // The scroll box leaves room for an action's ring: 2 px wide at a 2 px offset.
  const scroller = bar.shadowRoot!.querySelector('.actions')!.getBoundingClientRect()
  const first = document.querySelector('eb-button')!.getBoundingClientRect()
  expect(first.left - 4).toBeGreaterThanOrEqual(scroller.left)
  expect(first.top - 4).toBeGreaterThanOrEqual(scroller.top)
  expect(first.bottom + 4).toBeLessThanOrEqual(scroller.bottom)
})

test('on a phone Clear selection is a 44 px target, like the actions beside it', async () => {
  await page.viewport(360, 800)
  const bar = await mount(2)
  const clear = clearButton(bar).getBoundingClientRect()
  expect([clear.width, clear.height]).toEqual([44, 44])
  expect(bar.getBoundingClientRect().height).toBe(44)
})

test('on a computer Clear selection stays 28 px', async () => {
  await page.viewport(1280, 800)
  const clear = clearButton(await mount(2)).getBoundingClientRect()
  await page.viewport(360, 800)
  expect([clear.width, clear.height]).toEqual([28, 28])
})
