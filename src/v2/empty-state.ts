// e-empty-state. Builds the h2 in the place the CSS heading was drawn, so nothing moves. A new
// heading, as a page switching language sets, goes to the h2.
/**
 * Fills a page or card that has nothing to show yet: a heading, a line of text and an action.
 * @tag e-empty-state
 * @attr heading - The title, built as its h2.
 * @slot - The line of text, in a `p`.
 * @slot action - The button or link that fixes the emptiness.
 */
export class EEmptyState extends HTMLElement {
  static observedAttributes = ['heading']

  connectedCallback(): void {
    const heading = this.getAttribute('heading')
    if (heading === null || this.querySelector(':scope > h2[slot="heading"]')) return
    const h2 = document.createElement('h2')
    h2.slot = 'heading'
    h2.textContent = heading
    this.prepend(h2)
  }

  attributeChangedCallback(): void {
    const h2 = this.querySelector(':scope > h2[slot="heading"]')
    if (h2) h2.textContent = this.getAttribute('heading') ?? ''
  }
}

export function defineEmptyState(): void {
  if (!customElements.get('e-empty-state')) customElements.define('e-empty-state', EEmptyState)
}
