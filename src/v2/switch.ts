// e-switch: an on or off setting. The script builds a native checkbox with role=switch inside the tag,
// once, so it joins its form (name=on while on, nothing while off) and its own change event bubbles
// out. name, value, checked and disabled give its first state; a new label renames it after.
import { markError } from './field.ts'

let count = 0

/**
 * A switch is a setting that is on or off and takes effect at once. Its native checkbox with
 * role=switch joins the form (submitting `on` while on, or its `value`, and nothing while off).
 * @tag e-switch
 * @attr label - The text beside the switch.
 * @attr name - The name the switch has in its form.
 * @attr value - What the form submits while the switch is on; the browser's `on` when left out.
 * @attr {boolean} checked - The switch opens on.
 * @attr {boolean} disabled - The switch cannot be changed and is left out of the form.
 * @attr error - A message shown under the switch, which then reads invalid.
 */
export class ESwitch extends HTMLElement {
  static observedAttributes = ['label', 'disabled', 'error']

  #input: HTMLInputElement | null = null

  get checked(): boolean {
    return this.#input ? this.#input.checked : this.hasAttribute('checked')
  }

  set checked(on: boolean) {
    if (this.#input) this.#input.checked = on
    else this.toggleAttribute('checked', on)
  }

  connectedCallback(): void {
    if (this.#input) return
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('role', 'switch')
    input.id = `e-switch-${++count}`
    for (const name of ['name', 'value']) {
      const value = this.getAttribute(name)
      if (value !== null) input.setAttribute(name, value)
    }
    input.checked = this.hasAttribute('checked')
    input.disabled = this.hasAttribute('disabled')
    const label = document.createElement('label')
    label.htmlFor = input.id
    label.textContent = this.getAttribute('label') ?? ''
    this.#input = input
    this.append(input, label)
    markError(this, input)
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const input = this.#input
    if (!input) return
    if (name === 'disabled') input.disabled = value !== null
    else if (name === 'error') markError(this, input)
    else input.labels![0]!.textContent = value ?? ''
  }
}

export function defineSwitch(): void {
  if (!customElements.get('e-switch')) customElements.define('e-switch', ESwitch)
}
