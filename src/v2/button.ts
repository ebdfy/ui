// e-button: builds the native <button> inside the tag, holding the tag's label, once. The tag's
// disabled, type and aria-label attributes stay the API and pass to the button; an icon button is
// named by its aria-label.
/**
 * A button runs one action. Use one primary button for the main action on a page or card.
 * @tag e-button
 * @attr {'primary' | 'plain'} tone - `primary` for the main action, `plain` for a quiet one; none for the default.
 * @attr {'sm' | 'lg'} size - Small or large; none for medium. Every size is 44 px tall on a phone.
 * @attr {boolean} disabled - Stops presses, and shows it.
 * @attr {'button' | 'submit' | 'reset'} type - What the button does in a form, as a native button's type.
 * @attr aria-label - Names a button that shows only an icon.
 * @attr {boolean} pressed - In an `e-button-group`, the chosen button.
 * @attr value - In an `e-button-group`, what `e-button-group-change` reports when this button is chosen.
 * @slot - The label, with an optional `e-icon` before it. A `<button>` written inside is used as it is.
 */
export class EButton extends HTMLElement {
  static observedAttributes = ['disabled', 'type', 'aria-label']

  #button: HTMLButtonElement | null = null

  connectedCallback(): void {
    if (!this.#button) {
      const button = this.querySelector<HTMLButtonElement>(':scope > button') ?? document.createElement('button')
      if (!button.isConnected) {
        button.append(...this.childNodes)
        this.append(button)
      }
      this.#button = button
    }
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    const button = this.#button
    if (!button) return
    button.disabled = this.hasAttribute('disabled')
    const type = this.getAttribute('type')
    if (type === 'button' || type === 'submit' || type === 'reset') button.type = type
    else button.removeAttribute('type')
    const name = this.getAttribute('aria-label')
    if (name === null) button.removeAttribute('aria-label')
    else button.setAttribute('aria-label', name)
  }
}

export function defineButton(): void {
  if (!customElements.get('e-button')) customElements.define('e-button', EButton)
}
