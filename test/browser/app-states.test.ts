// The two states that take the app's place, stalled and access ended, in Ink: an icon, one line
// that says what happened and one that says what to do, a primary and a secondary button.
import { afterEach, expect, test, vi } from 'vitest'

import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const frame = () => shadow().querySelector<HTMLIFrameElement>('.frame iframe')
const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

afterEach(() => {
  vi.useRealTimers()
})

// What a state shows: its icon's size, its two lines, and each button's fill and words.
function look(state: HTMLElement) {
  const icon = state.querySelector('svg')!.getBoundingClientRect()
  const [heading, help] = [...state.querySelectorAll('p')]
  return {
    icon: [icon.width, icon.height],
    heading: heading!.textContent,
    help: [help!.textContent, getComputedStyle(help!).color],
    buttons: [...state.querySelectorAll<HTMLElement>('a, button')].map((button) => [
      button.textContent!.trim(),
      getComputedStyle(button).backgroundColor,
    ]),
  }
}

async function stall(): Promise<void> {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/silent.html"></eb-admin-chrome>`
  await chrome().updateComplete
  vi.advanceTimersByTime(15_000)
  await chrome().updateComplete
}

test("an app that isn't responding shows a 20 px warning, what to do in text-2, and Reload as the primary", async () => {
  await stall()
  expect(look(part('notice')!)).toEqual({
    icon: [20, 20],
    heading: "This app isn't responding",
    help: ["It hasn't answered for 15 seconds. Reload it, or keep waiting.", token('--eb-color-text-2')],
    buttons: [
      ['Reload', token('--eb-color-primary')],
      ['Keep waiting', token('--eb-color-surface')],
    ],
  })
  expect(token('--eb-color-primary')).not.toBe(token('--eb-color-accent'))
})

test('pressing Keep waiting puts the skeleton back and gives the app another 15 s, without loading it again', async () => {
  await stall()
  const src = frame()!.src
  part('keep-waiting')!.click()
  await chrome().updateComplete
  expect(part('notice')).toBeNull()
  expect(part('skeleton')).not.toBeNull()
  vi.advanceTimersByTime(14_999)
  await chrome().updateComplete
  expect(part('notice')).toBeNull()
  vi.advanceTimersByTime(1)
  await chrome().updateComplete
  expect(part('notice')).not.toBeNull()
  expect(frame()!.src).toBe(src)
})

async function endAccess(query = ''): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome
    src="${appOrigin}/test/browser/fixtures/token.html?store=demo${query}"
    token-url="/dev/id-token?app=sample&ended"
    api-url="${appOrigin}/dev/graphql"
    stores-url="/stores"
  ></eb-admin-chrome>`
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Token')
  frame()!.contentWindow!.postMessage({ ask: 'token' }, appOrigin)
  await expect.poll(() => part('access-ended')).not.toBeNull()
}

test('access that has ended shows a 20 px lock, what to do in text-2, Choose a store as the primary, and no stale title', async () => {
  await endAccess()
  expect(look(part('access-ended')!)).toEqual({
    icon: [20, 20],
    heading: 'You no longer have access to this store',
    help: ["Ask the store's owner to add you again, or choose another store.", token('--eb-color-text-2')],
    buttons: [
      ['Choose a store', token('--eb-color-primary')],
      ['Try again', token('--eb-color-surface')],
    ],
  })
  expect(part('title')!.textContent).toBe('')
})

test('pressing Try again loads the app afresh, which asks for a token again', async () => {
  await endAccess()
  part('try-again')!.click()
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Token')
  expect(part('access-ended')).toBeNull()
})

test("on a phone, ended access brings back the tab bar the app's bottom bar hid, and the app's nav goes", async () => {
  const nav = encodeURIComponent(JSON.stringify([{ label: 'Orders', path: '/test/browser/fixtures/token.html' }]))
  document.body.innerHTML = `<eb-admin-chrome
    src="${appOrigin}/test/browser/fixtures/token.html?store=demo&bottom-bar&nav=${nav}"
    token-url="/dev/id-token?app=sample&ended"
    api-url="${appOrigin}/dev/graphql"
  ><a slot="nav" href="#home">Home</a></eb-admin-chrome>`
  const tabBar = () => shadow().querySelector('nav:not([part])')!.getBoundingClientRect().height
  await expect.poll(() => part('app-nav'), { timeout: 10_000 }).not.toBeNull()
  await expect.poll(tabBar).toBe(0)
  frame()!.contentWindow!.postMessage({ ask: 'token' }, appOrigin)
  await expect.poll(() => part('access-ended')).not.toBeNull()
  expect(tabBar()).toBeGreaterThan(0)
  expect(part('app-nav')).toBeNull()
})
