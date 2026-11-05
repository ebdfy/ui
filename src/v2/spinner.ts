// e-spinner: says Loading, in the page's language, to a screen reader, and again when the language
// changes; v2.css draws and turns it. An aria-label the page gave it stays.
import { langOf } from '../lang.ts'

/**
 * A small ring that turns while something loads. It says Loading to a screen reader, in the page's language.
 * @tag e-spinner
 * @attr aria-label - Replaces the default Loading name.
 */
export class ESpinner extends HTMLElement {
  #ours = false
  #watch = new MutationObserver(() => this.#say())

  connectedCallback(): void {
    this.setAttribute('role', 'status')
    if (this.hasAttribute('aria-label') && !this.#ours) return
    this.#ours = true
    this.#say()
    for (const tag of new Set([this.closest('[lang]'), document.documentElement])) {
      if (tag) this.#watch.observe(tag, { attributeFilter: ['lang'] })
    }
  }

  disconnectedCallback(): void {
    this.#watch.disconnect()
  }

  #say(): void {
    this.setAttribute('aria-label', langOf(this) === 'bn' ? 'লোড হচ্ছে' : 'Loading')
  }
}

export function defineSpinner(): void {
  if (!customElements.get('e-spinner')) customElements.define('e-spinner', ESpinner)
}
