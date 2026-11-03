import { expect, test, vi } from 'vitest'

import { createBridge } from '../../src/bridge.ts'
import '../../src/host.ts'

// The test page is on 127.0.0.1 and the app on localhost, two origins, as in the Admin.
const appOrigin = `http://localhost:${location.port}`
const fixture = `${appOrigin}/test/browser/fixtures`

interface Entry {
  label: string
  path: string
}
const entry = (label: string, title = label): Entry => ({
  label,
  path: `/test/browser/fixtures/app.html?title=${encodeURIComponent(title)}`,
})
const three = [entry('Orders'), entry('Order #1001'), entry('Drafts')]

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const part = (name: string) => chrome().shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)
const links = () => [...chrome().shadowRoot!.querySelectorAll<HTMLAnchorElement>('[part="app-nav"] a')]
const labels = () => links().map((a) => a.textContent!.trim())
const frame = () => chrome().shadowRoot!.querySelector('iframe')!

async function open(page: string, ...navs: Entry[][]): Promise<void> {
  const query = navs.map((nav) => `nav=${encodeURIComponent(JSON.stringify(nav))}`).join('&')
  document.body.innerHTML = `<eb-admin-chrome app-name="Sample app" src="${fixture}/${page}?${query}">
    <a slot="nav" href="#apps">Sample app</a>
  </eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(labels, { timeout: 10_000 }).not.toEqual([])
}

test("the app's 3 entries show in a nav named for it, between the title bar and the app", async () => {
  await open('app.html', three)
  expect(labels()).toEqual(['Orders', 'Order #1001', 'Drafts'])
  const nav = part('app-nav')!
  expect(nav.localName).toBe('nav')
  expect(nav.getAttribute('aria-label')).toBe('Sample app')
  // On a phone the admin's own nav is the tab bar along the bottom, so the app's strip is on top.
  const header = chrome().shadowRoot!.querySelector('header')!
  expect(nav.getBoundingClientRect().top).toBeGreaterThanOrEqual(header.getBoundingClientRect().bottom)
  expect(nav.getBoundingClientRect().bottom).toBeLessThanOrEqual(frame().getBoundingClientRect().top)
  for (const link of links()) expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
})

test('nav sent twice with the same 3 entries still shows 3', async () => {
  await open('app.html', three, three)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(labels()).toEqual(['Orders', 'Order #1001', 'Drafts'])
})

test('a 9th entry is dropped and the app is warned', async () => {
  const nine = Array.from({ length: 9 }, (_, i) => entry(`Page ${i + 1}`))
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  createBridge(window).nav(nine)
  expect(warn).toHaveBeenCalledWith('ebdfy: at most 8 nav entries')
  warn.mockRestore()
  await open('app.html', nine)
  expect(labels()).toEqual(nine.slice(0, 8).map((e) => e.label))
})

test('a 25-letter label shows cut to 24 with an ellipsis', async () => {
  await open('app.html', [entry('A'.repeat(24)), entry('B'.repeat(25))])
  expect(labels()).toEqual(['A'.repeat(24), `${'B'.repeat(23)}…`])
})

test("tapping an entry loads its path in the app's frame and marks it current", async () => {
  await open('app.html', three)
  links()[2]!.click()
  await chrome().updateComplete
  expect(frame().src).toBe(`${appOrigin}${three[2]!.path}`)
  expect(links().map((a) => a.getAttribute('aria-current'))).toEqual([null, null, 'page'])
  await expect.poll(() => part('title')?.textContent).toBe('Drafts')
})

test('an entry whose path leaves the app is dropped', async () => {
  await open('app.html', [
    { label: 'Elsewhere', path: 'https://evil.example/' },
    { label: 'Protocol', path: '//evil.example/' },
    { label: 'Script', path: 'javascript:alert(1)' },
    entry('Orders'),
  ])
  expect(labels()).toEqual(['Orders'])
})

test('tapping an entry while the save bar is up asks first, and Leave loads it', async () => {
  await open('form.html', three)
  await expect.poll(() => part('save-bar')).not.toBeNull()
  const before = frame().src
  links()[1]!.click()
  await chrome().updateComplete
  expect(chrome().shadowRoot!.querySelector('dialog')!.open).toBe(true)
  expect(frame().src).toBe(before)
  part('leave')!.click()
  await chrome().updateComplete
  expect(frame().src).toBe(`${appOrigin}${three[1]!.path}`)
})

test('an entry with no words in its label is dropped, so no empty link shows', async () => {
  await open('app.html', [entry(''), entry('   '), entry('Orders')])
  expect(labels()).toEqual(['Orders'])
})

test('leaving for the page already showing loads it again, so the edits go with the bar', async () => {
  await open('form.html', [{ label: 'Order', path: '/test/browser/fixtures/form.html' }])
  await expect.poll(() => part('save-bar')).not.toBeNull()
  let loads = 0
  frame().addEventListener('load', () => (loads += 1))
  links()[0]!.click()
  await chrome().updateComplete
  expect(chrome().shadowRoot!.querySelector('dialog')!.open).toBe(true)
  part('leave')!.click()
  await expect.poll(() => loads).toBe(1)
  // The fresh page makes its edit again, so the bar is back for it.
  await expect.poll(() => part('save-bar')).not.toBeNull()
})
