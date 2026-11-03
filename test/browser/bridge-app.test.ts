import { expect, test } from 'vitest'

import { adminRedirect, allowedParent, parentOrigin } from '../../src/bridge.ts'

test('only the Admin and the playground are parents in a production build', () => {
  expect(allowedParent('https://admin.ebdfy.com', false)).toBe(true)
  expect(allowedParent('https://ui.ebdfy.com', false)).toBe(true)
  for (const origin of [
    'http://admin.ebdfy.com',
    'https://admin.ebdfy.com.evil.example',
    'https://evil.example',
    'http://localhost:5173',
    'null',
  ]) {
    expect(allowedParent(origin, false), origin).toBe(false)
  }
})

test('a development build also takes a playground on localhost', () => {
  expect(allowedParent('http://localhost:5173', true)).toBe(true)
  expect(allowedParent('http://127.0.0.1:5173', true)).toBe(true)
  expect(allowedParent('http://localhost.evil.example:5173', true)).toBe(false)
})

function frameIn(ancestor: string, referrer = ''): Window {
  const top = {} as Window
  return {
    parent: top,
    top,
    location: { ancestorOrigins: [ancestor], search: '' },
    document: { referrer },
  } as unknown as Window
}

test('the parent origin comes from the frame ancestors, and an unknown one leaves the bridge off', () => {
  expect(parentOrigin(frameIn('https://admin.ebdfy.com'), false)).toBe('https://admin.ebdfy.com')
  expect(parentOrigin(frameIn('https://evil.example', 'https://admin.ebdfy.com/'), false)).toBeNull()
})

test('a page that is not in a frame has no parent', () => {
  expect(parentOrigin(window.top!, false)).toBeNull()
})

function topLevel(search: string, app: string | null): Window {
  const win = { location: { search }, document: document.implementation.createHTMLDocument() } as unknown as Window
  ;(win as { top: Window }).top = win
  if (app) win.document.head.innerHTML = `<meta name="ebdfy-app" content="${app}">`
  return win
}

test('a top-level load with a store goes back into the Admin', () => {
  expect(adminRedirect(topLevel('?store=demo', 'sample'))).toBe('https://admin.ebdfy.com/store/demo/apps/sample')
  expect(adminRedirect(topLevel('?store=a%2F..%2Fb&x=1', 'sample'))).toBe(
    'https://admin.ebdfy.com/store/a%2F..%2Fb/apps/sample',
  )
})

test('a top-level load without a store stays on the app page', () => {
  expect(adminRedirect(topLevel('', 'sample'))).toBeNull()
  expect(adminRedirect(topLevel('?other=1', 'sample'))).toBeNull()
})

test('a framed load never redirects', () => {
  const win = topLevel('?store=demo', 'sample')
  ;(win as { top: Window }).top = {} as Window
  expect(adminRedirect(win)).toBeNull()
})

test('ebdfy.title posts the title to the parent, from the app origin', async () => {
  const message = new Promise<MessageEvent>((resolve) => {
    const titled = (event: MessageEvent) => {
      if (event.data?.type !== 'title') return
      window.removeEventListener('message', titled)
      resolve(event)
    }
    window.addEventListener('message', titled)
  })
  const frame = document.createElement('iframe')
  frame.src = '/test/browser/fixtures/app.html'
  document.body.append(frame)
  const event = await message
  expect(event.source).toBe(frame.contentWindow)
  expect(event.origin).toBe(location.origin)
  expect(event.data).toEqual({ type: 'title', payload: { title: 'Orders', actions: [], call: 1 } })
  frame.remove()
})

test('a framed app first tells the Admin its save bar is down', async () => {
  const message = new Promise<MessageEvent>((resolve) => window.addEventListener('message', resolve, { once: true }))
  const frame = document.createElement('iframe')
  frame.src = '/test/browser/fixtures/app.html'
  document.body.append(frame)
  expect((await message).data).toEqual({ type: 'saveBar', payload: { visible: false } })
  frame.remove()
})
