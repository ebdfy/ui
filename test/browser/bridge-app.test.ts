import { expect, test, vi } from 'vitest'

import { adminRedirect, allowedParent, createBridge, parentOrigin } from '../../src/bridge.ts'

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

function topLevel(search: string, app: string | null, home?: string, pathname = '/'): Window {
  const win = {
    location: { search, pathname },
    document: document.implementation.createHTMLDocument(),
  } as unknown as Window
  ;(win as { top: Window }).top = win
  if (app) win.document.head.innerHTML = `<meta name="ebdfy-app" content="${app}">`
  if (home) win.document.head.insertAdjacentHTML('beforeend', `<meta name="ebdfy-home" content="${home}">`)
  return win
}

test('a top-level load with a store goes back into the Admin', () => {
  expect(adminRedirect(topLevel('?store=demo', 'sample'))).toBe('https://admin.ebdfy.com/store/demo/apps/sample')
  expect(adminRedirect(topLevel('?store=a%2F..%2Fb&x=1', 'sample'))).toBe(
    'https://admin.ebdfy.com/store/a%2F..%2Fb/apps/sample',
  )
})

test('an app that names the playground as its home goes there with the same page open', () => {
  const win = topLevel('?store=demo', 'sample', 'https://ui.ebdfy.com/playground', '/order-1039')
  expect(adminRedirect(win, false)).toBe('https://ui.ebdfy.com/playground?page=%2Forder-1039')
  // The page keeps its own query, less the store the home supplies.
  const query = topLevel('?id=5&store=demo', 'sample', 'https://ui.ebdfy.com/playground', '/order')
  expect(adminRedirect(query, false)).toBe('https://ui.ebdfy.com/playground?page=%2Forder%3Fid%3D5')
})

test('a home on a host the bridge does not know is ignored, and the app goes to the Admin', () => {
  const win = topLevel('?store=demo', 'sample', 'https://evil.example/playground', '/order-1039')
  expect(adminRedirect(win, false)).toBe('https://admin.ebdfy.com/store/demo/apps/sample')
  expect(adminRedirect(topLevel('?store=demo', 'sample', 'not a url'), false)).toBe(
    'https://admin.ebdfy.com/store/demo/apps/sample',
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
  const frame = document.createElement('iframe')
  // The first message from this frame: an earlier test's frame may still have one on its way.
  const message = new Promise<MessageEvent>((resolve) => {
    const hear = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      window.removeEventListener('message', hear)
      resolve(event)
    }
    window.addEventListener('message', hear)
  })
  frame.src = '/test/browser/fixtures/app.html'
  document.body.append(frame)
  expect((await message).data).toEqual({ type: 'saveBar', payload: { visible: false } })
  frame.remove()
})

// What a bridge on this test page posts to its parent, which stands in for the Admin.
function spyOnPosts() {
  const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
  return {
    // SAFETY: the bridge posts only BridgeMessage objects.
    messages: () => post.mock.calls.map(([message]) => message as { type: string; payload?: Record<string, unknown> }),
    restore: () => post.mockRestore(),
  }
}

// A message to this page's bridges from the parent, as the Admin sends one.
const fromAdmin = (data: object) =>
  window.dispatchEvent(
    new MessageEvent('message', { data, source: window.parent, origin: location.ancestorOrigins[0] }),
  )

test('a 9th nav entry is dropped and the app is warned', () => {
  const posts = spyOnPosts()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const nine = Array.from({ length: 9 }, (_, i) => ({ label: `Page ${i + 1}`, path: `/page-${i + 1}` }))
  createBridge(window).nav(nine)
  expect(warn).toHaveBeenCalledWith('ebdfy: at most 8 nav entries')
  warn.mockRestore()
  const nav = posts.messages().find((message) => message.type === 'nav')
  posts.restore()
  expect(nav?.payload).toEqual({ entries: nine.slice(0, 8) })
})

test('a third title action is dropped and the app is warned', () => {
  const posts = spyOnPosts()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  createBridge(window).title('Order #1042', { actions: [{ label: 'A' }, { label: 'B' }, { label: 'C' }] })
  expect(warn).toHaveBeenCalledWith('ebdfy: at most 2 title actions')
  warn.mockRestore()
  const title = posts.messages().find((message) => message.type === 'title')
  posts.restore()
  expect(title?.payload?.actions).toEqual(['A', 'B'])
})

test('an action marked primary names its index, and with none marked the title names none', () => {
  const posts = spyOnPosts()
  const bridge = createBridge(window)
  bridge.title('Orders', { actions: [{ label: 'Export' }, { label: 'Create order', primary: true }] })
  bridge.title('Orders', { actions: [{ label: 'Export' }, { label: 'Print' }] })
  const [marked, plain] = posts.messages().filter((message) => message.type === 'title')
  posts.restore()
  expect(marked?.payload).toMatchObject({ actions: ['Export', 'Create order'], primary: 1 })
  expect(plain?.payload).not.toHaveProperty('primary')
})

test('a second action marked primary is sent plain, and the app is warned once', () => {
  const posts = spyOnPosts()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  createBridge(window).title('Orders', {
    actions: [
      { label: 'Export', primary: true },
      { label: 'Create order', primary: true },
    ],
  })
  expect(warn.mock.calls).toEqual([['ebdfy: at most one title action is primary; the others draw plain']])
  warn.mockRestore()
  const title = posts.messages().find((message) => message.type === 'title')
  posts.restore()
  expect(title?.payload?.primary).toBe(0)
})

