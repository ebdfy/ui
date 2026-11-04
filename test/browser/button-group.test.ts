import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

afterEach(async () => {
  document.body.innerHTML = ''
  await page.viewport(360, 800)
})

const segmented = `<eb-button-group segmented label="Language">
  <eb-button pressed="true">English</eb-button>
  <eb-button pressed="false">বাংলা</eb-button>
</eb-button-group>`

async function group(html: string) {
  document.body.innerHTML = html
  const el = document.querySelector('eb-button-group')!
  await el.updateComplete
  const buttons = [...el.querySelectorAll('eb-button')]
  for (const button of buttons) await button.updateComplete
  const track = el.shadowRoot!.querySelector<HTMLElement>('.group')!
  const inner = buttons.map((button) => button.shadowRoot!.querySelector('button')!)
  return { el, track, inner }
}

// A snapshot of the colours, since a computed style is live and the theme changes back.
function paint(el: Element) {
  const { backgroundColor, boxShadow, color } = getComputedStyle(el)
  return { backgroundColor, boxShadow, color }
}

test('a segmented group is a 28 px surface-3 track, the pressed button on surface with shadow 1', async () => {
  await page.viewport(1280, 800)
  const { track, inner } = await group(segmented)
  expect(track.getBoundingClientRect().height).toBe(28)
  expect(getComputedStyle(track).backgroundColor).toBe('oklch(0.952 0.004 85)')
  const [on, off] = inner.map(paint)
  expect(on!.backgroundColor).toBe('oklch(1 0 0)')
  expect(on!.boxShadow).toBe('oklch(0.2 0.01 85 / 0.06) 0px 1px 2px 0px')
  expect(on!.color).toBe('oklch(0.21 0.006 85)')
  expect(off!.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(off!.boxShadow).toBe('none')
  expect(off!.color).toBe('oklch(0.47 0.008 85)')
  // The two segments sit side by side inside the track, joined.
  const [a, b] = inner.map((button) => button.getBoundingClientRect())
  expect(a!.top).toBe(b!.top)
  expect(b!.left - a!.right).toBeLessThanOrEqual(2)
})

// In dark the track sits on bg, so the chosen option is the lighter one and reads as raised.
test('in dark the track is the dark bg and the pressed segment the lighter dark surface', async () => {
  await page.viewport(1280, 800)
  const dark = await inDark(async () => {
    const { track, inner } = await group(segmented)
    return { track: getComputedStyle(track).backgroundColor, on: paint(inner[0]!).backgroundColor }
  })
  expect(dark.track).toBe('oklch(0.16 0.004 85)')
  expect(dark.on).toBe('oklch(0.215 0.004 85)')
})

test('pressing a segment moves the pressed look when the app sets pressed', async () => {
  await page.viewport(1280, 800)
  const { el, inner } = await group(segmented)
  const [english, bangla] = [...el.querySelectorAll('eb-button')]
  english!.pressed = 'false'
  bangla!.pressed = 'true'
  await english!.updateComplete
  await bangla!.updateComplete
  expect(paint(inner[1]!).backgroundColor).toBe('oklch(1 0 0)')
  expect(paint(inner[0]!).backgroundColor).toBe('rgba(0, 0, 0, 0)')
})

test('on a phone a segmented track is a 44 px tap target', async () => {
  const { track } = await group(segmented)
  expect(track.getBoundingClientRect().height).toBe(44)
})

test('a plain group keeps its buttons apart with their own look', async () => {
  await page.viewport(1280, 800)
  const { track, inner } = await group(
    '<eb-button-group label="Actions"><eb-button>Confirm</eb-button><eb-button>Print</eb-button></eb-button-group>',
  )
  expect(getComputedStyle(track).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  expect(paint(inner[0]!).backgroundColor).toBe('oklch(1 0 0)')
  const [a, b] = inner.map((button) => button.getBoundingClientRect())
  expect(b!.left - a!.right).toBe(8)
  expect(a!.height).toBe(36)
})
