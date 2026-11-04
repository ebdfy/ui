import { css, html, type PropertyValues } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { live } from 'lit/directives/live.js'

import { icons } from '../icons.ts'
import { Field } from './field.ts'

// A select drawn in Ink rather than by the browser: no native arrow, Ink's chevron-down 16 px at
// 12 px from the end, and room kept for it so a long option stops short. The district picker draws
// its district the same way.
export const selectStyles = css`
  .select {
    position: relative;
  }
  select.control {
    appearance: none;
    padding-right: 36px;
    text-overflow: ellipsis;
  }
  [part='chevron'] {
    position: absolute;
    top: 0;
    right: 12px;
    bottom: 0;
    width: 16px;
    height: 16px;
    margin: auto 0;
    color: var(--eb-color-text-2);
    pointer-events: none;
  }
  [part='chevron'] svg {
    display: block;
    width: 16px;
    height: 16px;
  }
  select:disabled + [part='chevron'] {
    color: var(--eb-color-text-3);
  }
`

export const chevron = html`<span part="chevron" aria-hidden="true">${icons['chevron-down']}</span>`

/**
 * A pick from the option elements written inside it. With no value attribute it starts on the
 * first option, as a native select does.
 *
 * @slot - The option elements to pick from.
 * @csspart chevron - The arrow at the end of the control.
 */
export class EbSelect extends Field {
  static override styles = [
    Field.styles,
    selectStyles,
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
    return html`<div class="select">
        <select
          id="control"
          class="control"
          ?disabled=${this.disabled}
          ?required=${this.required}
          aria-invalid=${this.error ? 'true' : 'false'}
          aria-describedby=${ifDefined(this.describedBy())}
          @input=${(event: Event) => (this.value = this.textOf(event))}
          @change=${this.changed}
        >
          ${this.options().map(
            (option) =>
              html`<option value=${option.value} ?selected=${live(option.value === this.value)}>
                ${option.text}
              </option>`,
          )}
        </select>
        ${chevron}
      </div>
      <slot @slotchange=${() => this.requestUpdate()}></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-select': EbSelect
  }
}
