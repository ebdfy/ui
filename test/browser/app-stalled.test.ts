import { afterEach, expect, test, vi } from 'vitest'

import '../../src/host.ts'

const fixture = `http://localhost:${location.port}/test/browser/fixtures`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const part = (name: string) => chrome().shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)
const frame = () => chrome().shadowRoot!.querySelector('iframe')!

async function open(page: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixture}/${page}"><a slot="nav" href="#">Orders</a></eb-admin-chrome>`
  await chrome().updateComplete
}

async function wait(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms)
  await chrome().updateComplete
}

afterEach(() => {
  vi.useRealTimers()
})

test('an app silent for 15 s gets the notice with Reload, inside the chrome', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await open('silent.html')
  await wait(14_999)
  expect(part('notice')).toBeNull()
  expect(part('loading-bar')).not.toBeNull()
  await wait(1)
  const notice = part('notice')!
  expect(notice.getAttribute('role')).toBe('alert')
  expect(notice.querySelector('p')!.textContent).toBe("This app isn't responding")
  const reload = part('reload')!
  expect(reload.textContent!.trim()).toBe('Reload')
  expect(reload.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  expect(part('loading-bar')).toBeNull()
  expect(chrome().shadowRoot!.querySelector('header')!.getBoundingClientRect().height).toBeGreaterThan(0)
  expect(document.querySelector('a[slot="nav"]')!.getBoundingClientRect().height).toBeGreaterThan(0)
})

test('pressing Reload loads the frame again and gives it another 15 s', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await open('silent.html')
  // expect.poll would move the fake clock, so the loads are awaited as events.
  const nextLoad = () => new Promise((resolve) => frame().addEventListener('load', resolve, { once: true }))
  await nextLoad()
  await wait(15_000)
  const reloaded = nextLoad()
  part('reload')!.click()
  await chrome().updateComplete
  expect(part('notice')).toBeNull()
  expect(part('loading-bar')).not.toBeNull()
  await reloaded
  await wait(14_999)
  expect(part('notice')).toBeNull()
  await wait(1)
  expect(part('notice')).not.toBeNull()
})

test('an app that answers at 14 s never shows the notice', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await open('silent.html')
  await wait(14_000)
  // The frame moves on by itself to a page that answers; the chrome's clock is not restarted.
  const titled = new Promise<void>((resolve) => {
    const listen = (event: MessageEvent) => {
      if (event.data?.type !== 'title') return
      window.removeEventListener('message', listen)
      resolve()
    }
    window.addEventListener('message', listen)
  })
  frame().src = `${fixture}/app.html?title=Orders`
  await titled
  await chrome().updateComplete
  expect(part('title')!.textContent).toBe('Orders')
  await wait(60_000)
  expect(part('notice')).toBeNull()
  expect(part('loading-bar')).toBeNull()
})

test('an app that refuses to be framed gets the notice by 15 s', async () => {
  await open('refused.html')
  // Framed, the page would answer at once; refused, it never does.
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  expect(part('title')!.textContent).toBe('')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await open('refused.html')
  await wait(15_000)
  expect(part('notice')!.textContent).toContain("This app isn't responding")
})
