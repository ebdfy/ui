// The v2 Admin chrome, which the playground and the Admin load and apps never do. Like the kit, it
// draws in light DOM with no framework.
import './floor.ts'
import type { BridgeMessage, HostMessage, IdTokenAnswer } from './bridge.ts'
import { answerSeconds, cut, cutTitle, navLabelLimit, toastLimit, toastSeconds, words } from './host-rules.ts'
import { followPage } from './v2-host-nav.ts'
import { phoneWidth, type AppModalMessage, type ContextMessage } from './v2/bridge.ts'
import { defineButton } from './v2/button.ts'
import { defineIcon } from './v2/icon.ts'

// The playground does not load v2.js, so the frame's icons and the notice's buttons are built here.
defineIcon()
defineButton()

// The chrome's own words, in the language of the page at the moment it shows them.
const language = () => (document.documentElement.lang.startsWith('bn') ? 'bn' : 'en')
const say = () => words[language()]

function button(tag: 'button' | 'e-button', label: string): HTMLElement {
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

function takeMessages(panel: Element, frame: HTMLIFrameElement): void {
  const heading = panel.querySelector('header h1')
  // Only the origin the iframe's URL names may hear the chrome's answers.
  const appOrigin = () => new URL(frame.src, location.href).origin
  const post = (to: Window | null, message: HostMessage | ContextMessage) => to?.postMessage(message, appOrigin())

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
  panel.append(bar, notice)

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

  let toast: HTMLElement | null = null
  let toastTimer = 0
  const hideToast = () => {
    clearTimeout(toastTimer)
    toast?.remove()
    toast = null
  }

  // One toast at a time: a new one takes the place of the last. Errors stay until dismissed. A toast
  // with no words has nothing to say and shows nothing.
  const showToast = (payload: Extract<BridgeMessage, { type: 'toast' }>['payload'] | undefined, from: Window) => {
    if (!String(payload?.message ?? '').trim()) return
    hideToast()
    const error = payload?.error === true
    const label = cut(String(payload?.action ?? '').trim(), navLabelLimit)
    toast = document.createElement('div')
    toast.className = 'e-toast'
    toast.setAttribute('role', error ? 'alert' : 'status')
    const message = document.createElement('span')
    message.textContent = cut(String(payload?.message ?? ''), toastLimit)
    toast.append(message)
    if (label) {
      const call = Number(payload?.call)
      const press = button('button', label)
      press.addEventListener('click', () => {
        hideToast()
        post(from, { type: 'toastAction', payload: { call } })
      })
      toast.append(press)
    }
    if (error) {
      const dismiss = button('button', say().dismiss)
      dismiss.addEventListener('click', hideToast)
      toast.append(dismiss)
    }
    panel.append(toast)
    if (!error) toastTimer = window.setTimeout(hideToast, toastSeconds * 1000)
  }

  // The app wears the Admin's theme: it hears it when it is ready, and again whenever the device's
  // theme or the Admin's own data-theme changes it.
  const tellTheme = () => {
    if (!ready) return
    const theme = getComputedStyle(panel).colorScheme === 'dark' ? 'dark' : 'light'
    post(frame.contentWindow, { type: 'theme', payload: { theme } })
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tellTheme)
  new MutationObserver(tellTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })

  // The app hears where it runs when it is ready, and again whenever the Admin's language or width
  // class changes. The panel names the store and the app.
  const phone = matchMedia(phoneWidth)
  const tellContext = () => {
    if (!ready) return
    const store = panel.getAttribute('store') ?? ''
    const app = panel.getAttribute('app') ?? ''
    post(frame.contentWindow, { type: 'context', payload: { store, app, language: language(), mobile: phone.matches } })
  }
  phone.addEventListener('change', tellContext)
  new MutationObserver(tellContext).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

  // One token serves every call until 10 s before it dies. Its lifetime is timed from the mint by
  // this page's clock, never by its exp, so a server clock out of step cannot keep a dead token.
  let token: { value: string; until: number } | null = null
  let minting: Promise<string> | null = null
  const mint = async (): Promise<string> => {
    const minted = Date.now()
    const response = await fetch(new URL(panel.getAttribute('token-url') ?? '', location.href), { method: 'POST' })
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
  const answerToken = async (from: Window, id: number) => {
    const reply: IdTokenAnswer = { id }
    try {
      reply.token = await idToken()
      reply.api = new URL(panel.getAttribute('api-url') ?? '', location.href).href
    } catch (error) {
      reply.error = error instanceof Error ? error.message : String(error)
    }
    post(from, { type: 'idToken', payload: reply })
  }

  // While the app shows a modal of its own, the Admin's frame and the app's title bar sit under the
  // scrim and take no taps or focus; a page that loads has none open.
  const admin = panel.closest('e-admin-frame')
  // A tap on the scrim would take focus out of the app's frame, where the modal hears Escape, so it
  // takes none.
  admin?.addEventListener('mousedown', (event) => {
    if (admin.hasAttribute('data-app-modal')) event.preventDefault()
  })
  const dim = (open: boolean) => {
    admin?.toggleAttribute('data-app-modal', open)
    for (const part of [...(admin?.children ?? []), panel.querySelector(':scope > header')]) {
      if (part instanceof HTMLElement && part !== panel) part.inert = open
    }
  }

  // Only the app's own frame, from the origin its URL names, can change the chrome. Every message it
  // sends counts as an answer, even one this chrome does not act on yet.
  window.addEventListener('message', (event: MessageEvent<BridgeMessage | AppModalMessage>) => {
    const app = frame.contentWindow
    if (!app || event.source !== app || event.origin !== appOrigin()) return
    answered = true
    notice.hidden = true
    const data = event.data
    if (data?.type === 'title' && heading) heading.textContent = cutTitle(String(data.payload?.title ?? ''))
    if (data?.type === 'loading') busy = data.payload?.visible === true
    if (data?.type === 'toast') showToast(data.payload, app)
    if (data?.type === 'idToken') void answerToken(app, Number(data.payload?.id))
    if (data?.type === 'appModal') dim(data.payload?.open === true)
    if (data?.type === 'ready') {
      dim(false)
      ready = true
      tellTheme()
      tellContext()
    }
    draw()
  })

  waitForAnswer()
  // The app says ready once, as it loads, so its page loads only now that the chrome listens.
  if (!frame.getAttribute('src') && frame.dataset.src) frame.src = frame.dataset.src
}

const appPanel = document.querySelector('e-admin-panel')
const appFrame = appPanel?.querySelector<HTMLIFrameElement>(':scope > iframe')
// The address and the app's nav listen first, as the chrome loads the app's page once it listens.
if (appPanel && appFrame) {
  followPage(appPanel, appFrame)
  takeMessages(appPanel, appFrame)
}
