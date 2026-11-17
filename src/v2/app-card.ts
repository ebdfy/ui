// e-app-card: an app's card in an order's side column. It frames the app's card page under a heading
// of the app's tile and name, and answers that frame as the app's page is answered: its ID token,
// where it runs (placement ORDER_CARD and the order's id) and the Admin's theme. A title, nav
// entries, the save bar, toasts and modals belong to the page, so a card ignores them.
import type { BridgeMessage } from '../bridge.ts'
import { words } from '../host-rules.ts'
import type { HeightMessage } from './bridge.ts'
import { serveApp } from '../v2-host-app.ts'

/**
 * An app's card in an order's side column: the app's 20 px tile and name over a frame of its card
 * page. The Admin's, so `v2-host.js` builds it, not `v2.js`.
 * @tag e-app-card
 * @attr src - The app's card page, with `?store` and `?id` (the order's id).
 * @attr app - The app's name, in the card's heading.
 * @attr tile - The app's letter, shown in its tile when it has no icon or the icon fails to load.
 * @attr icon - The address of the app's icon.
 * @attr {boolean} no-access - The staff member and the app share no access: the card says so and frames nothing.
 * @attr store - The store's handle, which the app hears in its context.
 * @attr token-url - Where the card gets the app's ID tokens, as on `e-admin-panel`.
 * @attr api-url - The Admin API the ID tokens open, as on `e-admin-panel`.
 */
export class EAppCard extends HTMLElement {
  #built = false

  connectedCallback(): void {
    if (this.#built) return
    this.#built = true
    const name = this.getAttribute('app') ?? ''
    const header = document.createElement('header')
    const tile = document.createElement('span')
    tile.className = 'e-tile'
    tile.dataset.size = '20'
    tile.setAttribute('aria-hidden', 'true')
    tile.textContent = this.getAttribute('tile') ?? ''
    const icon = this.getAttribute('icon')
    if (icon) {
      const image = document.createElement('img')
      image.alt = ''
      image.src = icon
      tile.append(image)
    }
    const heading = document.createElement('h2')
    heading.textContent = name
    header.append(tile, heading)
    this.replaceChildren(header)
    if (this.hasAttribute('no-access')) {
      const none = document.createElement('p')
      // The card speaks the language of the part of the page it sits in, the page's own in the Admin.
      const draw = () => {
        const bn = this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn')
        none.textContent = words[bn ? 'bn' : 'en'].noAccess.replace('{app}', name)
      }
      draw()
      new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
      this.append(none)
      return
    }
    const frame = document.createElement('iframe')
    frame.title = name
    this.append(frame)
    const served = serveApp(this, frame, 'ORDER_CARD')
    // Only the card's own frame, from the origin its address names, is heard.
    window.addEventListener('message', (event: MessageEvent<BridgeMessage | HeightMessage>) => {
      const app = served.heard(event)
      if (!app) return
      const data = event.data
      // The frame takes the height the app reports, from 40 px to 480 px; the card scrolls past it.
      const height = data?.type === 'height' ? Number(data.payload?.height) : Number.NaN
      if (Number.isFinite(height)) frame.style.blockSize = `${Math.min(Math.max(height, 40), 480)}px`
      if (data?.type === 'loading') served.busy(data.payload?.visible === true)
      if (data?.type === 'idToken') void served.answerToken(app, Number(data.payload?.id))
      if (data?.type === 'ready') served.ready(data.payload?.page)
      served.draw()
    })
    served.waitForAnswer()
    // The app says ready once, as it loads, so its page loads only now that the card listens.
    frame.src = this.getAttribute('src') ?? ''
  }
}

export function defineAppCard(): void {
  if (!customElements.get('e-app-card')) customElements.define('e-app-card', EAppCard)
}
