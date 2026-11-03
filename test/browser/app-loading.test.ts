import { expect, test } from 'vitest'

import '../../src/host.ts'

const fixture = `http://localhost:${location.port}/test/browser/fixtures`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const part = (name: string) => chrome().shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)

async function open(page: string): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome src="${fixture}/${page}"></eb-admin-chrome>`
  await chrome().updateComplete
}

test('the loading bar shows while the app loads, and goes once the app answers', async () => {
  await open('app.html?title=Orders')
  const bar = part('loading-bar')!
  expect(bar.getAttribute('role')).toBe('progressbar')
  expect(bar.getAttribute('aria-label')).toBe('Loading')
  expect(bar.getBoundingClientRect().height).toBeGreaterThan(0)
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Orders')
  expect(part('loading-bar')).toBeNull()
})

test('an app that has not answered keeps the loading bar, over the frame', async () => {
  await open('silent.html')
  await new Promise((resolve) => setTimeout(resolve, 500))
  const bar = part('loading-bar')!.getBoundingClientRect()
  const frame = chrome().shadowRoot!.querySelector('iframe')!.getBoundingClientRect()
  expect(bar.top).toBe(frame.top)
  expect(bar.width).toBe(frame.width)
})

test('ebdfy.loading(true) shows the loading bar and ebdfy.loading(false) hides it', async () => {
  await open('app.html?title=Orders&loading')
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Orders')
  await expect.poll(() => part('loading-bar')).not.toBeNull()
  await new Promise((resolve) => setTimeout(resolve, 500))
  expect(part('loading-bar')).not.toBeNull()

  await open('app.html?title=Orders&loading=done')
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Orders')
  await expect.poll(() => part('loading-bar')).toBeNull()
})

test('a page the app moves to by itself starts with the loading bar down', async () => {
  await open('app.html?title=Orders&loading')
  await expect.poll(() => part('loading-bar'), { timeout: 10_000 }).not.toBeNull()
  await expect.poll(() => part('title')?.textContent).toBe('Orders')
  chrome().shadowRoot!.querySelector('iframe')!.contentWindow!.location.href = `${fixture}/app.html?title=Next`
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Next')
  await expect.poll(() => part('loading-bar')).toBeNull()
})
