// e-button-group: a row of e-buttons where one is chosen. The chosen one carries the `pressed`
// attribute (on the e-button, so markup and the app set it the way they set disabled). The script
// adds role=group with the label, keeps aria-pressed on each native button, moves `pressed` on a
// click and fires a bubbling e-button-group-change with the button's `value` in detail.
/**
 * A row of buttons where one is chosen, such as a language or a view. The chosen button carries `pressed`.
 * @tag e-button-group
 * @attr label - Names the group for assistive tech, as its aria-label.
 * @fires e-button-group-change - After a press on a button that was not chosen. Bubbles; `detail.value` is that e-button's `value` attribute, or null if it has none.
 * @slot - The `e-button` children. Mark the chosen one with `pressed`.
 */
export class EButtonGroup extends HTMLElement {
  static observedAttributes = ['label']

  // Only one is chosen, so a button the app marks pressed takes it from the others.
  #seen = new MutationObserver((records) => {
    for (const record of records) {
      const tag = record.target
      if (record.type !== 'attributes' || !(tag instanceof Element) || !tag.hasAttribute('pressed')) continue
      for (const other of this.#buttons()) if (other !== tag) other.removeAttribute('pressed')
    }
    this.#sync()
  })

  connectedCallback(): void {
    this.setAttribute('role', 'group')
    this.#label()
    this.#sync()
    this.addEventListener('click', this.#click)
    this.#seen.observe(this, {
      attributes: true,
      attributeFilter: ['pressed'],
      childList: true,
      subtree: true,
    })
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#click)
    this.#seen.disconnect()
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#label()
  }

  #label(): void {
    const label = this.getAttribute('label')
    if (label) this.setAttribute('aria-label', label)
  }

  #buttons(): Element[] {
    return [...this.querySelectorAll(':scope > e-button')]
  }

  #sync(): void {
    for (const tag of this.#buttons()) {
      // A tag whose native button is not built yet carries the state until the button appears.
      const native = tag.querySelector(':scope > button')
      if (native) tag.removeAttribute('aria-pressed')
      ;(native ?? tag).setAttribute('aria-pressed', String(tag.hasAttribute('pressed')))
    }
  }

  #click = (event: Event): void => {
    const tag = event.target instanceof Element ? event.target.closest('e-button') : null
    if (!tag || tag.parentElement !== this || tag.hasAttribute('pressed') || tag.hasAttribute('disabled')) return
    for (const other of this.#buttons()) other.toggleAttribute('pressed', other === tag)
    this.#sync()
    this.dispatchEvent(
      new CustomEvent('e-button-group-change', { bubbles: true, detail: { value: tag.getAttribute('value') } }),
    )
  }
}

export function defineButtonGroup(): void {
  if (!customElements.get('e-button-group')) customElements.define('e-button-group', EButtonGroup)
}
