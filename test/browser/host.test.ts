import { expect, test, vi } from 'vitest'
import { userEvent } from 'vitest/browser'

import '../../src/host.ts'

// The test page is on 127.0.0.1 and the app on localhost, so the two are different origins, as
// ui.ebdfy.com and sample-app.ebdfy.com are.
const appOrigin = `http://localhost:${location.port}`
const appUrl = (title: string) =>
  `${appOrigin}/test/browser/fixtures/app.html?store=demo&title=${encodeURIComponent(title)}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}

function barText(): string {
  return chrome().shadowRoot!.querySelector('[part="title"]')!.textContent!
}

async function open(title: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${appUrl(title)}"><a slot="nav" href="#">Orders</a></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(barText, { timeout: 10_000 }).not.toBe('')
}

test('the bar shows the title the framed app sets, on the ground', async () => {
  expect(appOrigin).not.toBe(location.origin)
  await open('Orders')
  expect(barText()).toBe('Orders')
  const bar = chrome().shadowRoot!.querySelector('header')!
  expect(getComputedStyle(bar).backgroundColor).toBe('oklch(0.985 0.002 85)')
  expect(getComputedStyle(bar).color).toBe('oklch(0.21 0.006 85)')
  expect(chrome().shadowRoot!.querySelector('iframe')!.src).toBe(appUrl('Orders'))
})

test('a title from another origin or another window leaves the bar as it was', async () => {
  await open('Orders')
  // Same origin as the app, but a different window.
  const stranger = document.createElement('iframe')
  stranger.src = appUrl('Hacked by a sibling')
  const loaded = new Promise((resolve) => stranger.addEventListener('load', resolve))
  document.body.append(stranger)
  await loaded
  // The right message shape from the host's own origin.
  window.postMessage({ type: 'title', payload: { title: 'Hacked by the page' } }, location.origin)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(barText()).toBe('Orders')
})

test("a title from the app's frame after it navigates to another origin is ignored", async () => {
  await open('Orders')
  const frame = chrome().shadowRoot!.querySelector('iframe')!
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  frame.src = `${location.origin}/test/browser/fixtures/app.html?title=Hacked`
  await loaded
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(barText()).toBe('Orders')
})

test('a 60-character title shows whole and a 61-character one is cut with an ellipsis', async () => {
  const sixty = 'A'.repeat(60)
  await open(sixty)
  expect(barText()).toBe(sixty)
  await open(`${sixty}B`)
  expect(barText()).toBe(`${'A'.repeat(59)}…`)
})

test('a long Bangla title is cut between letters, never inside a conjunct', async () => {
  // ক্ষ is one letter of three code points: ক, the hasanta and ষ.
  const title = `${'ক'.repeat(58)}ক্ষকক`
  await open(title)
  expect(barText()).toBe(`${'ক'.repeat(58)}ক্ষ…`)
})

const formUrl = `${appOrigin}/test/browser/fixtures/form.html`

function part(name: string): HTMLElement | null {
  return chrome().shadowRoot!.querySelector(`[part="${name}"]`)
}

async function openForm(): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${formUrl}"><a slot="nav" href="#customers">Customers</a></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => part('save-bar'), { timeout: 10_000 }).not.toBeNull()
}

test("the app's edit raises the save bar in place of the title, with Discard and Save", async () => {
  await openForm()
  expect(part('save-bar')!.textContent).toContain('Unsaved changes')
  expect(part('discard')!.textContent!.trim()).toBe('Discard')
  expect(part('save')!.textContent!.trim()).toBe('Save')
  expect(part('title')).toBeNull()
  for (const button of [part('discard')!, part('save')!]) {
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }
})

test('pressing Discard reaches the app, which puts the field back and lowers the bar', async () => {
  await openForm()
  part('discard')!.click()
  await expect.poll(() => part('save-bar')).toBeNull()
  expect(barText()).toBe('Order')
})

test('pressing Save reaches the app, which submits the form once and lowers the bar', async () => {
  await openForm()
  part('save')!.click()
  part('save')?.click()
  await expect.poll(barText).toBe('Saved: Leave at the gate')
  expect(part('save-bar')).toBeNull()
})

test('a save bar message from another window leaves the bar down', async () => {
  await open('Orders')
  window.postMessage({ type: 'saveBar', payload: { visible: true } }, location.origin)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(part('save-bar')).toBeNull()
})

test('an app that navigates away while its bar is up takes the bar down', async () => {
  await openForm()
  const frame = chrome().shadowRoot!.querySelector('iframe')!
  frame.src = appUrl('Next page')
  await expect.poll(barText).toBe('Next page')
  expect(part('save-bar')).toBeNull()
})

const dialog = () => chrome().shadowRoot!.querySelector('dialog')!
const navLink = () => document.querySelector<HTMLAnchorElement>('a[slot="nav"]')!

test('leaving through the navigation while the bar is up asks first, and Stay stays', async () => {
  history.replaceState(null, '', location.pathname + location.search)
  await openForm()
  navLink().click()
  await chrome().updateComplete
  expect(dialog().open).toBe(true)
  expect(dialog().textContent).toContain('Leave without saving?')
  const buttons = [...dialog().querySelectorAll('button')]
  expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Leave', 'Stay'])
  for (const button of buttons) expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  expect(location.hash).toBe('')
  part('stay')!.click()
  expect(dialog().open).toBe(false)
  expect(location.hash).toBe('')
  expect(part('save-bar')).not.toBeNull()
})

test('pressing Leave in the confirm goes where the link points', async () => {
  history.replaceState(null, '', location.pathname + location.search)
  await openForm()
  navLink().click()
  await chrome().updateComplete
  part('leave')!.click()
  expect(location.hash).toBe('#customers')
  history.replaceState(null, '', location.pathname + location.search)
})

test('with the bar down a navigation link just goes', async () => {
  history.replaceState(null, '', location.pathname + location.search)
  document.body.innerHTML = `<eb-admin-chrome src="${appUrl('Orders')}"><a slot="nav" href="#customers">Customers</a></eb-admin-chrome>`
  await chrome().updateComplete
  navLink().click()
  expect(location.hash).toBe('#customers')
  expect(dialog().open).toBe(false)
  history.replaceState(null, '', location.pathname + location.search)
})

// The app's next message of a type. Listened for after the chrome connects, so the chrome's own
// listener has taken the message first; a poll would move a test's fake clock.
function nextMessage(type: string): Promise<void> {
  return new Promise((resolve) => {
    const listen = (event: MessageEvent) => {
      if (event.data?.type !== type) return
      window.removeEventListener('message', listen)
      resolve()
    }
    window.addEventListener('message', listen)
  })
}

async function openToasts(query: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${appOrigin}/test/browser/fixtures/app.html?${query}"></eb-admin-chrome>`
  await chrome().updateComplete
  await nextMessage('toast')
  await chrome().updateComplete
}

