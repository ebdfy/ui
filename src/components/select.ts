import { css, html, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'

import { Field } from './field.ts'

// A pick from the <option> elements written inside it. With no value attribute it starts on the
// first option, as a native select does.
export class EbSelect extends Field {
  static override styles = [
    Field.styles,
    css`
      slot {
        display: none;
      }
    `,
  ]

  private options(): HTMLOptionElement[] {
    return [...this.querySelectorAll('option')]
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasAttribute('value')) this.value = this.options()[0]?.value ?? ''
  }

  override formResetCallback(): void {
    this.value = this.getAttribute('value') ?? this.options()[0]?.value ?? ''
  }

  // Once a person has picked an option, an option's selected attribute no longer moves the
  // selection, so the select is set to the value after each render, when its options exist.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    const select = this.control()
    if (select && select.value !== this.value) select.value = this.value
  }

  protected control(): HTMLSelectElement | null {
    return this.renderRoot.querySelector('select')
  }

  protected renderControl() {
    return html`<select
        id="control"
        class="control"
        ?disabled=${this.disabled}
        ?required=${this.required}
        aria-invalid=${this.error ? 'true' : 'false'}
        aria-describedby="error"
        @input=${(event: Event) => (this.value = this.textOf(event))}
        @change=${this.changed}
      >
        ${this.options().map(
          (option) =>
            html`<option value=${option.value} ?selected=${live(option.value === this.value)}>${option.text}</option>`,
        )}
      </select>
      <slot @slotchange=${() => this.requestUpdate()}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-select': EbSelect
  }
}
