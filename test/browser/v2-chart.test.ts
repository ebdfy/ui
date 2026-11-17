import { expect, test } from 'vitest'
// e-chart: a column chart v2.css draws from markup alone, Home's 30 days of net sales in a card at
// 1440 px and in the 328 px card at 360 px.
import { page } from 'vitest/browser'

import '../../src/v2.css'
import { contrast, inDark } from './colour.ts'

// Home's 30 days, 15 Oct to 13 Nov 2026: ৳9,87,156 in all and ৳17,420 today.
const sales = [
  36040, 39150, 39450, 36390, 34820, 28620, 28620, 31300, 34220, 34960, 25856, 32960, 28620, 30490, 34750, 38750, 39930,
  37710, 36870, 31210, 31430, 33870, 36120, 35890, 32820, 31830, 26740, 28140, 32180, 17420,
]
const bn = (text: string) => text.replaceAll(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]!)
const taka = (value: number) => `৳${new Intl.NumberFormat('en-IN').format(value)}`
const dateOf = (i: number) => {
  const day = new Date(Date.UTC(2026, 9, 15 + i))
  return `${day.getUTCDate()} ${day.getUTCMonth() === 9 ? 'Oct' : 'Nov'}`
}

function chart(lang: 'en' | 'bn' = 'en'): string {
  const say = (text: string) => (lang === 'bn' ? bn(text).replace('Oct', 'অক্টো').replace('Nov', 'নভে') : text)
  const steps = [40_000, 30_000, 20_000, 10_000].map((step) => `<e-chart-step>${say(taka(step))}</e-chart-step>`)
  const bars = sales.map((value, i) => {
    const marks = `${[0, 14, 29].includes(i) ? ' tick' : ''}${i === 29 ? ' today' : ''}`
    return `<e-chart-bar label="${say(dateOf(i))}"${marks} style="--e-share: ${value / 40_000}">${say(taka(value))}</e-chart-bar>`
  })
  return `<e-chart lang="${lang}" label="Net sales a day" total="${say(taka(987_156))}"><span slot="key">Net sales</span>${steps.join('')}${bars.join('')}</e-chart>`
}

// The chart in a card as wide as the screen leaves it: 1100 px at 1440, 328 px at 360.
async function render(width: number, html = chart()): Promise<void> {
  await page.viewport(width, 800)
  document.body.style.margin = '0'
  document.body.innerHTML = `<div style="padding: 16px; width: ${width === 360 ? 328 : 1100}px"><e-card>${html}</e-card></div>`
}

const bars = () => [...document.querySelectorAll('e-chart-bar')]
const box = (tag: Element) => tag.getBoundingClientRect()

test('30 bars, the 30th lime and the other 29 in the bar colour', async () => {
  await render(1440)
  const colours = bars().map((bar) => getComputedStyle(bar).backgroundColor)
  expect(colours.length).toBe(30)
  const root = getComputedStyle(document.documentElement)
  const probe = document.createElement('i')
  document.body.append(probe)
  probe.style.color = root.getPropertyValue('--e-color-lime')
  const lime = getComputedStyle(probe).color
  probe.style.color = root.getPropertyValue('--e-color-chart-bar')
  const ink = getComputedStyle(probe).color
  expect(lime).not.toBe(ink)
  expect(colours.at(-1)).toBe(lime)
  expect(new Set(colours.slice(0, 29))).toEqual(new Set([ink]))
})

