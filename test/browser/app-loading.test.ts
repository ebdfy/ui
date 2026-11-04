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

const frame = () => chrome().shadowRoot!.querySelector<HTMLIFrameElement>('.frame iframe')!

test('while the app loads, skeleton blocks stand in the app area and the frame stays hidden until it is ready', async () => {
  await open('app.html?title=Orders')
  const skeleton = part('skeleton')!
  expect(skeleton.getAttribute('role')).toBe('progressbar')
  expect(skeleton.getAttribute('aria-label')).toBe('Loading')
  expect(skeleton.querySelectorAll('eb-skeleton').length).toBeGreaterThanOrEqual(2)
  const area = chrome().shadowRoot!.querySelector('.frame')!.getBoundingClientRect()
  const box = skeleton.getBoundingClientRect()
  expect([box.top, box.left, box.width, box.height]).toEqual([area.top, area.left, area.width, area.height])
  expect(getComputedStyle(frame()).visibility).toBe('hidden')
  expect(part('loading-bar')).toBeNull()
  await expect.poll(() => part('title')?.textContent, { timeout: 10_000 }).toBe('Orders')
  expect(part('skeleton')).toBeNull()
  expect(getComputedStyle(frame()).visibility).toBe('visible')
})

test('a page that never loads the bridge stays hidden behind the skeleton, its own words unseen', async () => {
  await open('silent.html')
  await new Promise((resolve) => frame().addEventListener('load', resolve, { once: true }))
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(part('skeleton')).not.toBeNull()
  expect(getComputedStyle(frame()).visibility).toBe('hidden')
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
