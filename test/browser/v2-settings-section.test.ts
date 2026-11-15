// e-settings-section: its heading and help in the left third and its cards on the right from 600 px,
// the help above the cards below that; drawn by v2.css first, and the script moves nothing.
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { defineCard } from '../../src/v2/card.ts'
import { defineSettingsSection } from '../../src/v2/settings-section.ts'

const section = `<e-settings-section heading="Delivery charges" help="What a customer pays for delivery, inside and outside Dhaka.">
  <e-card heading="Charges"><p style="height: 200px; margin: 0">Inside Dhaka ৳80</p></e-card>
  <e-card heading="Free delivery"><p style="margin: 0">Over ৳3,000</p></e-card>
</e-settings-section>`

const rect = (el: Element) => el.getBoundingClientRect()
const cards = () => [...document.querySelectorAll('e-card')]
// The heading and help: the built h2 and p, or the tag's ::before and ::after before the script.
const help = () => document.querySelector('e-settings-section > p[slot="help"]')!

const boxes = () => cards().flatMap((card) => [rect(card).left, rect(card).top, rect(card).width, rect(card).height])

async function at<T>(width: number, run: () => T | Promise<T>): Promise<T> {
  await page.viewport(width, 900)
  try {
    return await run()
  } finally {
    await page.viewport(360, 800)
  }
}

// First in the file: once defined, a tag upgrades as it is inserted.
test('the script builds an h2 and the help where v2.css drew them, moving nothing at 360 or 1440 px', async () => {
  document.body.innerHTML = section
  const tag = document.querySelector('e-settings-section')!
  const pseudos = () => [getComputedStyle(tag, '::before').content, getComputedStyle(tag, '::after').content]
  expect(pseudos()).toEqual(['"Delivery charges"', '"What a customer pays for delivery, inside and outside Dhaka."'])
  const before = { 360: boxes(), 1440: await at(1440, boxes) }
  defineSettingsSection()
  defineCard()
  expect(document.querySelector('e-settings-section > h2')!.textContent).toBe('Delivery charges')
  expect(help().textContent).toBe('What a customer pays for delivery, inside and outside Dhaka.')
  expect(pseudos()).toEqual(['none', 'none'])
  const after = { 360: boxes(), 1440: await at(1440, boxes) }
  for (const width of [360, 1440] as const) {
    const moved = after[width].filter((n, i) => Math.abs(n - before[width][i]!) > 1)
    expect([width, ...moved]).toEqual([width])
  }
})

test('at 1440 px the help sits in the left 260 px and the cards on the right, one under the other', async () => {
  await at(1440, () => {
    document.body.innerHTML = section
    defineSettingsSection()
    defineCard()
    const box = rect(document.querySelector('e-settings-section')!)
    const third = box.left + 260
    const heading = rect(document.querySelector('e-settings-section > h2')!)
    expect(heading.left).toBe(box.left)
    expect(rect(help()).left).toBe(box.left)
    expect(rect(help()).right).toBeLessThanOrEqual(third)
    expect(rect(help()).top).toBeGreaterThanOrEqual(heading.bottom)
    const [charges, free] = cards().map(rect)
    expect(charges!.left).toBeGreaterThan(third)
    expect(charges!.right).toBe(box.right)
    expect(charges!.top).toBe(heading.top)
    // The second card follows the first, not the help.
    expect(free!.top - charges!.bottom).toBe(16)
    expect(free!.left).toBe(charges!.left)
  })
})

// The section keeps no margin of its own: pages stack sections in a 24 px gap (e-stack gap="6", or the
// Admin form's grid), which a margin would double.
test('from 900 px the title column is 260 px, from 600 it is a third, and stacked sections sit 24 px apart', async () => {
  document.body.innerHTML = `<e-stack gap="6">${section + section}</e-stack>`
  const tag = document.querySelector('e-settings-section')!
  const columns = () => getComputedStyle(tag).gridTemplateColumns.split(' ')
  const column = (width: number) => at(width, () => columns()[0])
  // Before the script the title is the ::before, so the track is what holds it.
  expect(await column(1440)).toBe('260px')
  expect(await column(900)).toBe('260px')
  // A third of the width left after the 16 px gap.
  const third = await at(700, () => (rect(tag).width - 16) / 3)
  expect(Number.parseFloat((await column(700))!)).toBeCloseTo(third, 0)
  expect(await at(1440, () => rect(document.querySelectorAll('e-settings-section')[1]!).top - rect(tag).bottom)).toBe(
    24,
  )
  defineSettingsSection()
  await at(1440, () => {
    expect(rect(document.querySelector('e-settings-section > h2')!).width).toBe(260)
  })
  await at(700, () => {
    const h2 = rect(document.querySelector('e-settings-section > h2')!)
    expect(h2.width).toBeCloseTo((rect(tag).width - 16) / 3, 0)
  })
})

test('at 599 px the heading and help sit above the cards, full width', async () => {
  await at(599, () => {
    document.body.innerHTML = section
    defineSettingsSection()
    defineCard()
    const box = rect(document.querySelector('e-settings-section')!)
    const [charges] = cards().map(rect)
    expect(rect(help()).bottom).toBeLessThanOrEqual(charges!.top)
    expect(charges!.left).toBe(box.left)
    expect(charges!.width).toBe(box.width)
  })
})

test('a new heading or help, as a page switching language sets, goes to the built h2 and p', () => {
  document.body.innerHTML = section
  defineSettingsSection()
  const tag = document.querySelector('e-settings-section')!
  tag.setAttribute('heading', 'ডেলিভারি চার্জ')
  tag.setAttribute('help', 'ঢাকার ভেতরে ও বাইরে ডেলিভারির জন্য গ্রাহক কত দেবেন।')
  expect(document.querySelector('e-settings-section > h2')!.textContent).toBe('ডেলিভারি চার্জ')
  expect(help().textContent).toBe('ঢাকার ভেতরে ও বাইরে ডেলিভারির জন্য গ্রাহক কত দেবেন।')
  expect(document.querySelectorAll('e-settings-section > h2, e-settings-section > p')).toHaveLength(2)
})

test('in Bangla the help keeps a line at least 1.4 times its size', () => {
  document.body.innerHTML = `<div lang="bn">${section}</div>`
  const tag = document.querySelector('e-settings-section')!
  const drawn = getComputedStyle(tag, '::after')
  expect(Number.parseFloat(drawn.lineHeight) / Number.parseFloat(drawn.fontSize)).toBeGreaterThanOrEqual(1.4)
  defineSettingsSection()
  const built = getComputedStyle(help())
  expect(Number.parseFloat(built.lineHeight) / Number.parseFloat(built.fontSize)).toBeGreaterThanOrEqual(1.4)
  expect(Number.parseFloat(built.fontSize)).toBeGreaterThanOrEqual(13)
})
