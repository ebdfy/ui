// e-empty-state. Builds the h2 in the place the CSS heading was drawn, so nothing moves. A new
// heading, as a page switching language sets, goes to the h2.
/**
 * Fills a page or card that has nothing to show yet: a heading, a line of text and an action.
 * @tag e-empty-state
 * @attr heading - The title, built as its h2.
 * @attr icon - An icon from the kit's sprite to draw above the title, such as `cloud-off` for an error or `lock` for no access.
 * @slot - The line of text, in a `p`.
 * @slot action - The button or link that fixes the emptiness.
 */
export class EEmptyState extends HTMLElement {
  static observedAttributes = ['heading']

  connectedCallback(): void {
    const icon = this.getAttribute('icon')
    if (icon && !this.querySelector(':scope > e-icon[data-part="icon"]')) {
      const made = document.createElement('e-icon')
      made.dataset.part = 'icon'
      made.setAttribute('name', icon)
      made.setAttribute('aria-hidden', 'true')
      this.prepend(made)
    }
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
