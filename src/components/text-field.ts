import { html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'
import { live } from 'lit/directives/live.js'

import { Field } from './field.ts'

// The native inputs that take typed text, which block Enter from submitting a form with several.
const TYPED = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'date'])

/** Takes a line of text, such as a name or an email address. It joins its form like a native input. */
export class EbTextField extends Field {
  static override properties = {
    ...Field.properties,
    type: { type: String },
    autocomplete: { type: String },
  }

  // A subclass that is an input of another type or keyboard names it here.
  protected readonly inputType: string = 'text'
  protected readonly keyboard: string = 'text'

  /** The kind of text: text, email or password. Text when unset. */
  declare type: 'text' | 'email' | 'password'
  /** What a browser may fill in, as the autocomplete attribute of a native input says. */
  declare autocomplete: string | undefined

  constructor() {
    super()
    this.type = 'text'
  }

  // Enter submits the form as a native text input does: through the form's first submit button, or,
  // with none, only when this is the form's one text field, so Enter in a save-bar form saves
  // nothing. Not while an input method is still composing, since Enter there picks the composed text.
  private submitOnEnter(event: KeyboardEvent): void {
    const form = this.form
    if (event.key !== 'Enter' || event.isComposing || !form) return
    const elements = [...form.elements]
    const button = elements.find((el) => el.getAttribute('type') === 'submit' || el.matches('button:not([type])'))
    if (button instanceof HTMLElement) return button.click()
    const fields = elements.filter(
      (el) => el instanceof EbTextField || (el instanceof HTMLInputElement && TYPED.has(el.type)),
    )
    if (fields.length === 1) form.requestSubmit()
  }

  // How typed text becomes the value, for a subclass that cleans it up.
  protected parse(text: string): string {
    return text
  }

  protected control(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input')
  }

  protected renderControl() {
    // The type attribute picks the input of a plain text field. A subclass's own input type wins.
    const type = this.inputType === 'text' ? this.type : this.inputType
    return html`<input
      id="control"
      class="control"
      type=${type}
      inputmode=${type === 'email' ? 'email' : this.keyboard}
      autocomplete=${ifDefined(this.autocomplete)}
      .value=${live(this.value)}
      ?disabled=${this.disabled}
      ?required=${this.required}
      aria-invalid=${this.error ? 'true' : 'false'}
      aria-describedby=${ifDefined(this.describedBy())}
      @input=${(event: Event) => (this.value = this.parse(this.textOf(event)))}
      @change=${this.changed}
      @keydown=${this.submitOnEnter}
    />`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-text-field': EbTextField
  }
}
