// e-pagination. Builds the label text and two native buttons in the places the CSS reserved, so
// nothing moves. A button is disabled while its has-previous or has-next attribute is absent, and a
// click tells the page with a bubbling e-previous or e-next event.
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

const words = {
  en: { pagination: 'Pagination', previous: 'Previous page', next: 'Next page' },
  bn: { pagination: 'পাতা', previous: 'আগের পাতা', next: 'পরের পাতা' },
}

/**
 * A pager: a label such as "21 to 40 of 120" and two buttons, previous and next. It keeps no page
 * number; the app sets the attributes and listens for the events.
 * @tag e-pagination
 * @attr label - The text before the buttons, such as the range shown.
 * @attr {boolean} has-previous - There is an earlier page. Without it the previous button is disabled.
 * @attr {boolean} has-next - There is a later page. Without it the next button is disabled.
 * @fires e-previous - The previous button was pressed.
 * @fires e-next - The next button was pressed.
 */
export class EPagination extends HTMLElement {
  static observedAttributes = ['label', 'has-previous', 'has-next']

  #text: HTMLSpanElement | null = null
  #previous: HTMLButtonElement | null = null
  #next: HTMLButtonElement | null = null
  #named = false
  #stop: (() => void) | undefined

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#say())
    if (this.#text) return
    this.setAttribute('role', 'navigation')
    // A name the app gave stays; the kit's own follows the page's language.
    this.#named = this.hasAttribute('aria-label')
    this.#text = document.createElement('span')
    this.#previous = this.#button('chevron-left', 'e-previous')
    this.#next = this.#button('chevron-right', 'e-next')
    this.append(this.#text, this.#previous, this.#next)
    this.#say()
    this.#update()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  #say(): void {
    const say = words[langOf(this)]
    if (!this.#named) this.setAttribute('aria-label', say.pagination)
    this.#previous?.setAttribute('aria-label', say.previous)
    this.#next?.setAttribute('aria-label', say.next)
  }

  attributeChangedCallback(): void {
    this.#update()
  }

  #button(icon: string, event: string): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    const glyph = document.createElement('e-icon')
    glyph.setAttribute('name', icon)
    button.append(glyph)
    button.addEventListener('click', () => this.dispatchEvent(new CustomEvent(event, { bubbles: true })))
    return button
  }

  #update(): void {
    if (!this.#text || !this.#previous || !this.#next) return
    this.#text.textContent = this.getAttribute('label') ?? ''
    this.#previous.disabled = !this.hasAttribute('has-previous')
    this.#next.disabled = !this.hasAttribute('has-next')
  }
}

export function definePagination(): void {
  if (!customElements.get('e-pagination')) customElements.define('e-pagination', EPagination)
}
