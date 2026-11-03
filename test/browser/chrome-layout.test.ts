// The Admin chrome in Ink: a sidebar of nav rows on a desktop, and the title bar above the app.
import { afterEach, beforeEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

import '../../src/host.ts'
import { inDark } from './colour.ts'

const appOrigin = `http://localhost:${location.port}`
const fixture = `${appOrigin}/test/browser/fixtures`
const entry = (label: string) => ({ label, path: `/test/browser/fixtures/app.html?title=${encodeURIComponent(label)}` })
const appNav = encodeURIComponent(JSON.stringify([entry('Orders'), entry('Drafts')]))
const actions = encodeURIComponent(JSON.stringify(['Book courier', 'Print']))

const chromeColour = { light: 'oklch(0.972 0.003 85)', dark: 'oklch(0.18 0.004 85)' }
const activeColour = { light: 'oklch(0.935 0.004 85)', dark: 'oklch(0.25 0.005 85)' }
const ring = '2px solid oklch(0.52 0.19 268) 2px'

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const appLinks = () => [...shadow().querySelectorAll<HTMLAnchorElement>('[part="app-nav"] a')]
const titleActions = () => [...shadow().querySelectorAll<HTMLButtonElement>('[part="title-action"]')]

// The playground's own entries: four links, the current one marked, and its theme switch.
async function open(): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome app-name="Sample app"
      src="${fixture}/app.html?title=Orders&actions=${actions}&nav=${appNav}">
    <a slot="nav" href="#sample" aria-current="page">Sample app</a>
    <a slot="nav" href="#docs">Docs</a>
    <a slot="nav" href="#hang">Hang the app</a>
    <a slot="nav" href="#ended">End access</a>
    <button slot="nav" type="button">Dark theme</button>
  </eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => appLinks().length, { timeout: 10_000 }).toBe(2)
  await expect.poll(() => titleActions().length).toBe(2)
}

// The element with focus, inside any shadow roots.
function deepest(): Element | null {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element
}

function look(element: Element) {
  const style = getComputedStyle(element)
  return { background: style.backgroundColor, colour: style.color, weight: style.fontWeight }
}

beforeEach(async () => {
  await page.viewport(1280, 800)
})

afterEach(async () => {
  await page.viewport(360, 800)
})

test('at 1280 px the nav is a sidebar on the chrome surface, left of the title bar and the app', async () => {
  await open()
  const sidebar = part('sidebar')!
  const box = sidebar.getBoundingClientRect()
  const host = chrome().getBoundingClientRect()
  expect(box.left).toBe(host.left)
  expect(box.width).toBe(236)
  expect(box.height).toBe(host.height)
  expect(shadow().querySelector('header')!.getBoundingClientRect().left).toBe(host.left + 236)
  expect(shadow().querySelector('.frame')!.getBoundingClientRect().left).toBe(host.left + 236)
  expect(getComputedStyle(sidebar).backgroundColor).toBe(chromeColour.light)
  expect(await inDark(async () => getComputedStyle(sidebar).backgroundColor)).toBe(chromeColour.dark)
})

test("every sidebar row is 36 px tall, the page's and the app's, and the theme switch too", async () => {
  await open()
  const rows = [...document.querySelectorAll('[slot="nav"]'), ...appLinks()]
  expect(rows).toHaveLength(7)
  for (const row of rows) expect(row.getBoundingClientRect().height, row.textContent!).toBe(36)
})

test('the current entry has the chrome-active background and weight 600, the others neither', async () => {
  await open()
  const current = document.querySelector('a[aria-current="page"]')!
  const other = document.querySelector('a[href="#docs"]')!
  expect(look(current)).toEqual({ background: activeColour.light, colour: 'oklch(0.21 0.006 85)', weight: '600' })
  expect(look(other)).toEqual({ background: 'rgba(0, 0, 0, 0)', colour: 'oklch(0.47 0.008 85)', weight: '500' })
  const dark = await inDark(async () => look(current))
  expect(dark).toEqual({ background: activeColour.dark, colour: 'oklch(0.955 0.003 85)', weight: '600' })
})

test("the app's current page in the sidebar has the chrome-active background and weight 600", async () => {
  await open()
  const [orders, drafts] = appLinks()
  await userEvent.click(drafts!)
  await expect.poll(() => drafts!.getAttribute('aria-current')).toBe('page')
  expect(look(drafts!)).toMatchObject({ background: activeColour.light, weight: '600' })
  expect(look(orders!)).toMatchObject({ background: 'rgba(0, 0, 0, 0)', weight: '500' })
})

test("the app's entries sit under its name in the sidebar", async () => {
  await open()
  const name = part('app-name')!
  expect(name.textContent).toBe('Sample app')
  const style = getComputedStyle(name)
  expect([style.fontSize, style.lineHeight, style.fontWeight]).toEqual(['12px', '16px', '600'])
  expect(appLinks()[0]!.getBoundingClientRect().top).toBeGreaterThan(name.getBoundingClientRect().bottom - 1)
})

test('the title bar sits on the ground with a divider, the title at 17/24, and both actions Ink buttons', async () => {
  await open()
  const header = shadow().querySelector('header')!
  const bar = getComputedStyle(header)
  expect(bar.backgroundColor).toBe('oklch(0.985 0.002 85)')
  expect(bar.boxShadow).toBe('oklch(0.925 0.004 85) 0px -1px 0px 0px inset')
  expect(header.getBoundingClientRect().height).toBe(56)
  const title = getComputedStyle(part('title')!)
  expect([title.fontSize, title.lineHeight, title.fontWeight]).toEqual(['17px', '24px', '600'])
  for (const button of titleActions()) {
    const style = getComputedStyle(button)
    expect(button.getBoundingClientRect().height).toBe(36)
    expect(style.backgroundColor).toBe('oklch(1 0 0)')
    expect(style.boxShadow).toContain('oklch(0.87 0.005 85) 0px 0px 0px 1px inset')
    expect(style.borderRadius).toBe('8px')
  }
})

test('the Tab key reaches every chrome control in turn and each shows the focus ring', async () => {
  await open()
  // The title bar comes first, as it does in the page, then the sidebar.
  const controls: Element[] = [...titleActions(), ...document.querySelectorAll('[slot="nav"]'), ...appLinks()]
  // A button ahead of the chrome, as the browser's own toolbar is ahead of a page.
  const before = document.createElement('button')
  before.textContent = 'Before'
  document.body.prepend(before)
  before.focus()
  for (const control of controls) {
    await userEvent.tab()
    expect(deepest(), control.textContent!).toBe(control)
    const style = getComputedStyle(control)
    expect(`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor} ${style.outlineOffset}`).toBe(ring)
  }
})
