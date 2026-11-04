import { css, html } from 'lit'
import type { PropertyValues } from 'lit'

import { icons } from '../icons.ts'
import { EbTextField } from './text-field.ts'

/**
 * A search box. The save bar never counts it, even when it has a name. It draws a search icon at the
 * start of the control, and label-hidden keeps the label as the input's name without showing it, so
 * the box can sit in a toolbar row.
 */
export class EbSearchField extends EbTextField {
  static override properties = {
    ...EbTextField.properties,
    labelHidden: { type: Boolean, attribute: 'label-hidden', reflect: true },
  }

  static override styles = [
    EbTextField.styles,
    css`
      /* The standard clip technique: out of the layout and the eye, still the input's label. */
      :host([label-hidden]) label {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .search {
        position: relative;
      }
      .search svg {
        position: absolute;
        inset-inline-start: 12px;
        top: 50%;
        width: 16px;
        height: 16px;
        transform: translateY(-50%);
        color: var(--eb-color-text-3);
        pointer-events: none;
      }
      /* 12 px edge, 16 px icon and 8 px gap. */
      .search .control {
        padding-inline-start: 36px;
      }
    `,
  ]

  protected override readonly inputType = 'search'
  protected override readonly keyboard = 'search'

  /** Keeps the label as the input's name without showing it. */
  declare labelHidden: boolean

  constructor() {
    super()
    this.labelHidden = false
  }

  protected override renderControl() {
    return html`<div class="search">${icons.search}${super.renderControl()}</div>`
  }

  // With its label hidden, the empty box shows the label as its placeholder.
  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    const input = this.control()
    if (input) input.placeholder = this.labelHidden ? this.label : ''
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-search-field': EbSearchField
  }
}
