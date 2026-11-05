// e-choice-list: one pick from the <option> children written inside it. The script turns each option
// into a labelled native radio in its place, once, so the pick joins the form under the tag's name
// and the browser's own arrow keys, change and input work. The tag is the radiogroup, named by its
// label; a new label, as a page switching language sets, renames it after.
import { markError } from './field.ts'

let count = 0

/**
 * A choice list is one pick from a few visible options, as a group of radio buttons. Write each
 * choice as an `<option>`; the script turns it into a labelled radio.
 * @tag e-choice-list
 * @attr label - The group's name, shown above the choices.
 * @attr name - The name the pick has in its form.
 * @attr {boolean} disabled - No choice can be changed.
 * @attr error - A message shown under the group, which then reads invalid.
 * @slot - The `<option value>` elements to choose from; add `selected` to one to open on it, or `disabled` to stop one.
 */
export class EChoiceList extends HTMLElement {
  static observedAttributes = ['label', 'error']

  #label: HTMLElement | null = null

  get value(): string {
    return this.querySelector<HTMLInputElement>(':scope > label > input:checked')?.value ?? ''
  }

  set value(value: string) {
    for (const radio of this.querySelectorAll<HTMLInputElement>(':scope > label > input'))
      radio.checked = radio.value === value
  }

  connectedCallback(): void {
    if (this.#label) return
    const label = document.createElement('span')
    label.id = `e-choice-list-${++count}`
    label.dataset.part = 'label'
    this.#label = label
    this.setAttribute('role', 'radiogroup')
    this.setAttribute('aria-labelledby', label.id)
    const name = this.getAttribute('name') ?? label.id
    for (const option of this.querySelectorAll<HTMLOptionElement>(':scope > option')) {
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = name
      radio.value = option.value
      radio.checked = option.hasAttribute('selected')
      radio.disabled = this.hasAttribute('disabled') || option.disabled
      const row = document.createElement('label')
      row.append(radio, ...option.childNodes)
      option.replaceWith(row)
    }
    this.prepend(label)
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    if (!this.#label) return
    this.#label.textContent = this.getAttribute('label') ?? ''
    // The group is what reads invalid and is described by the message.
    markError(this, this)
  }
}

export function defineChoiceList(): void {
  if (!customElements.get('e-choice-list')) customElements.define('e-choice-list', EChoiceList)
}
