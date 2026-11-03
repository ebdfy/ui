import { expect, test } from 'vitest'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

async function status(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html
  const el = document.querySelector<HTMLElement & { updateComplete: Promise<unknown> }>('eb-courier-status')!
  await el.updateComplete
  return el
}

const shipped = { background: 'rgba(0, 0, 0, 0)', color: 'oklch(0.21 0.006 85)' }

function badge(el: HTMLElement): HTMLElement {
  return el.shadowRoot!.querySelector('eb-badge')!
}

test('an IN_TRANSIT badge reads কুরিয়ারে in Bangla and With courier in English, in the shipped tone', async () => {
  for (const [lang, words] of [
    ['bn', 'কুরিয়ারে'],
    ['en', 'With courier'],
  ]) {
    const el = await status(`<div lang="${lang}"><eb-courier-status status="IN_TRANSIT"></eb-courier-status></div>`)
    expect(el.shadowRoot!.textContent!.trim()).toBe(words)
    const style = getComputedStyle(badge(el))
    expect({ background: style.backgroundColor, color: style.color }).toEqual(shipped)
  }
})

test('each courier status has its own words and tone', async () => {
  const expected = {
    PENDING: ['Awaiting pickup', 'info'],
    PICKED_UP: ['Picked up', 'shipped'],
    IN_TRANSIT: ['With courier', 'shipped'],
    OUT_FOR_DELIVERY: ['Out for delivery', 'shipped'],
    ON_HOLD: ['On hold', 'attention'],
    ATTEMPT_FAILED: ['Delivery failed', 'attention'],
    DELIVERED: ['Delivered', 'success'],
    PARTIAL_DELIVERED: ['Partly delivered', 'attention'],
    RETURNING: ['Returning', 'attention'],
    RETURNED: ['Returned', 'critical'],
    CANCELLED: ['Cancelled', 'critical'],
    EXCEPTION: ['Problem', 'critical'],
    UNKNOWN: ['Unknown', 'info'],
  }
  for (const [code, [words, tone]] of Object.entries(expected)) {
    const el = await status(`<div lang="en"><eb-courier-status status="${code}"></eb-courier-status></div>`)
    expect([el.shadowRoot!.textContent!.trim(), badge(el).getAttribute('tone')], code).toEqual([words, tone])
  }
})

test('a status the badge does not know reads as Unknown', async () => {
  const el = await status('<div lang="bn"><eb-courier-status status="LOST_IN_SPACE"></eb-courier-status></div>')
  expect(el.shadowRoot!.textContent!.trim()).toBe('অজানা')
})

async function paint(code: string) {
  const el = await status(`<div lang="bn"><eb-courier-status status="${code}"></eb-courier-status></div>`)
  const { backgroundColor, color } = getComputedStyle(badge(el))
  const dot = badge(el).shadowRoot!.querySelector('.dot')!
  return {
    backgroundColor,
    color,
    dot: getComputedStyle(dot).backgroundColor,
    text: el.shadowRoot!.textContent!.trim(),
  }
}

const transitAndReturned = async () => ({
  shipped: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-shipped').trim(),
  transit: await paint('IN_TRANSIT'),
  returned: await paint('RETURNED'),
})

test('an IN_TRANSIT status is a teal dot beside its word and RETURNED a filled red pill of white words, in both themes', async () => {
  for (const found of [await transitAndReturned(), await inDark(transitAndReturned)]) {
    expect(found.transit.dot).toBe(found.shipped)
    expect(found.transit.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(found.transit.text).toBe('কুরিয়ারে')
    expect(found.returned.backgroundColor).toBe('oklch(0.55 0.2 27)')
    expect(contrast(found.returned.color, found.returned.backgroundColor)).toBeCloseTo(5.38, 1)
    expect(found.returned.text).toBe('ফেরত এসেছে')
  }
})
