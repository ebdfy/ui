// Under 600 px the Admin's nav is a tab bar along the bottom of the chrome, as on a phone.
import { afterEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/host.ts'
import { inDark } from './colour.ts'

const appOrigin = `http://localhost:${location.port}`
const fixture = `${appOrigin}/test/browser/fixtures`
const entry = (label: string) => ({ label, path: `/test/browser/fixtures/app.html?title=${encodeURIComponent(label)}` })
const appNav = encodeURIComponent(JSON.stringify([entry('Orders'), entry('Drafts')]))

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const tabBar = () => shadow().querySelector<HTMLElement>('nav:not([part])')!
const tabs = () => [...document.querySelectorAll<HTMLElement>('[slot="nav"]')]

// Five entries as the playground has, the first current, in English or in Bangla.
async function open(query = '', bangla = false): Promise<void> {
  const labels = bangla
    ? ['হোম', 'অর্ডার', 'পণ্য', 'কাস্টমার', 'আরও']
    : ['Sample app', 'Docs', 'Hang the app', 'End access', 'Dark theme']
  const names = ['home', 'shopping-bag', 'tag', 'users', 'settings']
  const [first, ...rest] = labels
  document.body.innerHTML = `<eb-admin-chrome app-name="Sample app" src="${fixture}/app.html?title=Orders&${query}">
    <a slot="nav" href="#one" aria-current="page" data-icon="${names[0]}">${first}</a>
    ${rest
      .slice(0, 3)
      .map((label, index) => `<a slot="nav" href="#${index}" data-icon="${names[index + 1]}">${label}</a>`)
      .join('')}
    <button slot="nav" type="button" data-icon="${names[4]}">${rest[3]}</button>
  </eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Orders')
}

afterEach(() => {
  document.documentElement.removeAttribute('lang')
})

test('at 360 px the nav is a tab bar along the bottom, on the chrome surface, under the app', async () => {
  await open()
  const host = chrome().getBoundingClientRect()
  const bar = tabBar().getBoundingClientRect()
  expect(bar.bottom).toBe(host.bottom)
  expect(bar.left).toBe(host.left)
  expect(bar.right).toBe(host.right)
  expect(shadow().querySelector('.frame')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(bar.top)
  expect(getComputedStyle(tabBar()).backgroundColor).toBe('oklch(0.972 0.003 85)')
  expect(await inDark(async () => getComputedStyle(tabBar()).backgroundColor)).toBe('oklch(0.18 0.004 85)')
})

test('the five tabs share one row inside 360 px, each 52 px tall or more', async () => {
  await open()
  const boxes = tabs().map((tab) => tab.getBoundingClientRect())
  expect(boxes).toHaveLength(5)
  for (const box of boxes) {
    expect(box.top).toBe(boxes[0]!.top)
    expect(box.height).toBeGreaterThanOrEqual(52)
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.right).toBeLessThanOrEqual(chrome().getBoundingClientRect().right)
  }
})

test('tab labels are 12 px in English and 13 px in Bangla, the current one in text at weight 600', async () => {
  await open()
  const english = getComputedStyle(tabs()[1]!)
  expect([english.fontSize, english.lineHeight]).toEqual(['12px', '16px'])
  expect([english.color, english.fontWeight]).toEqual(['oklch(0.47 0.008 85)', '500'])
  const current = getComputedStyle(tabs()[0]!)
  expect([current.color, current.fontWeight]).toEqual(['oklch(0.21 0.006 85)', '600'])

  document.documentElement.lang = 'bn'
  await open('', true)
  for (const tab of tabs()) {
    const style = getComputedStyle(tab)
    expect([style.fontSize, style.lineHeight], tab.textContent!).toEqual(['13px', '20px'])
    expect(tab.getBoundingClientRect().height).toBeGreaterThanOrEqual(52)
  }
})

test("the app's own entries stay a strip under the title bar, above the app", async () => {
  await open(`nav=${appNav}`)
  await expect.poll(() => shadow().querySelectorAll('[part="app-nav"] a').length).toBe(2)
  const strip = part('app-nav')!.getBoundingClientRect()
  expect(strip.top).toBeGreaterThanOrEqual(shadow().querySelector('header')!.getBoundingClientRect().bottom)
  expect(strip.bottom).toBeLessThanOrEqual(shadow().querySelector('.frame')!.getBoundingClientRect().top)
  expect(part('app-name')!.getBoundingClientRect().height).toBe(0)
})

test('a toast sits clear above the tab bar', async () => {
  await open('toast=Saved')
  await expect.poll(() => part('toast')).not.toBeNull()
  expect(part('toast')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(tabBar().getBoundingClientRect().top - 8)
})

// The lines a tab's words take, by the top of each. A range gives more than one box per line.
function lines(tab: HTMLElement): number[] {
  const range = document.createRange()
  range.selectNodeContents(tab)
  return [...new Set([...range.getClientRects()].map((box) => box.top))]
}

test("each tab draws its link's icon at 20 px over a one-line label", async () => {
  await open()
  for (const tab of tabs()) {
    const icon = getComputedStyle(tab, '::before')
    expect([icon.width, icon.height, icon.display], tab.textContent!).toEqual(['20px', '20px', 'block'])
    expect(icon.maskImage).toContain('data:image/svg+xml')
    expect(icon.backgroundColor).toBe(getComputedStyle(tab).color)
    const words = lines(tab)
    expect(words, tab.textContent!).toHaveLength(1)
    expect(words[0]!).toBeGreaterThanOrEqual(tab.getBoundingClientRect().top + 20)
    expect(tab.getBoundingClientRect().height).toBe(52)
  }
})

test('a label too long for its tab stays on one line and ends in an ellipsis', async () => {
  await open()
  const tab = tabs()[2]!
  tab.textContent = 'Hang the app for a while'
  const style = getComputedStyle(tab)
  expect([style.whiteSpace, style.overflow, style.textOverflow]).toEqual(['nowrap', 'hidden', 'ellipsis'])
  expect(lines(tab)).toHaveLength(1)
  expect(tab.scrollWidth).toBeGreaterThan(tab.clientWidth)
  expect(tab.getBoundingClientRect().height).toBe(52)
})

test('a link that names no icon, or one the chrome does not know, draws none', async () => {
  await open()
  tabs()[1]!.removeAttribute('data-icon')
  tabs()[2]!.dataset.icon = 'nope'
  for (const tab of tabs().slice(1, 3)) expect(getComputedStyle(tab, '::before').maskImage).toBe('none')
})

const strip = () => part('app-nav')!
const stripLinks = () => [...shadow().querySelectorAll<HTMLAnchorElement>('[part="app-nav"] a')]

// Four entries as the sample app has, the first with an icon and a count, the frame on the first.
async function openStrip(labels = ['Orders', 'Order #1001', 'Order #1039', 'Drafts']): Promise<void> {
  const four = labels.map(entry)
  four[0] = { ...four[0]!, icon: 'shopping-bag', count: 2 } as (typeof four)[0]
  document.body.innerHTML = `<eb-admin-chrome app-name="Sample app"
      src="${fixture}/app.html?title=Orders&nav=${encodeURIComponent(JSON.stringify(four))}">
    <a slot="nav" href="#one" aria-current="page">Home</a>
  </eb-admin-chrome>`
  await expect.poll(() => stripLinks().length, { timeout: 10_000 }).toBe(labels.length)
  await userEvent.click(stripLinks()[1]!)
  await expect.poll(() => stripLinks()[1]!.getAttribute('aria-current')).toBe('page')
}

test("the strip's entries stand 20 px apart, inactive in text-2, the current in text over a 2 px line", async () => {
  await openStrip()
  const boxes = stripLinks().map((link) => link.getBoundingClientRect())
  for (const [index, box] of boxes.slice(1).entries()) {
    if (box.left < strip().getBoundingClientRect().right) expect(box.left - boxes[index]!.right).toBe(20)
  }
  const look = (link: HTMLElement) => {
    const style = getComputedStyle(link)
    return {
      colour: style.color,
      weight: style.fontWeight,
      line: `${style.borderBottomWidth} ${style.borderBottomColor}`,
    }
  }
  expect(look(stripLinks()[0]!)).toEqual({
    colour: 'oklch(0.47 0.008 85)',
    weight: '500',
    line: '2px rgba(0, 0, 0, 0)',
  })
  expect(look(stripLinks()[1]!)).toEqual({
    colour: 'oklch(0.21 0.006 85)',
    weight: '600',
    line: '2px oklch(0.21 0.006 85)',
  })
  // The strip is words only: no icon, though the count stays.
  expect(stripLinks()[0]!.querySelector('svg')!.getBoundingClientRect().width).toBe(0)
  expect(stripLinks()[0]!.querySelector('[part="nav-count"]')!.textContent).toBe('2')
})

test('the strip scrolls sideways, its right edge fading, and its last entry scrolls clear of the fade', async () => {
  await openStrip(['Orders', 'Order #1001', 'Order #1039', 'Drafts', 'Returns', 'Abandoned carts'])
  const style = getComputedStyle(strip())
  expect(style.overflowX).toBe('auto')
  expect(strip().scrollWidth).toBeGreaterThan(strip().clientWidth)
  expect(style.maskImage).toContain('linear-gradient')
  strip().scrollLeft = strip().scrollWidth
  const last = stripLinks().at(-1)!.getBoundingClientRect()
  expect(last.right).toBeLessThanOrEqual(strip().getBoundingClientRect().right - 24)
  expect(last.top).toBe(stripLinks()[0]!.getBoundingClientRect().top)
})

test('at 320 px the strip keeps each entry whole and scrolls rather than squeeze them together', async () => {
  await page.viewport(320, 800)
  try {
    await openStrip()
    for (const link of stripLinks()) expect(link.scrollWidth, link.textContent!).toBeLessThanOrEqual(link.clientWidth)
    const boxes = stripLinks().map((link) => link.getBoundingClientRect())
    for (const [index, box] of boxes.slice(1).entries()) expect(box.left - boxes[index]!.right).toBe(20)
    expect(strip().scrollWidth).toBeGreaterThan(strip().clientWidth)
  } finally {
    await page.viewport(360, 800)
  }
})

test('the strip marks the page the app is on, also when the app moved there by itself', async () => {
  await openStrip()
  const frame = shadow().querySelector<HTMLIFrameElement>('.frame iframe')!
  frame.contentWindow!.location.href = `${fixture}/app.html?title=${encodeURIComponent('Order #1039')}`
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Order #1039')
  await expect
    .poll(() => stripLinks().map((link) => link.getAttribute('aria-current')))
    .toEqual([null, null, 'page', null])
})
