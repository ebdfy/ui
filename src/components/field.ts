import { LitElement, css, html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit'

import type { Lang } from '../format.ts'
import { triangleAlert } from '../icons.ts'
import { focusRing } from '../tokens.ts'

/**
 * What every form field shares: it joins its form through ElementInternals, so FormData, reset,
 * disabled and validity work as they do for a native input. A subclass draws the control and keeps
 * `value` in step with it; the value attribute is the default a form reset goes back to.
 *
 * @csspart help - The help line under the control.
 * @csspart error - The error line under the control, with a red icon.
 * @fires change - The person changed the value. Bubbles, but is not composed.
 */
export abstract class Field extends LitElement {
  static formAssociated = true

  static override shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true }

  static override properties = {
    // Reflected, since a form-associated element submits under its name attribute. Left unset, it
    // writes no attribute.
    name: { type: String, reflect: true },
    value: { type: String },
    label: { type: String },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
    error: { type: String },
    help: { type: String },
  }

  static override styles: CSSResultGroup = [
    focusRing,
    css`
      :host {
        display: block;
        color: var(--eb-color-text);
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        line-height: var(--eb-line-height-body);
      }
      label {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
      }
      /* The edge is an inset ring, so the 2 px error edge moves nothing inside the control. */
      .control {
        box-sizing: border-box;
        width: 100%;
        min-height: var(--eb-size-control-md);
        padding: 0 12px;
        border: 0;
        border-radius: var(--eb-radius-field);
        background: var(--eb-color-surface);
        box-shadow: inset 0 0 0 1px var(--eb-color-control);
        color: inherit;
        font: inherit;
      }
      .control:hover {
        box-shadow: inset 0 0 0 1px var(--eb-color-text-3);
      }
      /* After the hover edge, so an invalid or disabled control keeps its own edge under the pointer. */
      .control[aria-invalid='true'] {
        box-shadow: inset 0 0 0 2px var(--eb-color-danger);
      }
      /* A locked surface rather than a fade. Chromium fades a disabled select to 0.7 on its own. */
      .control:disabled {
        background: var(--eb-color-surface-2);
        box-shadow: inset 0 0 0 1px var(--eb-color-divider);
        color: var(--eb-color-text-3);
        opacity: 1;
      }
      @media (max-width: 640px) {
        .control {
          min-height: var(--eb-size-control-lg);
        }
      }
      [part='help'],
      [part='error'] {
        margin: 4px 0 0;
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
      }
      [part='help'] {
        color: var(--eb-color-text-2);
      }
      [part='error'] {
        display: flex;
        gap: 4px;
        align-items: flex-start;
        color: var(--eb-color-danger-text);
      }
      /* 16 px, centred on the first 20 px line. */
      [part='error'] svg {
        flex: none;
        width: 16px;
        height: 16px;
        margin-top: 2px;
      }
    `,
  ]

  /** The name the form submits the value under. Unset, the field submits nothing. */
  declare name: string | undefined
  /** The current value. The value attribute is the default a form reset goes back to. */
  declare value: string
  /** The words above the control. */
  declare label: string
  /** Turns the field off: it cannot be edited or focused, and submits nothing. */
  declare disabled: boolean
  /** The field has to be filled in before the form is valid. */
  declare required: boolean
  /** Why the value is wrong. Shown under the control with a red edge. */
  declare error: string
  /** A hint shown under the control. */
  declare help: string

  protected readonly internals: ElementInternals

  constructor() {
    super()
    this.internals = this.attachInternals()
    this.value = ''
    this.label = ''
    this.disabled = false
    this.required = false
    this.error = ''
    this.help = ''
  }

  /** The form the field belongs to, or null. */
  get form(): HTMLFormElement | null {
    return this.internals.form
  }

  /** Whether the field's value passes its checks, as a native input's validity does. */
  get validity(): ValidityState {
    return this.internals.validity
  }

  /** Why the value fails its checks, or empty when it passes. */
  get validationMessage(): string {
    return this.internals.validationMessage
  }

  checkValidity(): boolean {
    return this.internals.checkValidity()
  }

  formResetCallback(): void {
    this.value = this.getAttribute('value') ?? ''
  }

  // The value the form submits: a string, or entries of their own for a field that submits several.
  protected formValue(): string | FormData | null {
    return this.value
  }

  // Why the value is invalid, or '' when it is valid.
  protected invalidMessage(): string {
    if (!this.required || this.value) return ''
    return this.language() === 'bn' ? 'এটি পূরণ করুন।' : 'Fill this in.'
  }

  // The element a browser points at when it reports the field invalid.
  protected abstract control(): HTMLElement | null

  protected abstract renderControl(): TemplateResult

  // The language of the field's text: its own lang, or the nearest one around it.
  protected language(): Lang {
    return this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn') ? 'bn' : 'en'
  }

  // The text of the control an input event came from.
  protected textOf(event: Event): string {
    // SAFETY: a field listens only on its own input, textarea or select, each of which has a value.
    return (event.target as HTMLInputElement).value
  }

  // A change on the inner control is not composed, so the field raises its own.
  protected changed(): void {
    this.dispatchEvent(new Event('change', { bubbles: true }))
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    this.internals.setFormValue(this.formValue())
    const message = this.invalidMessage()
    if (message) this.internals.setValidity({ customError: true }, message, this.control() ?? undefined)
    else this.internals.setValidity({})
  }

  // The ids of the help and error lines the control shows, help first, or undefined with neither, so
  // the control never names an element that is not there.
  protected describedBy(): string | undefined {
    const ids = [this.help && 'help', this.error && 'error'].filter(Boolean)
    return ids.length ? ids.join(' ') : undefined
  }

  protected helpLine() {
    return this.help ? html`<p part="help" id="help">${this.help}</p>` : nothing
  }

  protected errorLine(id: string, text: string) {
    return text ? html`<p part="error" id=${id}>${triangleAlert}${text}</p>` : nothing
  }

  override render() {
    return html`${this.label ? html`<label for="control">${this.label}</label>` : nothing}${this.renderControl()}${this.helpLine()}${this.errorLine('error', this.error)}`
  }
}
