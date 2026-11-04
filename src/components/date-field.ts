import { css } from 'lit'

import { EbTextField } from './text-field.ts'

/** Picks a day and submits it as YYYY-MM-DD. */
export class EbDateField extends EbTextField {
  // The calendar button inside a date input is a tab stop of its own, where the input has focus but
  // is not :focus-visible and Chromium rings the button with its default outline. The field keeps
  // the token ring through all its stops instead, and the button draws none of its own.
  static override styles = [
    EbTextField.styles,
    css`
      input:focus-within {
        outline: 2px solid var(--eb-color-focus);
        outline-offset: 2px;
      }
      input::-webkit-calendar-picker-indicator {
        outline: none;
      }
    `,
  ]

  protected override readonly inputType = 'date'
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-date-field': EbDateField
  }
}
