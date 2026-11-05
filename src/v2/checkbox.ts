// e-checkbox: build the native <input type="checkbox"> inside the tag, once, so it joins its form
// and the browser's own change and input events bubble out of the tag. The tag's attributes are the
// API: name, value and disabled pass to the input, and `checked` and `indeterminate` give its first
// state. A new label, as a page switching language sets, renames the control after.
import { markError } from './field.ts'

let count = 0

/**
 * A checkbox is one yes or no choice. Its native `<input type="checkbox">` joins the form, and the
 * browser's own change event bubbles out of the tag.
 * @tag e-checkbox
 * @attr label - The text beside the box.
 * @attr name - The name the box has in its form.
 * @attr value - What the form submits while the box is ticked; the browser's `on` when left out.
 * @attr {boolean} checked - The box opens ticked.
 * @attr {boolean} indeterminate - The box shows a dash for a mixed state; ticking it ends the state.
 * @attr {boolean} disabled - The box cannot be changed and is left out of the form.
 * @attr {boolean} hide-label - Keep the label for screen readers only (its aria-label).
 * @attr error - A message shown under the box, which then reads invalid.
 */
export class ECheckbox extends HTMLElement {
  static observedAttributes = ['label', 'disabled', 'indeterminate', 'error']

  #input: HTMLInputElement | null = null

  get checked(): boolean {
    return this.#input ? this.#input.checked : this.hasAttribute('checked')
  }

  set checked(on: boolean) {
    if (this.#input) this.#input.checked = on
    else this.toggleAttribute('checked', on)
  }

  // The attribute mirrors the property, and attributeChangedCallback carries it to the input.
  get indeterminate(): boolean {
    return this.hasAttribute('indeterminate')
  }

  set indeterminate(on: boolean) {
    this.toggleAttribute('indeterminate', on)
  }

  connectedCallback(): void {
    if (this.#input) return
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.id = `e-checkbox-${++count}`
    for (const name of ['name', 'value']) {
      const value = this.getAttribute(name)
      if (value !== null) input.setAttribute(name, value)
    }
    input.disabled = this.hasAttribute('disabled')
    input.checked = this.hasAttribute('checked')
    this.#input = input
    this.#markMixed()
    // Ticking an indeterminate box ends it, and the browser has already cleared the property.
    input.addEventListener('change', () => {
      if (!input.indeterminate) this.removeAttribute('indeterminate')
    })
    // The tag is a phone's 44 px target around the 18 px box, so a tap on the tag ticks the box.
    this.addEventListener('click', (event) => {
      if (event.target === this) input.click()
    })

    const label = this.getAttribute('label') ?? ''
    if (this.hasAttribute('hide-label')) {
      input.setAttribute('aria-label', label)
      this.append(input)
    } else {
      const text = document.createElement('label')
      text.htmlFor = input.id
      text.textContent = label
      this.append(input, text)
    }
    markError(this, input)
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const input = this.#input
    if (!input) return
    if (name === 'label') {
      if (this.hasAttribute('hide-label')) input.setAttribute('aria-label', value ?? '')
      else input.labels![0]!.textContent = value ?? ''
    } else if (name === 'disabled') input.disabled = value !== null
    else if (name === 'error') markError(this, input)
    else this.#markMixed()
  }

  #markMixed(): void {
    const input = this.#input!
    input.indeterminate = this.hasAttribute('indeterminate')
    if (input.indeterminate) input.setAttribute('aria-checked', 'mixed')
    else input.removeAttribute('aria-checked')
  }
}

export function defineCheckbox(): void {
  if (!customElements.get('e-checkbox')) customElements.define('e-checkbox', ECheckbox)
}
