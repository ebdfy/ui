// What the Admin owes an app wherever it frames one: 15 s to answer before a notice covers it, a
// loading bar until then, ID tokens, the Admin's theme and where the app runs. The app's page in the
// panel and an app's card each hold one, on the element that names the store, the app and the
// token and API addresses.
import type { HostMessage, IdTokenAnswer } from './bridge.ts'
import { answerSeconds, words } from './host-rules.ts'
import { phoneWidth, type ContextMessage, type SearchClosedMessage } from './v2/bridge.ts'

// The chrome's own words, in the language of the page at the moment it shows them.
export const language = () => (document.documentElement.lang.startsWith('bn') ? 'bn' : 'en')
export const say = () => words[language()]

export function button(tag: 'button' | 'e-button', label: string): HTMLElement {
  const made = document.createElement(tag)
  made.setAttribute('type', 'button')
  made.textContent = label
  return made
}

// e-button holds its label in the native button it built inside itself.
function relabel(kit: HTMLElement, label: string): void {
  const inner = kit.querySelector('button')
  if (inner) inner.textContent = label
}

// placement names where the app is shown, for a host whose placement is its own, such as a card's.
export function serveApp(host: Element, frame: HTMLIFrameElement, placement = host.getAttribute('placement')) {
  // Only the origin the iframe's URL names may hear the chrome's answers.
  const appOrigin = () => new URL(frame.src, location.href).origin
  const post = (to: Window | null, message: HostMessage | ContextMessage | SearchClosedMessage) =>
    to?.postMessage(message, appOrigin())

  const bar = document.createElement('div')
  bar.className = 'e-loading-bar'
  bar.setAttribute('role', 'progressbar')

  // The notice is built once and its words filled as it shows.
  const notice = document.createElement('div')
  notice.className = 'e-notice'
  notice.setAttribute('role', 'alert')
  notice.hidden = true
  const said = document.createElement('p')
  const help = document.createElement('p')
  const reload = button('e-button', '')
  reload.setAttribute('tone', 'primary')
  const keepWaiting = button('e-button', '')
  const actions = document.createElement('div')
  actions.append(reload, keepWaiting)
  notice.append(said, help, actions)
  host.append(bar, notice)

  let answered = false
  let ready = false
  let busy = false
  let answerTimer = 0
  const draw = () => {
    bar.hidden = !notice.hidden || (ready && !busy)
    bar.setAttribute('aria-label', say().loading)
  }

  const showNotice = () => {
    const copy = say()
    said.textContent = copy.stalled
    help.textContent = copy.stalledHelp
    relabel(reload, copy.reload)
    relabel(keepWaiting, copy.keepWaiting)
    notice.hidden = false
  }

  // Every page the chrome loads has 15 s to answer before the notice covers it.
  const waitForAnswer = () => {
    answered = false
    ready = false
    busy = false
    notice.hidden = true
    clearTimeout(answerTimer)
    answerTimer = window.setTimeout(() => {
      if (!answered) showNotice()
      draw()
    }, answerSeconds * 1000)
    draw()
  }

  reload.addEventListener('click', () => {
    waitForAnswer()
    frame.setAttribute('src', frame.getAttribute('src') ?? '')
  })
  keepWaiting.addEventListener('click', waitForAnswer)

  // The app wears the Admin's theme: it hears it when it is ready, and again whenever the device's
  // theme or the Admin's own data-theme changes it.
  const tellTheme = () => {
    if (!ready) return
    const theme = getComputedStyle(host).colorScheme === 'dark' ? 'dark' : 'light'
    post(frame.contentWindow, { type: 'theme', payload: { theme } })
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tellTheme)
  new MutationObserver(tellTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  // The app hears where it runs when it is ready, and again whenever the Admin's language or width
  // class changes. The host names the store and the app; the page opened from a placement also hears
  // the placement and the record's id, which its frame's address carries, but a page the app moves
  // to from it does not.
  const phone = matchMedia(phoneWidth)
  let page: URL | null = null
  const tellContext = () => {
    if (!ready) return
    const payload: ContextMessage['payload'] = {
      store: host.getAttribute('store') ?? '',
      app: host.getAttribute('app') ?? '',
      language: language(),
      mobile: phone.matches,
    }
    const opened = new URL(frame.src, location.href)
    const id = opened.searchParams.get('id')
    const here = page ?? opened
    if (here.pathname === opened.pathname && here.searchParams.get('id') === id) {
      if (placement) payload.placement = placement
      if (id) payload.id = id
    }
    post(frame.contentWindow, { type: 'context', payload })
  }
  phone.addEventListener('change', tellContext)
  new MutationObserver(tellContext).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

  // One token serves every call until 10 s before it dies. Its lifetime is timed from the mint by
  // this page's clock, never by its exp, so a server clock out of step cannot keep a dead token.
  let token: { value: string; until: number } | null = null
  let minting: Promise<string> | null = null
  const mint = async (): Promise<string> => {
    const minted = Date.now()
    const response = await fetch(new URL(host.getAttribute('token-url') ?? '', location.href), { method: 'POST' })
    if (!response.ok) throw new Error(response.status === 403 ? 'ACCESS_ENDED' : `HTTP ${response.status}`)
    // SAFETY: the token endpoint answers a 2xx with {token}, a JWT whose claims hold iat and exp.
    const { token: value } = (await response.json()) as { token: string }
    const segment = value.split('.')[1] ?? ''
    // SAFETY: as above, the second segment of the JWT is its claims as base64url JSON.
    const claims = JSON.parse(atob(segment.replaceAll('-', '+').replaceAll('_', '/'))) as { iat: number; exp: number }
    token = { value, until: minted + (claims.exp - claims.iat - 10) * 1000 }
    return value
  }
  const idToken = (): Promise<string> => {
    if (token && Date.now() < token.until) return Promise.resolve(token.value)
    minting ??= mint().finally(() => (minting = null))
    return minting
  }

  return {
    post,
    draw,
    waitForAnswer,
    // The app's frame, from the origin its URL names, or null for any other sender. Every message it
    // sends counts as an answer, even one this chrome does not act on yet.
    heard(event: MessageEvent): Window | null {
      const app = frame.contentWindow
      if (!app || event.source !== app || event.origin !== appOrigin()) return null
      answered = true
      notice.hidden = true
      return app
    },
    busy(visible: boolean) {
      busy = visible
    },
    // page is the page the app names as it says ready, which an app before 2.2 may not name.
    ready(named?: unknown) {
      ready = true
      page = typeof named === 'string' && URL.canParse(named) ? new URL(named) : null
      tellTheme()
      tellContext()
    },
    async answerToken(from: Window, id: number) {
      const reply: IdTokenAnswer = { id }
      try {
        reply.token = await idToken()
        reply.api = new URL(host.getAttribute('api-url') ?? '', location.href).href
      } catch (error) {
        reply.error = error instanceof Error ? error.message : String(error)
      }
      post(from, { type: 'idToken', payload: reply })
    },
  }
}
