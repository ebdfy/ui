import { afterEach, expect, test } from 'vitest'

import '../../src/host.ts'

const appOrigin = `http://localhost:${location.port}`

function chrome(): HTMLElement & { updateComplete: Promise<unknown> } {
  return document.querySelector('eb-admin-chrome')!
}
const shadow = () => chrome().shadowRoot!
const part = (name: string) => shadow().querySelector<HTMLElement>(`[part="${name}"]`)
const frame = () => shadow().querySelector<HTMLIFrameElement>('.frame iframe')

// With &ended the staff member's access has ended, so the token endpoint refuses the next mint.
async function open(tokenUrl = '/dev/id-token?app=sample&ended'): Promise<void> {
  document.body.innerHTML = `<eb-admin-chrome
    src="${appOrigin}/test/browser/fixtures/token.html?store=demo"
    token-url="${tokenUrl}"
    api-url="${appOrigin}/dev/graphql"
    stores-url="/stores"
  ></eb-admin-chrome>`
  await chrome().updateComplete
  await expect.poll(() => shadow().querySelector('[part="title"]')?.textContent, { timeout: 10_000 }).toBe('Token')
}

afterEach(() => {
  document.documentElement.lang = 'en'
})

function told(): Promise<{ error?: string }> {
  return new Promise((resolve) => {
    const listen = (event: MessageEvent) => {
      if (event.data?.type !== 'fixture') return
      window.removeEventListener('message', listen)
      resolve(event.data)
    }
    window.addEventListener('message', listen)
  })
}

test('a refused ID token shows the notice with a link to choose a store, and the frame goes', async () => {
  await open()
  frame()!.contentWindow!.postMessage({ ask: 'token' }, appOrigin)
  await expect.poll(() => part('access-ended')).not.toBeNull()
  const notice = part('access-ended')!
  expect(notice.getAttribute('role')).toBe('alert')
  expect(notice.querySelector('p')!.textContent).toBe('You no longer have access to this store')
  const link = part('choose-store') as HTMLAnchorElement
  expect(link.textContent!.trim()).toBe('Choose a store')
  expect(link.getAttribute('href')).toBe('/stores')
  expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  expect(frame()).toBeNull()
  expect(part('loading-bar')).toBeNull()
})

test('the notice is in Bangla on a Bangla Admin', async () => {
  document.documentElement.lang = 'bn'
  await open()
  frame()!.contentWindow!.postMessage({ ask: '{ shop { name } }' }, appOrigin)
  await expect.poll(() => part('access-ended')).not.toBeNull()
  expect(part('access-ended')!.querySelector('p')!.textContent).toBe('এই স্টোরে আপনার আর অ্যাক্সেস নেই')
  expect(part('choose-store')!.textContent!.trim()).toBe('একটি স্টোর বেছে নিন')
})

test('a mint that fails for another reason rejects the call in the app, which stays', async () => {
  await open('/dev/id-token?app=nope')
  const answer = told()
  frame()!.contentWindow!.postMessage({ ask: 'token' }, appOrigin)
  expect((await answer).error).toBe('ebdfy: no ID token: HTTP 404')
  expect(part('access-ended')).toBeNull()
  expect(frame()).not.toBeNull()
})
