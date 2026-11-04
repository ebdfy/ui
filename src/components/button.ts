import { LitElement, css, html, nothing } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

import { focusRing } from '../tokens.ts'

/**
 * Runs an action: primary for the one main action of a card, secondary for the rest, ghost or danger.
 *
 * @slot - The words of the button.
 * @slot icon - An icon before the words, or alone with icon-only.
 * @csspart spinner - The ring shown while the button is loading.
 */
export class EbButton extends LitElement {
  // Form-associated so a submit button finds the form around it through its internals.
  static formAssociated = true

  static override properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    type: { type: String },
    name: { type: String },
    value: { type: String },
    pressed: { type: String, reflect: true },
    fullWidth: { type: Boolean, attribute: 'full-width', reflect: true },
    iconOnly: { type: Boolean, attribute: 'icon-only', reflect: true },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
    loading: { type: Boolean, reflect: true },
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
        gap: 6px;
        max-width: 100%;
        /* In a bottom bar that fills its row on a phone, the button fills its share. */
        min-width: calc(var(--eb-bar-fill, 0) * 100%);
        min-height: var(--eb-size-control-md);
        /* The block padding keeps a label that wraps off the top and bottom edges. */
        padding: 6px 12px;
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
        padding: 4px 8px;
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
      }
      :host([size='lg']) button {
        min-height: var(--eb-size-control-lg);
        padding: 6px 16px;
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
      :host([variant='danger']) button:hover {
        background: var(--eb-color-danger-hi);
      }
      /* Held down, or a toggle that is on, the fill goes a step deeper than hover. */
      button:active,
      :host([pressed='true']) button {
        background: var(--eb-color-surface-3);
      }
      :host([variant='ghost']) button:active,
      :host([variant='ghost'][pressed='true']) button {
        background: var(--eb-color-divider);
        color: var(--eb-color-text);
      }
      :host([variant='primary']) button:active,
      :host([variant='primary'][pressed='true']) button {
        background: var(--eb-color-primary-lo);
      }
      :host([variant='danger']) button:active,
      :host([variant='danger'][pressed='true']) button {
        background: var(--eb-color-danger-lo);
      }
      ::slotted(eb-icon[slot='icon']) {
        flex: none;
      }
      /* Icon only: a square as tall as the control, named by its label. */
      :host([icon-only]) button {
        width: var(--eb-size-control-md);
        padding: 0;
      }
      :host([icon-only]) .label {
        display: none;
      }
      :host([icon-only][size='sm']) button {
        width: var(--eb-size-control-sm);
      }
      :host([icon-only][size='lg']) button {
        width: var(--eb-size-control-lg);
      }
      /* A segment of a segmented group: flat on the group's track until pressed, then raised on the
         surface. 24 px, so the track around it is 28. */
      :host([segment]) button {
        min-height: 24px;
        padding: 2px 10px;
        border-radius: var(--eb-radius-sm);
        background: transparent;
        box-shadow: none;
        color: var(--eb-color-text-2);
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
      }
      :host([segment]) button:hover {
        background: transparent;
        color: var(--eb-color-text);
      }
      :host([segment][pressed='true']) button {
        background: var(--eb-color-surface);
        box-shadow: var(--eb-shadow-1);
        color: var(--eb-color-text);
      }
      /* Disabled reads as locked in every variant: quiet text on the second surface. */
      :host([disabled]) button[disabled] {
        background: var(--eb-color-surface-2);
        box-shadow: inset 0 0 0 1px var(--eb-color-divider);
        color: var(--eb-color-text-3);
        cursor: not-allowed;
      }
      /* Loading hides the label but keeps its room, so the button holds its width under the spinner. */
      button {
        position: relative;
      }
      :host([loading]) button {
        cursor: progress;
      }
      :host([loading]) .label,
      :host([loading]) ::slotted([slot='icon']) {
        visibility: hidden;
      }
      [part='spinner'] {
        position: absolute;
        inset: 0;
        width: 16px;
        height: 16px;
        margin: auto;
        box-sizing: border-box;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: turn 1s linear infinite;
      }
      @keyframes turn {
        to {
          transform: rotate(360deg);
        }
      }
      /* A phone is touched, so every size is a full tap target there. */
      @media (max-width: 640px) {
        button,
        :host([size]) button {
          min-height: var(--eb-size-target);
          padding-block: 6px;
          font-size: var(--eb-font-size-body);
          line-height: var(--eb-line-height-body);
        }
        :host([segment]) button {
          min-height: 40px;
          padding-block: 2px;
        }
        :host([icon-only]) button,
        :host([icon-only][size]) button {
          width: var(--eb-size-target);
          padding: 0;
        }
      }
    `,
  ]

  /** The look: primary, secondary, ghost or danger. Secondary when unset. */
  declare variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** The height: sm, md or lg. Md when unset. */
  declare size: 'sm' | 'md' | 'lg'
  /** Button, or submit to submit the form around it. Button when unset. */
  declare type: 'button' | 'submit'
  /** With value, the pair a submit button adds to its form's entries. */
  declare name: string | undefined
  /** With name, the pair a submit button adds to its form's entries. */
  declare value: string
  /** A toggle button, such as the current filter, says 'true' or 'false'; any other button leaves it unset and is not a toggle. */
  declare pressed: 'true' | 'false' | undefined
  /** Fills the width of its row instead of the width of its label. */
  declare fullWidth: boolean
  /** A square button that shows only its slotted icon; label is then its accessible name. */
  declare iconOnly: boolean
  /** The accessible name, for a button whose words are not enough, such as an icon-only one. */
  declare label: string | undefined
  /** Turns the button off: it cannot be pressed or focused. */
  declare disabled: boolean
  /** Busy with the action it started, such as a save. It keeps its focus, so a keyboard user stays put. */
  declare loading: boolean

  private readonly internals: ElementInternals

  constructor() {
    super()
    this.internals = this.attachInternals()
    // On the host, so a field's Enter can press the button with click(), as on a native one.
    // A disabled or loading button swallows every click, the host's own click() too, before an app's
    // listener on the host or above it hears one.
    // In the capture phase, so it runs before an app's own listener on the host.
    this.addEventListener(
      'click',
      (event) => {
        if (!this.disabled && !this.loading) return
        event.preventDefault()
        event.stopImmediatePropagation()
      },
      { capture: true },
    )
    this.addEventListener('click', () => this.activate())
    this.variant = 'secondary'
    this.size = 'md'
    this.type = 'button'
    this.value = ''
    this.fullWidth = false
    this.iconOnly = false
    this.disabled = false
    this.loading = false
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
    // A loading button hides its words under the spinner, which takes them out of its name, so they
    // name it through aria-label instead.
    return html`<button
      type="button"
      aria-pressed=${ifDefined(pressed)}
      aria-label=${ifDefined(this.label || (this.loading ? this.textContent?.trim() : undefined) || undefined)}
      ?disabled=${this.disabled}
      aria-disabled=${ifDefined(this.loading ? 'true' : undefined)}
      aria-busy=${ifDefined(this.loading ? 'true' : undefined)}
    >
      <slot name="icon"></slot
      ><span class="label"><slot></slot></span
      >${this.loading ? html`<span part="spinner" aria-hidden="true"></span>` : nothing}
    </button>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-button': EbButton
  }
}
