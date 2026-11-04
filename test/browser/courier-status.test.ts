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
    PENDING: ['Awaiting pickup', 'tone=neutral'],
    PICKED_UP: ['Picked up', 'status=shipped'],
    IN_TRANSIT: ['With courier', 'status=shipped'],
    OUT_FOR_DELIVERY: ['Out for delivery', 'status=shipped'],
    ON_HOLD: ['On hold', 'tone=warning'],
    ATTEMPT_FAILED: ['Delivery failed', 'tone=warning'],
    DELIVERED: ['Delivered', 'tone=success'],
    PARTIAL_DELIVERED: ['Partly delivered', 'tone=warning'],
    RETURNING: ['Returning', 'tone=warning'],
    RETURNED: ['Returned', 'tone=danger'],
    CANCELLED: ['Cancelled', 'tone=danger'],
    EXCEPTION: ['Problem', 'tone=danger'],
    UNKNOWN: ['Unknown', 'tone=neutral'],
  }
  for (const [code, [words, look]] of Object.entries(expected)) {
    const el = await status(`<div lang="en"><eb-courier-status status="${code}"></eb-courier-status></div>`)
    const shown = badge(el).hasAttribute('status')
      ? `status=${badge(el).getAttribute('status')}`
      : `tone=${badge(el).getAttribute('tone')}`
    expect([el.shadowRoot!.textContent!.trim(), shown], code).toEqual([words, look])
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