test('a press on a title action runs its handler once, and a press meant for an earlier title runs nothing', () => {
  const posts = spyOnPosts()
  const bridge = createBridge(window)
  const first = vi.fn()
  const second = vi.fn()
  bridge.title('Order #1042', { actions: [{ label: 'Book courier', onAction: first }] })
  bridge.title('Order #1042', { actions: [{ label: 'Book courier', onAction: second }] })
  const [earlier, latest] = posts
    .messages()
    .filter((message) => message.type === 'title')
    .map((message) => message.payload!.call)
  posts.restore()
  fromAdmin({ type: 'titleAction', payload: { call: earlier, index: 0 } })
  expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 0])
  fromAdmin({ type: 'titleAction', payload: { call: latest, index: 0 } })
  expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1])
})

test('the bridge posts menus aligned with the actions and runs only the picked item', () => {
  const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
  const bridge = createBridge(window)
  const onAction = vi.fn()
  const plain = vi.fn()
  bridge.title('X', { actions: [{ label: 'More', onAction: plain, items: [{ label: 'A', onAction }] }] })
  const titled = post.mock.calls.map(([message]) => message).find((message) => message?.type === 'title')
  post.mockRestore()
  expect(titled.payload.actions).toEqual(['More'])
  expect(titled.payload.menus).toEqual([[{ label: 'A' }]])
  const pick = (item: number) =>
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'titleAction', payload: { call: titled.payload.call, index: 0, item } },
        source: window.parent,
        origin: location.ancestorOrigins[0],
      }),
    )
  pick(0)
  pick(1)
  expect(onAction).toHaveBeenCalledTimes(1)
  expect(plain).not.toHaveBeenCalled()
})

test("a toast's action runs at most once, and a press meant for an earlier toast runs nothing", () => {
  const posts = spyOnPosts()
  const bridge = createBridge(window)
  const first = vi.fn()
  const second = vi.fn()
  bridge.toast('Order cancelled', { action: { label: 'Undo', onAction: first } })
  bridge.toast('Order archived', { action: { label: 'Undo', onAction: second } })
  const toasts = posts.messages().filter((message) => message.type === 'toast')
  posts.restore()
  expect(toasts.map((toast) => toast.payload)).toEqual([
    { message: 'Order cancelled', error: false, action: 'Undo', call: 1 },
    { message: 'Order archived', error: false, action: 'Undo', call: 2 },
  ])
  fromAdmin({ type: 'toastAction', payload: { call: 1 } })
  fromAdmin({ type: 'toastAction', payload: { call: 2 } })
  fromAdmin({ type: 'toastAction', payload: { call: 2 } })
  expect([first.mock.calls.length, second.mock.calls.length]).toEqual([0, 1])
})

test('a modal the app asks for is posted, and focus goes back to what had it once the Admin closes it', () => {
  const posts = spyOnPosts()
  const bridge = createBridge(window)
  document.body.innerHTML = '<button type="button">Book courier</button>'
  const opener = document.querySelector('button')!
  opener.focus()
  bridge.modal({ src: '/orders/1042/courier', title: 'Book courier' })
  const modal = posts.messages().find((message) => message.type === 'modal')
  opener.blur()
  fromAdmin({ type: 'modalClosed' })
  expect(document.activeElement).toBe(opener)
  // Escape in the app's page never reaches the Admin's modal, so the bridge passes it on.
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  const closes = posts.messages().filter((message) => message.type === 'modalClose')
  posts.restore()
  document.body.replaceChildren()
  expect(modal?.payload).toEqual({ src: '/orders/1042/courier', size: 'medium', title: 'Book courier' })
  expect(closes.length).toBeGreaterThan(0)
})

// The app fixture in a frame, with each message it posts to this page, which stands in for the Admin.
async function openApp(query: string) {
  const frame = document.createElement('iframe')
  const posted: { type: string; payload?: Record<string, unknown> }[] = []
  const listen = (event: MessageEvent) => {
    if (event.source === frame.contentWindow) posted.push(event.data)
  }
  window.addEventListener('message', listen)
  frame.src = `/test/browser/fixtures/app.html?${query}`
  document.body.append(frame)
  await expect.poll(() => posted.some((message) => message.type === 'title')).toBe(true)
  return {
    frame,
    send: (message: object) => frame.contentWindow!.postMessage(message, location.origin),
    bars: () => posted.filter((message) => message.type === 'saveBar').map((message) => message.payload!.visible),
    toasts: () => posted.filter((message) => message.type === 'toast').map((message) => message.payload!.message),
    close: () => {
      window.removeEventListener('message', listen)
      frame.remove()
    },
  }
}

test("the Admin's Discard puts the app's field back, and its Save submits the form once", async () => {
  const app = await openApp('form')
  const note = app.frame.contentDocument!.querySelector('input')!
  const edit = (value: string) => {
    note.value = value
    note.dispatchEvent(new Event('input', { bubbles: true }))
  }
  edit('Call first!')
  await expect.poll(app.bars).toEqual([false, true])
  app.send({ type: 'saveBar', payload: { action: 'discard' } })
  await expect.poll(app.bars).toEqual([false, true, false])
  expect(note.value).toBe('Call first')
  edit('Ring twice')
  app.send({ type: 'saveBar', payload: { action: 'save' } })
  app.send({ type: 'saveBar', payload: { action: 'save' } })
  await expect.poll(app.toasts).toEqual(['Saved Ring twice'])
  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(app.toasts()).toEqual(['Saved Ring twice'])
  app.close()
})
