import { css } from 'lit'

import { EbCheckbox } from './checkbox.ts'

// An on and off setting: a checkbox drawn as a track and a knob.
export class EbSwitch extends EbCheckbox {
  static override styles = [
    EbCheckbox.styles,
    css`
      .row {
        justify-content: space-between;
        flex-direction: row-reverse;
      }
      input {
        appearance: none;
        position: relative;
        width: 32px;
        height: 20px;
        border-radius: 10px;
        background: var(--eb-color-control);
        box-shadow: none;
        transition: background 0.15s;
      }
      input::before,
      input:checked::before {
        content: '';
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        clip-path: none;
        background: var(--eb-color-knob);
        box-shadow: var(--eb-shadow-1);
        transition: transform 0.15s;
      }
      input:checked {
        background: var(--eb-color-primary);
      }
      input:checked::before {
        background: var(--eb-color-on-primary);
        transform: translateX(12px);
      }
    `,
  ]

  protected override readonly role_ = 'switch'
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-switch': EbSwitch
  }
}
