import { expect, test } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

async function render(): Promise<HTMLAnchorElement> {
  document.body.innerHTML = '<p><eb-link href="#x">Track order</eb-link></p>'
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-link')!
  await el.updateComplete
  const a = el.shadowRoot!.querySelector('a')!
  // The pointer may still rest where an earlier test's link was.
  await userEvent.unhover(a)
  return a
}

// Copied out of the live computed style, which changes when the theme or the hover does.
const paint = (a: HTMLAnchorElement) => ({
  underline: getComputedStyle(a).textDecorationColor,
  text: getComputedStyle(a).color,
})

test('the underline is divider at rest and text on hover, in light', async () => {
  const a = await render()
  expect(paint(a)).toEqual({ underline: 'oklch(0.925 0.004 85)', text: 'oklch(0.21 0.006 85)' })
  await userEvent.hover(a)
  expect(paint(a)).toEqual({ underline: 'oklch(0.21 0.006 85)', text: 'oklch(0.21 0.006 85)' })
})

test('the underline is divider at rest and text on hover, in dark', async () => {
  const a = await render()
  const dark = await inDark(async () => {
    const rest = paint(a)
    await userEvent.hover(a)
    return { rest, hover: paint(a) }
  })
  expect(dark.rest).toEqual({ underline: 'oklch(0.285 0.005 85)', text: 'oklch(0.955 0.003 85)' })
  expect(dark.hover).toEqual({ underline: 'oklch(0.955 0.003 85)', text: 'oklch(0.955 0.003 85)' })
})
