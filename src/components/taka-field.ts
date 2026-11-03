import { css, html } from 'lit'
import { live } from 'lit/directives/live.js'

import { digits, phone as latin } from '../format.ts'
import { Field } from './field.ts'

// An amount in taka. It submits the plain number and shows it after a ৳ prefix, with lakh grouping in
// the digits of its language. While it has focus its text is left as typed, so the caret and a selection hold,
// and it is grouped again once the person leaves it.
export class EbTakaField extends Field {
  static override properties = {
    ...Field.properties,
    editing: { state: true, attribute: false },
  }

  static override styles = [
    Field.styles,
    css`
      .affixed {
        position: relative;
      }
      [part='prefix'] {
        position: absolute;
        top: 0;
        bottom: 0;
        left: 12px;
        display: flex;
        align-items: center;
        color: var(--eb-color-text-3);
        pointer-events: none;
      }
      input.control {
        padding-left: 28px;
      }
    `,
  ]

  declare private editing: boolean

  constructor() {
    super()
    this.editing = false
  }

  private shown(): string {
    if (this.editing) return this.control()?.value ?? ''
    if (this.value === '' || Number.isNaN(Number(this.value))) return this.value
    return digits(Number(this.value), this.language())
  }

  protected control(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input')
  }

  protected renderControl() {
    return html`<div class="affixed">
      <span part="prefix" aria-hidden="true">৳</span
      ><input
        id="control"
        class="control"
        type="text"
        inputmode="decimal"
        .value=${live(this.shown())}
        ?disabled=${this.disabled}
        ?required=${this.required}
        aria-invalid=${this.error ? 'true' : 'false'}
        aria-describedby="error"
        @focus=${() => (this.editing = true)}
        @blur=${() => (this.editing = false)}
        @input=${(event: Event) => (this.value = latin(this.textOf(event)).replace(/[^\d.]/g, ''))}
        @change=${this.changed}
      />
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-taka-field': EbTakaField
  }
}