const toastText = () => part('toast')!.querySelector('span')!.textContent

test('a toast shows for 5 s and then goes', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await openToasts('toast=Saved')
    expect(toastText()).toBe('Saved')
    expect(part('toast')!.getAttribute('role')).toBe('status')
    vi.advanceTimersByTime(4_900)
    await chrome().updateComplete
    expect(part('toast')).not.toBeNull()
    vi.advanceTimersByTime(100)
    await chrome().updateComplete
    expect(part('toast')).toBeNull()
  } finally {
    vi.useRealTimers()
  }
})

test('one toast shows at a time, the newest', async () => {
  await openToasts('toast=Saved&toast=Order+sent+to+Pathao')
  await expect.poll(toastText).toBe('Order sent to Pathao')
  expect(chrome().shadowRoot!.querySelectorAll('[part="toast"]')).toHaveLength(1)
})

test('a toast of 120 letters shows whole and one of 121 is cut to 120', async () => {
  await openToasts(`toast=${'A'.repeat(120)}`)
  expect(toastText()).toBe('A'.repeat(120))
  await openToasts(`toast=${'A'.repeat(121)}`)
  expect(toastText()).toBe(`${'A'.repeat(119)}…`)
})

test('an error toast stays until it is dismissed', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  try {
    await openToasts('toast=Pathao+did+not+answer&error')
    expect(part('toast')!.getAttribute('role')).toBe('alert')
    vi.advanceTimersByTime(60_000)
    await chrome().updateComplete
    expect(toastText()).toBe('Pathao did not answer')
  } finally {
    vi.useRealTimers()
  }
  const dismiss = part('dismiss')!
  expect(dismiss.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  dismiss.click()
  await chrome().updateComplete
  expect(part('toast')).toBeNull()
})

test('a short navigation label is still a 44 px target', async () => {
  document.body.innerHTML = `<eb-admin-chrome src="${appUrl('Orders')}"><a slot="nav" href="#">Docs</a></eb-admin-chrome>`
  await chrome().updateComplete
  const link = document.querySelector('a[slot="nav"]')!.getBoundingClientRect()
  expect(link.width).toBeGreaterThanOrEqual(44)
  expect(link.height).toBeGreaterThanOrEqual(44)
})

test('a nav link the page slots in shows the Ink focus ring on keyboard focus', async () => {
  await open('Orders')
  const link = document.querySelector<HTMLAnchorElement>('a[slot="nav"]')!
  link.focus()
  await userEvent.tab({ shift: true })
  await userEvent.tab()
  expect(document.activeElement).toBe(link)
  const style = getComputedStyle(link)
  expect(`${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor} ${style.outlineOffset}`).toBe(
    '2px solid oklch(0.52 0.19 268) 2px',
  )
})
