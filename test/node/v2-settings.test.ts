// The sample app's v2 order settings: each section's heading and help in the left third and its card
// on the right on a wide screen, the help above the card on a phone, and Bangla help on a tall line.
import { afterAll, beforeAll, expect, test } from 'vitest'

import { startPages } from './pages.ts'

let pages: Awaited<ReturnType<typeof startPages>>

beforeAll(async () => {
  pages = await startPages()
})

afterAll(() => pages?.close())

async function settings(width: number, lang: 'en' | 'bn' = 'en') {
  const { page, errors } = await pages.open('', width)
  await page.goto(`${pages.sampleApp}/orders-settings?lang=${lang}`)
  await page.locator('e-settings-section > h2').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  const section = page.locator('e-settings-section').first()
  const boxes = await section.evaluate((tag) => {
    const box = (el: Element | null) => {
      const r = el!.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }
    }
    return {
      section: box(tag),
      heading: box(tag.querySelector(':scope > h2')),
      help: box(tag.querySelector(':scope > p')),
      card: box(tag.querySelector(':scope > e-card')),
    }
  })
  return { page, errors, section, boxes }
}

test('at 1440 px Delivery charges shows its help in the left third and its card on the right', async () => {
  const { errors, section, boxes } = await settings(1440)
  expect(await section.locator(':scope > h2').textContent()).toBe('Delivery charges')
  const third = boxes.section.left + boxes.section.width / 3
  expect(boxes.help.left).toBe(boxes.section.left)
  expect(boxes.help.right).toBeLessThanOrEqual(third)
  expect(boxes.card.left).toBeGreaterThan(third)
  expect(boxes.card.right).toBe(boxes.section.right)
  expect(boxes.card.top).toBe(boxes.heading.top)
  expect(errors).toEqual([])
})

test('at 599 px the help sits above the card', async () => {
  const { errors, boxes } = await settings(599)
  expect(boxes.help.bottom).toBeLessThanOrEqual(boxes.card.top)
  expect(boxes.card.left).toBe(boxes.section.left)
  expect(boxes.card.width).toBe(boxes.section.width)
  expect(errors).toEqual([])
})

test('in Bangla the help reads Bangla on a line at least 1.4 times its size', async () => {
  const { errors, section } = await settings(360, 'bn')
  expect(await section.locator(':scope > h2').textContent()).toBe('ডেলিভারি চার্জ')
  const help = section.locator(':scope > p')
  expect(await help.textContent()).toBe('ঢাকার ভেতরে ও বাইরে ডেলিভারির জন্য গ্রাহক কত দেবেন।')
  const [size, line] = await help.evaluate((p) => {
    const style = getComputedStyle(p)
    return [Number.parseFloat(style.fontSize), Number.parseFloat(style.lineHeight)]
  })
  expect(line / size).toBeGreaterThanOrEqual(1.4)
  expect(errors).toEqual([])
})
