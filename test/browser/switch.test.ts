// The switch's layout in a row, and its off track: a light fill inside a visible ring.
import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { contrast, inDark } from './colour.ts'

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

afterEach(async () => {
  document.body.innerHTML = ''
  await page.viewport(360, 800)
})

// A 928 px wide container, as the docs page gives a row, at a desktop viewport.
async function mount(attributes = ''): Promise<Upgraded> {
  await page.viewport(1280, 800)
  document.body.innerHTML = `<div id="host" style="width: 928px"><eb-switch label="Order alerts" ${attributes}></eb-switch></div>`
  const el = document.querySelector('eb-switch') as Upgraded
  await el.updateComplete
  return el
}

const track = (el: Upgraded) => el.shadowRoot.querySelector('input')!
const text = (el: Upgraded) => el.shadowRoot.querySelector('.row span')!

test('by default the track sits 12 px from the label text, not stretched across the row', async () => {
  const el = await mount()
  const box = track(el).getBoundingClientRect()
  const label = text(el).getBoundingClientRect()
  expect(label.left - box.right).toBe(12)
  expect(label.right - box.left).toBeLessThan(200)
})

test('stretch puts the label at the row start and the track at the row end', async () => {
  const el = await mount('stretch')
  const container = document.getElementById('host')!.getBoundingClientRect()
  const box = track(el).getBoundingClientRect()
  const label = text(el).getBoundingClientRect()
  expect(el.hasAttribute('stretch')).toBe(true)
  expect(box.right).toBe(container.right)
  expect(label.left).toBe(container.left)
})

test('stretch is a boolean property that reflects to its attribute', async () => {
  const el = (await mount()) as Upgraded & { stretch: boolean }
  expect(el.stretch).toBe(false)
  el.stretch = true
  await el.updateComplete
  expect(el.hasAttribute('stretch')).toBe(true)
})

const pages = {
  light: { bg: 'oklch(0.985 0.002 85)', surface: 'oklch(1 0 0)' },
  dark: { bg: 'oklch(0.16 0.004 85)', surface: 'oklch(0.215 0.004 85)' },
}

async function readTrack() {
  const { boxShadow, backgroundColor } = getComputedStyle(track(await mount()))
  return { boxShadow, backgroundColor }
}

for (const theme of ['light', 'dark'] as const) {
  test(`the off track draws a ring at 3:1 or more on the page and the surface in ${theme}`, async () => {
    const { boxShadow } = theme === 'dark' ? await inDark(readTrack) : await readTrack()
    const match = boxShadow.match(/(oklch\([^)]+\)) 0px 0px 0px (\d+)px inset/)
    expect(match?.[2]).toBe('1')
    expect(contrast(match![1]!, pages[theme].bg)).toBeGreaterThanOrEqual(3)
    expect(contrast(match![1]!, pages[theme].surface)).toBeGreaterThanOrEqual(3)
  })
}

test('the off track fills with the light surface-3 grey in light', async () => {
  expect((await readTrack()).backgroundColor).toBe('oklch(0.952 0.004 85)')
})
