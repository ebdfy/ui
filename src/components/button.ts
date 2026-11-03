import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

import { focusRing } from '../tokens.ts'

export class EbButton extends LitElement {
  // Form-associated so a submit button finds the form around it through its internals.
  static formAssociated = true

  static override properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    type: { type: String },
    name: { type: String },
    value: { type: String },
    pressed: { type: String },
    fullWidth: { type: Boolean, attribute: 'full-width', reflect: true },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        display: inline-block;
        max-width: 100%;
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        line-height: var(--eb-line-height-body);
      }
      button {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        max-width: 100%;
        min-height: var(--eb-size-control-md);
        padding: 0 12px;
        border: 0;
        border-radius: var(--eb-radius-md);
        background: var(--eb-color-surface);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-edge),
          var(--eb-shadow-1);
        color: var(--eb-color-text);
        font: inherit;
        font-weight: var(--eb-font-weight-medium);
        text-align: center;
        cursor: pointer;
      }
      button:hover {
        background: var(--eb-color-surface-2);
      }
      /* Full width fills the host, which then fills its row, as two equal actions in a bar do. */
      :host([full-width]) {
        display: block;
      }
      :host([full-width]) button {
        width: 100%;
      }
      :host([size='sm']) button {
        min-height: var(--eb-size-control-sm);
        padding: 0 8px;
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
      }
      :host([size='lg']) button {
        min-height: var(--eb-size-control-lg);
        padding: 0 16px;
      }
      :host([variant='primary']) button {
        background: var(--eb-color-primary);
        box-shadow: var(--eb-shadow-button);
        color: var(--eb-color-on-primary);
      }
      :host([variant='primary']) button:hover {
        background: var(--eb-color-primary-hi);
      }
      :host([variant='ghost']) button {
        background: transparent;
        box-shadow: none;
        color: var(--eb-color-text-2);
      }
      :host([variant='ghost']) button:hover {
        background: var(--eb-color-surface-3);
        color: var(--eb-color-text);
      }
      :host([variant='danger']) button {
        background: var(--eb-color-danger);
        box-shadow: var(--eb-shadow-1);
        color: var(--eb-color-on-danger);
      }
      /* A phone is touched, so every size is a full tap target there. */
      @media (max-width: 640px) {
        button,
        :host([size]) button {
          min-height: var(--eb-size-target);
          font-size: var(--eb-font-size-body);
          line-height: var(--eb-line-height-body);
        }
      }
    `,
  ]

  declare variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  declare size: 'sm' | 'md' | 'lg'
  declare type: 'button' | 'submit'
  declare name: string | undefined
  declare value: string
  // A toggle button, such as the current filter, says 'true' or 'false'; any other button leaves it
  // unset and is not a toggle.
  declare pressed: 'true' | 'false' | undefined
  declare fullWidth: boolean

  private readonly internals: ElementInternals

  constructor() {
    super()
    this.internals = this.attachInternals()
    // On the host, so a field's Enter can press the button with click(), as on a native one.
    this.addEventListener('click', () => this.activate())
    this.variant = 'secondary'
    this.size = 'md'
    this.type = 'button'
    this.value = ''
    this.fullWidth = false
  }

  // The inner button lives in the shadow root, outside the form, so a submit button submits the
  // form itself. Its name=value pair rides along in a hidden input only for this one submit: the
  // form builds its entries inside requestSubmit, after checking validity.
  private activate(): void {
    const form = this.internals.form
    if (this.type !== 'submit' || !form) return
    const pair = this.name
      ? Object.assign(document.createElement('input'), { type: 'hidden', name: this.name, value: this.value })
      : null
    if (pair) form.append(pair)
    try {
      form.requestSubmit()
    } finally {
      pair?.remove()
    }
  }

  override render() {
    const pressed = this.pressed === 'true' || this.pressed === 'false' ? this.pressed : undefined
    return html`<button type="button" aria-pressed=${ifDefined(pressed)}><slot></slot></button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-button': EbButton
  }
}
