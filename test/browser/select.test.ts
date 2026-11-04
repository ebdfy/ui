import { afterEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v1.ts'
import { inDark } from './colour.ts'

afterEach(async () => {
  document.body.innerHTML = ''
  await page.viewport(360, 800)
})

type Upgraded = HTMLElement & { updateComplete: Promise<unknown>; shadowRoot: ShadowRoot }

async function mount(markup: string) {
  document.body.innerHTML = markup
  const els = [...document.body.querySelectorAll<Upgraded>('eb-select, eb-text-field')]
  for (const el of els) await el.updateComplete
  await document.fonts.ready
  return els
}

// The first column from the left with ink darker than 40 in every channel: the text's first stroke.
async function firstInk(element: Element): Promise<number> {
  const { base64 } = await page.screenshot({ element, base64: true })
  const image = new Image()
  image.src = `data:image/png;base64,${base64}`
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  const { data } = context.getImageData(0, 0, image.width, image.height)
  for (let x = 0; x < image.width; x++) {
    for (let y = 0; y < image.height; y++) {
      const i = (y * image.width + x) * 4
      if (data[i]! < 40 && data[i + 1]! < 40 && data[i + 2]! < 40) return x / devicePixelRatio
    }
  }
  return -1
}

test('a select draws an Ink chevron-down 16 px wide, 12 px from its end, in text-2', async () => {
  const [select] = await mount('<eb-select label="Courier"><option>Pathao</option></eb-select>')
  const control = select!.shadowRoot.querySelector('select')!
  expect(getComputedStyle(control).appearance).toBe('none')
  const chevron = select!.shadowRoot.querySelector<HTMLElement>('[part="chevron"]')!
  const box = chevron.getBoundingClientRect()
  const edge = control.getBoundingClientRect()
  expect([box.width, box.height]).toEqual([16, 16])
  expect(edge.right - box.right).toBe(12)
  expect(Math.abs(box.top + 8 - (edge.top + edge.height / 2))).toBeLessThanOrEqual(0.5)
  expect(chevron.querySelector('path')!.getAttribute('d')).toBe('m6 9 6 6 6-6')
  expect(getComputedStyle(chevron).color).toBe('oklch(0.47 0.008 85)')
  expect(getComputedStyle(chevron).pointerEvents).toBe('none')
  const dark = await inDark(async () => {
    const [again] = await mount('<eb-select label="Courier"><option>Pathao</option></eb-select>')
    return getComputedStyle(again!.shadowRoot.querySelector('[part="chevron"]')!).color
  })
  expect(dark).toBe('oklch(0.75 0.006 85)')
})

test('a select starts its text 12 px in, as a text field does, measured on the drawn text', async () => {
  await page.viewport(1280, 800)
  const [select, field] = await mount(
    `<div style="width: 300px"><eb-select label="Courier"><option>Pathao</option></eb-select></div>
     <div style="width: 300px"><eb-text-field label="Courier" value="Pathao"></eb-text-field></div>`,
  )
  const selectInk = await firstInk(select!.shadowRoot.querySelector('select')!)
  const fieldInk = await firstInk(field!.shadowRoot.querySelector('input')!)
  expect(fieldInk).toBeGreaterThanOrEqual(12)
  expect(Math.abs(selectInk - fieldInk)).toBeLessThanOrEqual(1)
})

test('a long option stops short of the chevron', async () => {
  await page.viewport(1280, 800)
  const [select] = await mount(
    '<div style="width: 200px"><eb-select label="Courier"><option>Steadfast Courier Limited, Dhaka hub</option></eb-select></div>',
  )
  const control = select!.shadowRoot.querySelector('select')!
  expect(getComputedStyle(control).paddingRight).toBe('36px')
})
