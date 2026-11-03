// Under 600 px the Admin's nav is a tab bar along the bottom of the chrome, as on a phone.
import { afterEach, expect, test } from 'vitest'

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
  const [first, ...rest] = labels
  document.body.innerHTML = `<eb-admin-chrome app-name="Sample app" src="${fixture}/app.html?title=Orders&${query}">
    <a slot="nav" href="#one" aria-current="page">${first}</a>
    ${rest
      .slice(0, 3)
      .map((label, index) => `<a slot="nav" href="#${index}">${label}</a>`)
      .join('')}
    <button slot="nav" type="button">${rest[3]}</button>
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
