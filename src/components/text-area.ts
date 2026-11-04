import { css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { live } from 'lit/directives/live.js'

import { Field } from './field.ts'

/** Takes a few lines of text, such as a note on an order. A person can drag it taller. */
export class EbTextArea extends Field {
  static override styles = [
    Field.styles,
    css`
      textarea.control {
        display: block;
        min-height: 88px;
        padding: 10px 12px;
        resize: vertical;
      }
    `,
  ]

  protected control(): HTMLTextAreaElement | null {
    return this.renderRoot.querySelector('textarea')
  }

  protected renderControl() {
    return html`<textarea
      id="control"
      class="control"
      rows="3"
      .value=${live(this.value)}
      ?disabled=${this.disabled}
      ?required=${this.required}
      aria-invalid=${this.error ? 'true' : 'false'}
      aria-describedby=${ifDefined(this.describedBy())}
      @input=${(event: Event) => (this.value = this.textOf(event))}
      @change=${this.changed}
    ></textarea>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-text-area': EbTextArea
  }
}
