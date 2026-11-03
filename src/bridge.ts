// The app half of the bridge. It talks only to a parent it knows, posts only to that parent's
// origin, and does nothing on a page that is not framed by one.

import { watchSaveBars, type SaveBarAction } from './save-bar.ts'

// What an app posts to the Admin.
export type BridgeMessage =
  | { type: 'title'; payload: { title: string; actions: string[]; call: number } }
  | { type: 'saveBar'; payload: { visible: boolean } }
  | { type: 'toast'; payload: { message: string; error: boolean; action?: string; call: number } }
  | { type: 'nav'; payload: { entries: NavEntry[] } }
  | { type: 'loading'; payload: { visible: boolean } }
  | { type: 'modal'; payload: ModalOptions }
  | { type: 'modalClose' }
  | { type: 'idToken'; payload: { id: number } }
  // Sent once the page listens, so the Admin can tell it its theme.
  | { type: 'ready' }

// A page of the app's own, shown by the Admin in a modal: a sheet on phones, a dialog on desktops.
export interface ModalOptions {
  src: string
  size?: 'small' | 'medium' | 'large'
  title?: string
}

// One of an app's pages in the Admin nav: its label and its path on the app's origin.
export interface NavEntry {
  label: string
  path: string
}

export const navLimit = 8

// A button in the Admin's title bar. Its handler stays in the app; only the label crosses.
export interface TitleAction {
  label: string
  onAction?: () => void
}

export const titleActionLimit = 2

// The one button a toast can carry, such as Undo. Its handler stays in the app; only the label crosses.
export interface ToastAction {
  label: string
  onAction: () => void
}

// What the Admin posts back to the app.
export type HostMessage =
  | { type: 'saveBar'; payload: { action: SaveBarAction } }
  | { type: 'modalClosed' }
  | { type: 'titleAction'; payload: { call: number; index: number } }
  | { type: 'toastAction'; payload: { call: number } }
  | { type: 'idToken'; payload: IdTokenAnswer }
  | { type: 'theme'; payload: { theme: 'light' | 'dark' } }

// The Admin's answer to one request for an ID token: the token and the API it opens, or why not.
export interface IdTokenAnswer {
  id: number
  token?: string
  api?: string
  error?: string
}

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

// What ebdfy.fetch resolves to: the API's JSON body.
export interface FetchResult {
  data?: { [field: string]: Json } | null
  errors?: { message: string; extensions?: { code?: string } }[]
}

const parents = new Set(['https://admin.ebdfy.com', 'https://ui.ebdfy.com'])

// A development build also takes a playground served from this machine.
const localhost = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/

export function allowedParent(origin: string, dev: boolean): boolean {
  return parents.has(origin) || (dev && localhost.test(origin))
}

// Chromium names the parent in ancestorOrigins. Other browsers fall back to the referrer, which a
// cross-origin frame gets as the parent's origin.
export function parentOrigin(win: Window, dev: boolean = import.meta.env.DEV): string | null {
  if (win.parent === win) return null
  const ancestor = win.location.ancestorOrigins?.[0]
  const origin = ancestor ?? (win.document.referrer ? new URL(win.document.referrer).origin : '')
  return allowedParent(origin, dev) ? origin : null
}

// A tab opened at <app URL>?store=<handle> belongs inside the Admin. The app names itself in
// <meta name="ebdfy-app">.
export function adminRedirect(win: Window): string | null {
  if (win.top !== win) return null
  const store = new URLSearchParams(win.location.search).get('store')
  if (!store) return null
  const app = win.document.querySelector<HTMLMetaElement>('meta[name="ebdfy-app"]')?.content
  if (!app) {
    console.warn('ebdfy: add <meta name="ebdfy-app" content="<app handle>"> so a ?store link opens in the Admin')
    return null
  }
  return `https://admin.ebdfy.com/store/${encodeURIComponent(store)}/apps/${encodeURIComponent(app)}`
}

// The element with focus, inside any shadow roots, which a focus() on its host would not reach.
function focused(doc: Document): HTMLElement | null {
  let element = doc.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return element instanceof HTMLElement ? element : null
}

