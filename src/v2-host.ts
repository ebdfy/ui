// The v2 Admin chrome, which the playground and the Admin load and apps never do. Like the kit, it
// draws in light DOM with no framework.
import './floor.ts'
import type { BridgeMessage } from './bridge.ts'
import { cut, cutTitle, navLabelLimit, toastLimit, toastSeconds } from './host-rules.ts'
import { button, say, serveApp } from './v2-host-app.ts'
import { guardLeaving } from './v2-host-leave.ts'
import { followPage } from './v2-host-nav.ts'
import { rememberBack, swapPanels } from './v2-host-panel.ts'
import { mountSaveBar, type SaveBar } from './v2-host-save-bar.ts'
import { keepTileInitials } from './v2-host-tile.ts'
import { titleBar } from './v2-host-title.ts'
import { followSearch, openSearch } from './v2-host-search.ts'
import { defineAppCard } from './v2/app-card.ts'
import { defineArrangedCards } from './v2/arranged-cards.ts'
import type { AppModalMessage, SearchMessage } from './v2/bridge.ts'
import { defineButton } from './v2/button.ts'
import { defineIcon } from './v2/icon.ts'
import { defineMenu } from './v2/menu.ts'
import { defineMenuTree } from './v2/menu-tree.ts'
import { defineReportBuilder } from './v2/report-builder.ts'

// The playground does not load v2.js, so the frame's icons and the notice's buttons are built here.
// A page's arranged cards, its report builder, a menu's tree and an app's card are the Admin's alone,
// so only this script runs them.
defineIcon()
defineButton()
defineArrangedCards()
defineReportBuilder()
defineMenuTree()
defineMenu()
defineAppCard()
keepTileInitials()

function takeMessages(panel: Element, frame: HTMLIFrameElement, saveBar: SaveBar | null): void {
  const heading = panel.querySelector('header h1')
  const served = serveApp(panel, frame)
  const post = served.post
  const title =
    heading &&
    titleBar(heading, (call, index, item) =>
      post(frame.contentWindow, { type: 'titleAction', payload: item === undefined ? { call, index } : { call, index, item } }),
    )

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

  // Only the app's own frame, from the origin its URL names, can change the chrome.
  window.addEventListener('message', (event: MessageEvent<BridgeMessage | AppModalMessage | SearchMessage>) => {
    const app = served.heard(event)
    if (!app) return
    const data = event.data
    if (data?.type === 'title' && heading) {
      heading.textContent = cutTitle(String(data.payload?.title ?? ''))
      title?.show(data.payload)
    }
    if (data?.type === 'loading') served.busy(data.payload?.visible === true)
    if (data?.type === 'toast') showToast(data.payload, app)
    if (data?.type === 'idToken') void served.answerToken(app, Number(data.payload?.id))
    if (data?.type === 'appModal') dim(data.payload?.open === true)
    if (data?.type === 'saveBar')
      saveBar?.app(data.payload ?? {}, (action) => post(app, { type: 'saveBar', payload: { action } }))
    if (data?.type === 'search')
      openSearch(() => {
        frame.focus()
        post(app, { type: 'searchClosed' })
      })
    // A page that loads draws its own actions, if any: the last page's are gone with it.
    if (data?.type === 'ready') {
      title?.show(undefined)
      dim(false)
      served.ready(data.payload?.page)
    }
    served.draw()
  })

  served.waitForAnswer()
  // The app says ready once, as it loads, so its page loads only now that the chrome listens.
  if (!frame.getAttribute('src') && frame.dataset.src) frame.src = frame.dataset.src
}

// The one save bar, for the panel's own forms and an app's alike, and the guard that asks before
// leaving an edit.
const adminFrame = document.querySelector('e-admin-frame')
const bar = adminFrame ? mountSaveBar(adminFrame) : null
const guard = adminFrame && bar ? guardLeaving(adminFrame, bar) : undefined

const appPanel = document.querySelector('e-admin-panel')
const appFrame = appPanel?.querySelector<HTMLIFrameElement>(':scope > iframe')
// The address and the app's nav listen first, as the chrome loads the app's page once it listens.
if (appPanel && appFrame) {
  followPage(appPanel, appFrame)
  takeMessages(appPanel, appFrame, bar)
}

// On the Admin's own pages a move to another of them swaps the panel under the frame, and Settings'
// Back row leads to the page Settings was opened from.
if (adminFrame) {
  followSearch(adminFrame)
  swapPanels(adminFrame, guard)
  rememberBack(adminFrame)
}
