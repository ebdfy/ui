// The parts of the bridge only v2 has. Like the shared half in bridge.ts, each does nothing on a page
// that no Admin frames.
import { parentOrigin } from '../bridge.ts'

// The Admin opens an app at <app URL>/<path>?store=<handle>. A link the app follows on its own origin
// keeps that store unless it names one, so the page it opens, or a tab opened from it, still knows
// its store. The link's address changes as it is followed, before the browser reads it.
export function keepStore(win: Window = window): void {
  if (!parentOrigin(win)) return
  const store = new URLSearchParams(win.location.search).get('store')
  if (!store) return
  const follow = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
    if (!link) return
    const url = new URL(link.href)
    if (url.origin !== win.location.origin || url.searchParams.has('store')) return
    url.searchParams.set('store', store)
    link.href = url.href
  }
  win.addEventListener('click', follow, true)
  win.addEventListener('auxclick', follow, true)
}

// What the Admin tells the app about where it runs: the store and app, the staff member's language
// and whether the Admin's window is a phone's. It sends it once the app is ready and again on change.
export interface ContextMessage {
  type: 'context'
  payload: { store: string; app: string; language: 'bn' | 'en'; mobile: boolean }
}

// What an ebdfy:context event carries.
export interface AppContext {
  store: string
  app: string
  language: 'bn' | 'en'
  embedded: boolean
  mobile: boolean
}

// The width under which the Admin is on a phone, where modals are sheets and tables cards.
export const phoneWidth = '(width < 600px)'

// ebdfy.config, ebdfy.user() and ebdfy.environment. Until the Admin speaks, the store comes from the
// address it opened the app at and the app from <meta name="ebdfy-app">; then the Admin's word holds,
// and each time it speaks the bridge fires ebdfy:context.
export function createContext(win: Window = window) {
  const origin = parentOrigin(win)
  const config = {
    store: new URLSearchParams(win.location.search).get('store') ?? '',
    app: win.document.querySelector<HTMLMetaElement>('meta[name="ebdfy-app"]')?.content ?? '',
  }
  const environment = { embedded: origin !== null, mobile: win.matchMedia(phoneWidth).matches }
  let language: AppContext['language'] | null = null
  let heard: () => void = () => {}
  const spoken = new Promise<void>((resolve) => (heard = resolve))
  if (origin) {
    win.addEventListener('message', (event: MessageEvent<ContextMessage>) => {
      if (event.source !== win.parent || event.origin !== origin || event.data?.type !== 'context') return
      const { store, app, mobile } = event.data.payload ?? {}
      config.store = String(store ?? '')
      config.app = String(app ?? '')
      environment.mobile = mobile === true
      language = event.data.payload?.language === 'bn' ? 'bn' : 'en'
      heard()
      const detail: AppContext = { ...config, language, ...environment }
      win.dispatchEvent(new CustomEvent('ebdfy:context', { detail }))
    })
  }
  return {
    config,
    environment,
    // The staff member using the app. Only the Admin knows them, so a page outside it gets an error.
    async user(): Promise<{ language: AppContext['language'] }> {
      if (!origin) throw new Error('ebdfy: the staff member comes only from the Admin, and this page is not in it')
      await spoken
      return { language: language ?? 'en' }
    },
  }
}

// The app's page, which the Admin puts in its own address. The bridge names it as the app moves by
// history (pushState, replaceState, Back and Forward); a page that loads names itself as it says
// ready.
export interface PageMessage {
  type: 'page'
  payload: { page: string }
}

export function reportPage(win: Window = window): void {
  const origin = parentOrigin(win)
  if (!origin) return
  const tell = () => {
    const message: PageMessage = { type: 'page', payload: { page: win.location.href } }
    win.parent.postMessage(message, origin)
  }
  for (const method of ['pushState', 'replaceState'] as const) {
    const moved = win.history[method]
    win.history[method] = function (...args: Parameters<History['pushState']>) {
      moved.apply(this, args)
      tell()
    }
  }
  win.addEventListener('popstate', tell)
}

// Ctrl+K, or ⌘K on Apple, opens the Admin's search from anywhere. A key pressed in the app's frame
// never reaches the Admin's page, so the bridge passes it on.
export interface SearchMessage {
  type: 'search'
}

// The Admin's word that its search has closed, so the app puts focus back on its own element.
export interface SearchClosedMessage {
  type: 'searchClosed'
}

export const isSearchKey = (event: KeyboardEvent): boolean =>
  event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey

export function forwardSearch(win: Window = window): void {
  const origin = parentOrigin(win)
  if (!origin) return
  let had: Element | null = null
  win.addEventListener('keydown', (event) => {
    if (!isSearchKey(event)) return
    event.preventDefault()
    had = win.document.activeElement
    const message: SearchMessage = { type: 'search' }
    win.parent.postMessage(message, origin)
  })
  win.addEventListener('message', (event: MessageEvent<SearchClosedMessage>) => {
    if (event.source !== win.parent || event.origin !== origin || event.data?.type !== 'searchClosed') return
    if (had instanceof HTMLElement && had.isConnected) had.focus()
    had = null
  })
}

// Whether one of the app's own e-modal dialogs is open, so the Admin can dim its frame and title bar
// with the same scrim and keep taps off them meanwhile.
export interface AppModalMessage {
  type: 'appModal'
  payload: { open: boolean }
}

export function reportModals(win: Window = window): void {
  const origin = parentOrigin(win)
  if (!origin) return
  const tell = () => {
    const open = win.document.querySelector('e-modal > dialog[open]') !== null
    const message: AppModalMessage = { type: 'appModal', payload: { open } }
    win.parent.postMessage(message, origin)
  }
  win.addEventListener('e-modal-open', tell)
  win.addEventListener('e-modal-close', tell)
}