export function createBridge(win: Window = window) {
  const origin = parentOrigin(win)
  const post = (message: BridgeMessage) => {
    if (origin) win.parent.postMessage(message, origin)
  }
  // What had focus when the app opened a modal, to get it back once the modal closes.
  let opener: HTMLElement | null = null
  // Each title replaces the actions before it, so a tap names the title call it was drawn for.
  let titleCall = 0
  let titleActions: TitleAction[] = []
  // Likewise each toast replaces the one before it, and its action runs at most once.
  let toastCall = 0
  let toastAction: ToastAction | undefined
  // Requests for an ID token the Admin has yet to answer, by number.
  let asked = 0
  const waiting = new Map<number, (answer: IdTokenAnswer) => void>()
  const askForToken = (): Promise<{ token: string; api: string }> => {
    if (!origin)
      return Promise.reject(new Error('ebdfy: an ID token comes only from the Admin, and this page is not in it'))
    asked += 1
    const id = asked
    return new Promise((resolve, reject) => {
      waiting.set(id, ({ token, api, error }) => {
        if (token && api) resolve({ token, api })
        else reject(new Error(`ebdfy: no ID token: ${error ?? 'the Admin gave none'}`))
      })
      post({ type: 'idToken', payload: { id } })
    })
  }
  if (origin) {
    const bar = watchSaveBars(win.document, (visible) => post({ type: 'saveBar', payload: { visible } }))
    // A new page starts with the bar down, which lowers one an earlier page left up.
    post({ type: 'saveBar', payload: { visible: false } })
    // Nor does it want the loading bar an earlier page may have asked for.
    post({ type: 'loading', payload: { visible: false } })
    // Escape pressed in a page shown in the Admin's modal never reaches the modal, which is in the
    // Admin's document, so the bridge passes it on. With no modal open the Admin ignores it.
    win.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !event.defaultPrevented) post({ type: 'modalClose' })
    })
    // Only the parent, from its own origin, may press the bar's buttons.
    win.addEventListener('message', (event: MessageEvent<HostMessage>) => {
      if (event.source !== win.parent || event.origin !== origin) return
      if (event.data?.type === 'titleAction') {
        const { call, index } = event.data.payload ?? {}
        if (call === titleCall) titleActions[Number(index)]?.onAction?.()
      }
      if (event.data?.type === 'toastAction' && event.data.payload?.call === toastCall) {
        const run = toastAction
        toastAction = undefined
        run?.onAction()
      }
      if (event.data?.type === 'idToken') {
        const answer = event.data.payload
        waiting.get(answer?.id)?.(answer)
        waiting.delete(answer?.id)
      }
      if (event.data?.type === 'modalClosed') {
        opener?.focus()
        opener = null
      }
      // The app wears the Admin's theme, which the tokens read from data-theme on the root.
      const theme = event.data?.type === 'theme' ? event.data.payload?.theme : undefined
      if (theme === 'light' || theme === 'dark') win.document.documentElement.dataset.theme = theme
      const action = event.data?.type === 'saveBar' ? event.data.payload?.action : undefined
      if (action === 'save' || action === 'discard') bar.act(action)
    })
    post({ type: 'ready' })
  }
  return {
    // A short message the Admin shows for 5 s, or until dismissed for an error.
    toast(message: string, options: { error?: boolean; action?: ToastAction } = {}): void {
      toastAction = options.action
      toastCall += 1
      const action = options.action ? String(options.action.label) : undefined
      post({
        type: 'toast',
        payload: { message: String(message), error: options.error === true, action, call: toastCall },
      })
    },
    title(title: string, options: { actions?: TitleAction[] } = {}): void {
      const actions = options.actions ?? []
      if (actions.length > titleActionLimit) console.warn(`ebdfy: at most ${titleActionLimit} title actions`)
      titleActions = actions.slice(0, titleActionLimit)
      titleCall += 1
      const labels = titleActions.map((action) => String(action.label))
      post({ type: 'title', payload: { title: String(title), actions: labels, call: titleCall } })
    },
    // The Admin's loading bar, for work the app does after its page has loaded.
    loading(visible: boolean): void {
      post({ type: 'loading', payload: { visible: visible === true } })
    },
    // A JWT that lives 1 minute and names the store, the app installation and the staff member.
    async idToken(): Promise<string> {
      return (await askForToken()).token
    },
    // Runs a query against the Admin API as the app, narrowed to what the staff member may do.
    async fetch(query: string, variables: { [name: string]: Json } = {}): Promise<FetchResult> {
      const { token, api } = await askForToken()
      const response = await win.fetch(api, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query: String(query), variables }),
      })
      return response.json()
    },
    // Shows a page of the app, a path on its own origin, in a modal the Admin draws.
    modal(options: ModalOptions): void {
      opener = focused(win.document)
      const { src, size = 'medium', title = '' } = options
      const open = () => post({ type: 'modal', payload: { src: String(src), size, title: String(title) } })
      // The Admin closes a modal when the app's frame loads a page, so one asked for while this page
      // is still loading waits until it has.
      if (win.document.readyState === 'complete') open()
      else win.addEventListener('load', () => setTimeout(open), { once: true })
    },
    // Closes the modal, from the page that opened it or from the page inside it.
    closeModal(): void {
      post({ type: 'modalClose' })
    },
    // The app's pages in the Admin nav, in place of any it sent before.
    nav(entries: NavEntry[]): void {
      if (entries.length > navLimit) console.warn(`ebdfy: at most ${navLimit} nav entries`)
      const kept = entries.slice(0, navLimit).map(({ label, path }) => ({ label: String(label), path: String(path) }))
      post({ type: 'nav', payload: { entries: kept } })
    },
  }
}
