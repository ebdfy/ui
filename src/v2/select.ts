// e-select: build the native <select> inside the tag, once, and move the tag's <option> children
// into it, so it joins its form and the browser's own change event bubbles out of the tag. name and
// disabled pass to the select. A new label, as a page switching language sets, renames it after.
import { markError } from './field.ts'

let count = 0

/**
 * A select picks one value from the `<option>` children written inside it. Its native `<select>` joins the form,
 * and the browser's own change event bubbles out of the tag.
 * @tag e-select
 * @attr label - The label above the select.
 * @attr name - The name the choice has in its form.
 * @attr {boolean} hide-label - Keep the label for screen readers only (its aria-label), with no visible label.
 * @attr {boolean} disabled - The select cannot be changed and is left out of the form.
 * @attr error - A message shown under the select, which then reads invalid.
 * @slot - The `<option>` elements to choose from; add `selected` to one to open on it.
 */
export class ESelect extends HTMLElement {
  static observedAttributes = ['label', 'disabled', 'error']

  #select: HTMLSelectElement | null = null

  get value(): string {
    return this.#select?.value ?? ''
  }

  set value(value: string) {
    if (this.#select) this.#select.value = value
  }

  connectedCallback(): void {
    if (this.#select) return
    const select = document.createElement('select')
    select.id = `e-select-${++count}`
    const name = this.getAttribute('name')
    if (name !== null) select.name = name
    select.disabled = this.hasAttribute('disabled')
    select.append(...this.querySelectorAll(':scope > option'))
    this.#select = select

    const label = this.getAttribute('label') ?? ''
    if (this.hasAttribute('hide-label')) {
      select.setAttribute('aria-label', label)
      this.append(select)
    } else {
      const text = document.createElement('label')
      text.htmlFor = select.id
      text.textContent = label
      this.append(text, select)
    }
    markError(this, select)
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const select = this.#select
    if (!select) return
    if (name === 'disabled') select.disabled = value !== null
    else if (name === 'error') markError(this, select)
    else if (this.hasAttribute('hide-label')) select.setAttribute('aria-label', value ?? '')
    else select.labels![0]!.textContent = value ?? ''
  }
}

export function defineSelect(): void {
  if (!customElements.get('e-select')) customElements.define('e-select', ESelect)
}
