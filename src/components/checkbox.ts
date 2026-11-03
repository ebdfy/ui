import { css, html, nothing } from 'lit'
import { live } from 'lit/directives/live.js'

import { Field } from './field.ts'

// Submits its value, "on" unless it names one, only while checked. The checked attribute is the
// default a form reset goes back to.
export class EbCheckbox extends Field {
  static override properties = {
    ...Field.properties,
    checked: { type: Boolean },
    indeterminate: { type: Boolean, reflect: true },
    hideLabel: { type: Boolean, attribute: 'hide-label' },
  }

  static override styles = [
    Field.styles,
    css`
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
        position: relative;
        flex: none;
        width: 16px;
        height: 16px;
        margin: 0;
        border-radius: 4px;
        background: var(--eb-color-surface);
        box-shadow: inset 0 0 0 1px var(--eb-color-control);
      }
      input:checked,
      input:indeterminate {
        background: var(--eb-color-primary);
        box-shadow: none;
      }
      input::before {
        content: none;
        position: absolute;
        background: var(--eb-color-on-primary);
      }
      input:checked::before {
        content: '';
        top: 3px;
        left: 3px;
        width: 10px;
        height: 10px;
        clip-path: polygon(14% 52%, 0 66%, 38% 100%, 100% 22%, 86% 8%, 38% 72%);
      }
      /* A box that stands alone, such as a table row's, keeps its label for screen readers only. */
      .hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      input:indeterminate::before {
        content: '';
        top: 7px;
        left: 3px;
        width: 10px;
        height: 2px;
        clip-path: none;
      }
    `,
  ]

  declare checked: boolean
  declare indeterminate: boolean
  declare hideLabel: boolean

  // The switch draws the same input with another role.
  protected readonly role_: string | null = null

  constructor() {
    super()
    this.checked = false
    this.hideLabel = false
    this.indeterminate = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    if (!this.hasAttribute('value')) this.value = 'on'
  }

  override formResetCallback(): void {
    this.checked = this.hasAttribute('checked')
  }

  protected override formValue(): string | null {
    return this.checked ? this.value : null
  }

  protected override invalidMessage(): string {
    return this.required && !this.checked ? 'Tick this to go on.' : ''
  }

  private toggle = (event: Event): void => {
    // A click on a mixed box always ticks it. The native input would clear one that was also
    // checked underneath, so the mixed state wins over what the input reports.
    const mixed = this.indeterminate
    this.indeterminate = false
    // SAFETY: this listener sits only on the field's own checkbox input.
    this.checked = mixed || (event.target as HTMLInputElement).checked
  }

  protected control(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input')
  }

  protected renderControl() {
    return html`<input
      id="control"
      type="checkbox"
      role=${this.role_ ?? nothing}
      .checked=${live(this.checked)}
      .indeterminate=${live(this.indeterminate)}
      aria-checked=${this.indeterminate ? 'mixed' : nothing}
      ?disabled=${this.disabled}
      ?required=${this.required}
      aria-invalid=${this.error ? 'true' : 'false'}
      aria-describedby="error"
      @input=${this.toggle}
      @change=${this.changed}
    />`
  }

  override render() {
    return html`<label class="row"
        >${this.renderControl()}<span class=${this.hideLabel ? 'hidden' : ''}>${this.label}</span></label
      >${this.error ? html`<p part="error" id="error">${this.error}</p>` : nothing}`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-checkbox': EbCheckbox
  }
}
