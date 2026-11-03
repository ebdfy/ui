import { css, html, nothing } from 'lit'
import { live } from 'lit/directives/live.js'

import { Field } from './field.ts'

// One pick from the <option> elements written inside it, drawn as radio buttons.
export class EbChoiceList extends Field {
  static override styles = [
    Field.styles,
    css`
      fieldset {
        margin: 0;
        padding: 0;
        border: 0;
      }
      legend {
        padding: 0;
        margin-bottom: 4px;
        font-weight: 600;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: var(--eb-size-control-md);
        margin: 0;
        font-weight: 400;
        cursor: pointer;
      }
      @media (max-width: 640px) {
        .row {
          min-height: var(--eb-size-control-lg);
        }
      }
      input {
        appearance: none;
        flex: none;
        width: 16px;
        height: 16px;
        margin: 0;
        border-radius: 50%;
        background: var(--eb-color-surface);
        box-shadow: inset 0 0 0 1px var(--eb-color-control);
      }
      input:checked {
        background: var(--eb-color-on-primary);
        box-shadow: inset 0 0 0 5px var(--eb-color-primary);
      }
      slot {
        display: none;
      }
    `,
  ]

  private options(): HTMLOptionElement[] {
    return [...this.querySelectorAll('option')]
  }

  protected override formValue(): string | null {
    return this.value || null
  }

  protected control(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input')
  }

  protected renderControl() {
    return html`${this.options().map(
        (option) =>
          html`<label class="row"
            ><input
              type="radio"
              name="choice"
              value=${option.value}
              .checked=${live(option.value === this.value)}
              ?disabled=${this.disabled}
              @input=${() => (this.value = option.value)}
              @change=${this.changed}
            /><span>${option.text}</span></label
          >`,
      )}<slot @slotchange=${() => this.requestUpdate()}></slot>`
  }

  override render() {
    return html`<fieldset aria-describedby="error" aria-invalid=${this.error ? 'true' : 'false'}>
        ${this.label ? html`<legend>${this.label}</legend>` : nothing}${this.renderControl()}
      </fieldset>
      ${this.error ? html`<p part="error" id="error">${this.error}</p>` : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-choice-list': EbChoiceList
  }
}
