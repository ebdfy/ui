import { expect, test } from 'vitest'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

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

function root(selector: string): ShadowRoot {
  const shadow = document.querySelector(selector)?.shadowRoot
  if (!shadow) throw new Error(`no shadow root on ${selector}`)
  return shadow
}

const loading = { en: 'Loading', bn: 'লোড হচ্ছে' }

for (const lang of ['en', 'bn'] as const) {
  test(`a spinner is a status labelled in ${lang}`, async () => {
    document.documentElement.lang = lang
    await render('<eb-spinner></eb-spinner>')
    const el = document.querySelector('eb-spinner')!
    const ring = root('eb-spinner').querySelector('.ring')!
    expect(ring.getAttribute('role')).toBe('status')
    expect(ring.getAttribute('aria-label')).toBe(loading[lang])
    const box = el.getBoundingClientRect()
    expect(box.width).toBe(20)
    expect(box.height).toBe(20)
  })
}

test('a spinner ring is accent coloured and turns once a second', async () => {
  document.documentElement.lang = 'en'
  await render('<eb-spinner></eb-spinner>')
  const ring = root('eb-spinner').querySelector('.ring')!
  const style = getComputedStyle(ring)
  expect(style.borderTopColor).toBe('oklch(0.52 0.19 268)')
  expect(style.animationDuration).toBe('1s')
})

test('a skeleton of three lines draws three bars and the last is narrower', async () => {
  await render('<eb-skeleton lines="3"></eb-skeleton>')
  const el = document.querySelector('eb-skeleton')!
  expect(root('eb-skeleton').querySelector('[aria-hidden="true"]')).not.toBeNull()
  const bars = root('eb-skeleton').querySelectorAll('.bar')
  expect(bars).toHaveLength(3)
  const first = bars[0]!.getBoundingClientRect()
  const last = bars[2]!.getBoundingClientRect()
  expect(first.height).toBe(12)
  expect(last.width).toBeLessThan(first.width)
  expect(last.width / first.width).toBeCloseTo(0.6)
  expect(getComputedStyle(bars[0]!).backgroundColor).toBe('oklch(0.925 0.004 85)')
  expect(getComputedStyle(bars[0]!).borderRadius).toBe('6px')
  expect(el.getBoundingClientRect().height).toBe(72)
})

// A bar on the page has to show: divider, not the surface-3 that all but vanished on bg.
test('a skeleton bar is the divider colour, at 1.15:1 or more on bg in light and dark', async () => {
  await render('<eb-skeleton></eb-skeleton>')
  const read = async () => ({
    bar: getComputedStyle(root('eb-skeleton').querySelector('.bar')!).backgroundColor,
    bg: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-bg').trim(),
    divider: getComputedStyle(document.documentElement).getPropertyValue('--eb-color-divider').trim(),
  })
  for (const { bar, bg, divider } of [await read(), await inDark(read)]) {
    expect(bar).toBe(divider)
    expect(contrast(bar, bg)).toBeGreaterThanOrEqual(1.15)
  }
})

test('a skeleton with no lines draws one full width bar', async () => {
  await render('<eb-skeleton></eb-skeleton>')
  const bars = root('eb-skeleton').querySelectorAll('.bar')
  expect(bars).toHaveLength(1)
  expect(bars[0]!.getBoundingClientRect().width).toBe(
    document.querySelector('eb-skeleton')!.getBoundingClientRect().width,
  )
})

test('a progress bar at 40 fills 40 percent of its track', async () => {
  await render('<eb-progress-bar value="40" label="Upload"></eb-progress-bar>')
  const bar = root('eb-progress-bar').querySelector('[role="progressbar"]')!
  expect(bar.getAttribute('aria-valuenow')).toBe('40')
  expect(bar.getAttribute('aria-valuemin')).toBe('0')
  expect(bar.getAttribute('aria-valuemax')).toBe('100')
  expect(bar.getAttribute('aria-label')).toBe('Upload')
  const track = bar.getBoundingClientRect()
  const fill = root('eb-progress-bar').querySelector('.fill')!.getBoundingClientRect()
  expect(track.height).toBe(4)
  expect(fill.width / track.width).toBeCloseTo(0.4)
  expect(getComputedStyle(root('eb-progress-bar').querySelector('.fill')!).backgroundColor).toBe('oklch(0.52 0.19 268)')
})

test('a progress bar with no value is indeterminate', async () => {
  await render('<eb-progress-bar></eb-progress-bar>')
  const bar = root('eb-progress-bar').querySelector('[role="progressbar"]')!
  expect(bar.hasAttribute('aria-valuenow')).toBe(false)
  const fill = root('eb-progress-bar').querySelector('.fill')!
  expect(getComputedStyle(fill).animationName).not.toBe('none')
})

test('an empty state shows a heading, its line and an action below', async () => {
  await render(`<eb-empty-state heading="No orders yet"><p>Add your first order.</p>
    <eb-button slot="action" variant="primary">Add order</eb-button></eb-empty-state>`)
  const el = document.querySelector('eb-empty-state')!
  const h2 = root('eb-empty-state').querySelector('h2')!
  expect(h2.textContent).toBe('No orders yet')
  expect(getComputedStyle(h2).fontSize).toBe('17px')
  expect(getComputedStyle(h2).lineHeight).toBe('24px')
  expect(getComputedStyle(h2).fontWeight).toBe('600')
  const style = getComputedStyle(el)
  expect(style.textAlign).toBe('center')
  expect(style.paddingTop).toBe('32px')
  expect(style.paddingLeft).toBe('16px')
  expect(style.backgroundColor).toBe('oklch(1 0 0)')
  expect(style.borderRadius).toBe('12px')
  const button = document.querySelector('eb-button')!.getBoundingClientRect()
  expect(button.width).toBeGreaterThan(0)
  expect(button.height).toBeGreaterThanOrEqual(44)
  expect(button.top).toBeGreaterThanOrEqual(h2.getBoundingClientRect().bottom)
})
