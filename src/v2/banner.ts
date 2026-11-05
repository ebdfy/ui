// e-banner: builds its heading in the cell the CSS drew it in, makes a critical banner an alert, and
// gives a dismissible one a close button. The button fires a cancelable dismiss, then hides the banner
// and hands the focus to the next control, as hiding would drop it to the body.
import { langOf } from '../lang.ts'

const focusable = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

// The next focusable control after the banner in document order, else the last one before it.
function successor(banner: HTMLElement): HTMLElement | undefined {
  let before: HTMLElement | undefined
  for (const el of document.querySelectorAll<HTMLElement>(focusable)) {
    if (banner.contains(el) || el.matches(':disabled') || !el.checkVisibility()) continue
    if (banner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el
    before = el
  }
  return before
}

/**
 * A message across the page in a tone. A critical banner is announced as an alert. The heading and the
 * close button are built by the script, so a banner reads whole without it.
 * @tag e-banner
 * @attr {'info' | 'success' | 'warning' | 'critical'} tone - The message's tone; `info` when absent.
 * @attr heading - The banner's title, built as its first line.
 * @attr {boolean} dismissible - Adds a close button that hides the banner.
 * @fires dismiss - When the close button is pressed, before the banner hides. Bubbles and is cancelable; `preventDefault()` keeps the banner open. detail is empty.
 * @slot - The message.
 * @slot dismiss - The close button. The script builds one for a dismissible banner; a page may supply its own.
 */
export class EBanner extends HTMLElement {
  static observedAttributes = ['heading', 'tone']

  connectedCallback(): void {
    this.attributeChangedCallback()
    if (!this.hasAttribute('dismissible')) return
    if (!this.querySelector(':scope > [slot="dismiss"]')) this.append(this.#closeButton())
    this.#name()
    for (const tag of new Set([this.closest('[lang]'), document.documentElement])) {
      if (tag) this.#watch.observe(tag, { attributeFilter: ['lang'] })
    }
  }

  #closeButton(): HTMLButtonElement {
    const close = document.createElement('button')
    close.type = 'button'
    close.slot = 'dismiss'
    close.innerHTML = '<e-icon name="x"></e-icon>'
    close.addEventListener('click', () => {
      const next = successor(this)
      if (!this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, cancelable: true }))) return
      this.hidden = true
      next?.focus()
    })
    return close
  }

  disconnectedCallback(): void {
    this.#watch.disconnect()
  }

  // The close button's name, in the page's language, and again when it changes.
  #watch = new MutationObserver(() => this.#name())

  #name(): void {
    this.querySelector(':scope > [slot="dismiss"]')?.setAttribute(
      'aria-label',
      langOf(this) === 'bn' ? 'বন্ধ করুন' : 'Dismiss',
    )
  }

  attributeChangedCallback(): void {
    if (this.getAttribute('tone') === 'critical') this.setAttribute('role', 'alert')
    else this.removeAttribute('role')
    const heading = this.getAttribute('heading')
    let built = this.querySelector(':scope > [slot="heading"]')
    if (heading === null) {
      built?.remove()
      return
    }
    if (!built) {
      built = document.createElement('p')
      built.slot = 'heading'
      this.prepend(built)
    }
    built.textContent = heading
  }
}

export function defineBanner(): void {
  if (!customElements.get('e-banner')) customElements.define('e-banner', EBanner)
}
