import { css } from 'lit'

import { EbCheckbox } from './checkbox.ts'

/** Turns a setting on or off. A checkbox drawn as a track and a knob. */
export class EbSwitch extends EbCheckbox {
  static override styles = [
    EbCheckbox.styles,
    css`
      /* The track sits beside its label; stretch spreads them to the two ends of a settings row. */
      :host([stretch]) .row {
        justify-content: space-between;
        flex-direction: row-reverse;
      }
      input {
        appearance: none;
        position: relative;
        width: 32px;
        height: 20px;
        border-radius: 10px;
        background: var(--eb-color-surface-3);
        box-shadow: inset 0 0 0 1px var(--eb-color-control);
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
      }
      input:checked {
        background: var(--eb-color-primary);
      }
      input:checked::before {
        background: var(--eb-color-on-primary);
        transform: translateX(12px);
      }
      /* The track and knob move over the fast duration; with reduced motion they switch at once. */
      @media (prefers-reduced-motion: no-preference) {
        input {
          transition: background var(--eb-duration-fast) var(--eb-ease-out);
        }
        input::before {
          transition: transform var(--eb-duration-fast) var(--eb-ease-out);
        }
      }
    `,
  ]

  static override properties = {
    ...EbCheckbox.properties,
    stretch: { type: Boolean, reflect: true },
  }

  /** Puts the label at the start of a settings row and the track at the end. */
  declare stretch: boolean

  constructor() {
    super()
    this.stretch = false
  }

  protected override readonly role_ = 'switch'
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-switch': EbSwitch
  }
}