// Four reference bars at the four steps' shares: each label's middle must sit on its bar's top.
test.each([1440, 360])('at %i px each of the 4 step labels sits centred on its gridline within 1 px', async (width) => {
  const shares = [1, 0.75, 0.5, 0.25]
  await render(
    width,
    `<e-chart label="Steps" total="৳1"><e-chart-step>৳40,000</e-chart-step><e-chart-step>৳30,000</e-chart-step><e-chart-step>৳20,000</e-chart-step><e-chart-step>৳10,000</e-chart-step>${shares.map((share) => `<e-chart-bar label="x" style="--e-share: ${share}">৳1</e-chart-bar>`).join('')}</e-chart>`,
  )
  const steps = [...document.querySelectorAll('e-chart-step')]
  for (const [i, step] of steps.entries()) {
    const { top, height } = box(step)
    expect(Math.abs(top + height / 2 - box(bars()[i]!).top), `step ${i}`).toBeLessThanOrEqual(1)
  }
  // The chart paints its gridlines a quarter of its plot apart from the plot's top: each one on a label.
  const tag = document.querySelector('e-chart')!
  const style = getComputedStyle(tag)
  expect(style.backgroundSize).toBe('100% 1px, 100% 25%')
  const plotTop = box(tag).top + Number.parseFloat(style.paddingTop)
  const plot = Number.parseFloat(style.height)
  for (const [i, step] of steps.entries()) {
    const { top, height } = box(step)
    expect(Math.abs(top + height / 2 - (plotTop + (i * plot) / 4)), `line ${i}`).toBeLessThanOrEqual(1)
  }
})

test.each([1440, 360])('at %i px a bar is 68%% of its step wide, within 1 px', async (width) => {
  await render(width)
  const all = bars().map(box)
  const step = (all.at(-1)!.left - all[0]!.left) / (all.length - 1)
  for (const bar of all) expect(Math.abs(bar.width - 0.68 * step)).toBeLessThanOrEqual(1)
  // The chart stays inside its card, every bar in it.
  const card = box(document.querySelector('e-card')!)
  expect(all.at(-1)!.right).toBeLessThanOrEqual(card.right)
  expect(box(document.querySelector('e-chart')!).width).toBeLessThanOrEqual(card.width)
})

// A ticked bar's label is its ::before, drawn under the axis; any other bar's is for a screen reader.
function labels() {
  return bars().map((bar, i) => {
    const style = getComputedStyle(bar, '::before')
    const shown = style.clipPath === 'none'
    const width = Number.parseFloat(style.width)
    const { left, bottom } = box(bar)
    // Where the label starts: its inline-start inset, less half its width when it is centred.
    const start = left + Number.parseFloat(style.left) + (style.translate === 'none' ? 0 : -width / 2)
    return {
      i,
      shown,
      size: style.fontSize,
      height: Number.parseFloat(style.height),
      top: bottom + Number.parseFloat(style.top) - box(bar).height,
      start,
      end: start + width,
      axis: bottom,
    }
  })
}

test('date labels show under bars 1, 15 and 30 only, at 13.5 px', async () => {
  await render(1440)
  const all = labels()
  expect(all.filter((label) => label.shown).map((label) => label.i)).toEqual([0, 14, 29])
  for (const label of all.filter((one) => one.shown)) {
    expect(label.size).toBe('13.5px')
    expect(label.top).toBeGreaterThan(label.axis)
  }
})

test('in Bangla at 360 px the step labels read in Bangla digits, and the date labels stay one line in the card', async () => {
  await render(360, chart('bn'))
  expect([...document.querySelectorAll('e-chart-step')].map((step) => step.textContent)).toEqual([
    '৳৪০,০০০',
    '৳৩০,০০০',
    '৳২০,০০০',
    '৳১০,০০০',
  ])
  const card = box(document.querySelector('e-chart')!)
  const shown = labels().filter((label) => label.shown)
  expect(shown.length).toBe(3)
  for (const label of shown) {
    expect(label.height).toBe(20)
    expect(label.start).toBeGreaterThanOrEqual(card.left - 1)
    expect(label.end).toBeLessThanOrEqual(card.right + 1)
  }
  // Each starts after the one before it ends.
  for (const [i, label] of shown.slice(1).entries()) expect(label.start).toBeGreaterThan(shown[i]!.end)
  // Every step label is one line too.
  for (const step of document.querySelectorAll('e-chart-step')) expect(box(step).height).toBe(20)
})

test('in dark every bar keeps 3:1 against the card', async () => {
  await render(1440)
  const seen = await inDark(async () => ({
    card: getComputedStyle(document.querySelector('e-card')!).backgroundColor,
    bars: bars().map((bar) => getComputedStyle(bar).backgroundColor),
  }))
  for (const colour of new Set(seen.bars)) expect(contrast(colour, seen.card)).toBeGreaterThanOrEqual(3)
})
