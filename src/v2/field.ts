// e-text-field, e-text-area and e-search-field: build the native <input name> or <textarea name>
// inside the tag, once, so it joins its form, or adopt the one written inside it, so a form shows its
// fields and posts before the script and with it off. The tag's attributes are the API; they pass to
// the control when it is built, or fill what a written one leaves out, and a new label or placeholder,
// as a page switching language sets, passes on after. An error attribute shows its message under the
// control, and goes when the person types in it.
import type { Lang } from '../format.ts'
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

const passed = ['name', 'value', 'placeholder', 'type', 'inputmode', 'required', 'autocomplete', 'rows']

let count = 0

// Shows the tag's error attribute as a line under the control, which reads invalid and is described
// by it; without the attribute, neither. Each v2 field calls it as it builds and as error changes.
export function markError(tag: Element, control: Element): void {
  const message = tag.getAttribute('error')
  let line = tag.querySelector<HTMLElement>(':scope > [data-e-error]')
  if (!message) {
    line?.remove()
    control.removeAttribute('aria-invalid')
    control.removeAttribute('aria-describedby')
    return
  }
  if (!line) {
    line = document.createElement('p')
    line.dataset.eError = ''
    line.id = `e-error-${++count}`
    tag.append(line)
  }
  line.textContent = message
  control.setAttribute('aria-invalid', 'true')
  control.setAttribute('aria-describedby', line.id)
}

type Control = HTMLInputElement | HTMLTextAreaElement

/**
 * @attr label - The label above the field.
 * @attr name - The name the field's value has in its form.
 * @attr value - The value the field opens with.
 * @attr placeholder - A hint shown while the field is empty.
 * @attr {boolean} required - The form will not submit while the field is empty.
 * @attr autocomplete - What the browser may fill in, as a native input's autocomplete.
 * @attr error - A message shown under the field, which then reads invalid. Typing in the field clears it.
 * @slot - Optional: the field's own `<input>` (or `<textarea>`), written inside so the form works before
 *   the script. The script adopts it; the tag's attributes fill only what it leaves out.
 */
export abstract class EField extends HTMLElement {
  static observedAttributes = ['label', 'placeholder', 'error']

  #input: Control | null = null

  get value(): string {
    return this.#input?.value ?? this.getAttribute('value') ?? ''
  }

  set value(value: string) {
    if (this.#input) this.#input.value = value
    else this.setAttribute('value', value)
  }

  connectedCallback(): void {
    if (this.#input) return
    const made = this.create()
    const written = this.querySelector<Control>(`:scope > ${made.localName}`)
    const input = written ?? made
    for (const name of passed) {
      const value = this.getAttribute(name)
      // A textarea holds its value as text, and has no type; a written control keeps its own.
      if (value === null || (input instanceof HTMLTextAreaElement && name === 'type')) continue
      if (written && (input.hasAttribute(name) || (name === 'value' && input instanceof HTMLTextAreaElement))) continue
      if (input instanceof HTMLTextAreaElement && name === 'value') input.value = value
      else input.setAttribute(name, value)
    }
    this.#input = input
    this.build(input, this.getAttribute('label') ?? '')
    markError(this, input)
    // Typing corrects the field, so its error goes; a script setting the value is no correction.
    input.addEventListener('input', (event) => {
      if (event.isTrusted) this.removeAttribute('error')
    })
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const input = this.#input
    if (!input) return
    if (name === 'label') this.relabel(input, value ?? '')
    else if (name === 'error') markError(this, input)
    else if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }

  protected create(): Control {
    return document.createElement('input')
  }

  protected abstract build(input: Control, label: string): void
  protected abstract relabel(input: Control, label: string): void
}

/**
 * A text field takes one line of text. Its native `<input>` joins the form it sits in.
 * @tag e-text-field
 * @attr type - The kind of text, as a native input's type: `email`, `tel`, `url`, `password`; none for text.
 * @attr inputmode - The keyboard a phone shows, as a native input's inputmode.
 */
export class ETextField extends EField {
  protected build(input: Control, text: string): void {
    // A written input keeps its id, and a written label stays the one label naming it.
    if (!input.id) input.id = `e-field-${++count}`
    const written = this.querySelector<HTMLLabelElement>(':scope > label')
    if (written) {
      written.htmlFor = input.id
      return
    }
    const label = document.createElement('label')
    label.htmlFor = input.id
    label.textContent = text
    // A written input stays where it is, so it is the same element the page holds.
    if (input.parentElement === this) input.before(label)
    else this.append(label, input)
  }

  protected relabel(input: Control, text: string): void {
    const label = input.labels?.[0]
    if (label) label.textContent = text
  }
}

const months = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
}

// Bangla digits are U+09E6 to U+09EF, in order; a year takes no grouping.
const bangla = (text: string) => text.replace(/\d/g, (d) => String.fromCharCode(0x09e6 + Number(d)))

// A YYYY-MM-DD day as people here write it, day month year: "1 Nov 2026", "১ নভেম্বর ২০২৬".
export function day(value: string, lang: Lang): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!parts) return ''
  const text = `${Number(parts[3])} ${months[lang][Number(parts[2]) - 1]} ${parts[1]}`
  return lang === 'bn' ? bangla(text) : text
}

const own = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!

/**
 * A date field picks a day. It reads day month year in the page's language, "1 Nov 2026", over the
 * browser's own `<input type="date">`, which joins the form and opens the calendar on a press.
 * @tag e-date-field
 * @attr label - The label above the field.
 * @attr name - The name the field's value has in its form.
 * @attr value - The day the field opens with, as `YYYY-MM-DD`; the form submits it the same way.
 * @attr type - Leave it out: the field is always a date, and a type here would change that.
 * @attr {boolean} required - The form will not submit while no day is picked.
 * @attr error - A message shown under the field, which then reads invalid.
 */
export class EDateField extends ETextField {
  #stop: (() => void) | undefined
  #draw: (() => void) | undefined

  protected override create(): Control {
    const input = document.createElement('input')
    input.type = 'date'
    return input
  }

  protected override build(input: Control, text: string): void {
    super.build(input, text)
    if (!(input instanceof HTMLInputElement)) return
    input.type = 'date'
    const shown = document.createElement('span')
    shown.dataset.eDate = ''
    shown.setAttribute('aria-hidden', 'true')
    input.after(shown)
    const draw = () => {
      shown.textContent = day(own.get!.call(input), langOf(this))
    }
    this.#draw = draw
    // A day set without a pick, as a script or the save bar's Discard sets one, reads afresh too.
    Object.defineProperty(input, 'value', {
      get: () => own.get!.call(input),
      set: (value: string) => {
        own.set!.call(input, value)
        draw()
      },
    })
    input.addEventListener('input', draw)
    input.addEventListener('change', draw)
    // A press anywhere on the box opens the calendar, not only on its icon.
    input.addEventListener('click', () => {
      try {
        input.showPicker()
      } catch {}
    })
    draw()
  }

  // The day follows a switch of the page's language while the field is in the page.
  override connectedCallback(): void {
    super.connectedCallback()
    const draw = this.#draw
    if (draw && !this.#stop) this.#stop = onLangChange(draw)
  }

  disconnectedCallback(): void {
    this.#stop?.()
    this.#stop = undefined
  }
}

/**
 * A text area takes several lines of text. Its native `<textarea>` joins the form, and the tag's
 * `value` is the text it opens with.
 * @tag e-text-area
 * @attr label - The label above the field.
 * @attr name - The name the field's value has in its form.
 * @attr value - The text the field opens with.
 * @attr placeholder - A hint shown while the field is empty.
 * @attr type - Has no effect: a text area takes no type.
 * @attr inputmode - The keyboard a phone shows, as a native textarea's inputmode.
 * @attr {boolean} required - The form will not submit while the field is empty.
 * @attr autocomplete - What the browser may fill in, as a native textarea's autocomplete.
 * @attr {number} rows - How many lines the field opens tall; 4 when left out.
 * @attr error - A message shown under the field, which then reads invalid.
 */
export class ETextArea extends ETextField {
  protected override create(): Control {
    return document.createElement('textarea')
  }
}

/**
 * A search field is a one-line box with a search icon. It has no visible label: `label` is the
 * name a screen reader speaks, so write it as you would the hint.
 * @tag e-search-field
 * @attr label - The input's accessible name (its aria-label); nothing shows it on screen.
 * @attr name - The name the field's value has in its form.
 * @attr value - The text the field opens with.
 * @attr placeholder - A hint shown while the field is empty.
 * @attr {boolean} required - The form will not submit while the field is empty.
 * @attr autocomplete - What the browser may fill in, as a native input's autocomplete.
 * @attr inputmode - The keyboard a phone shows, as a native input's inputmode.
 * @attr error - A message shown under the field, which then reads invalid.
 */
export class ESearchField extends EField {
  protected build(input: Control, label: string): void {
    if (input instanceof HTMLInputElement) input.type = 'search'
    input.setAttribute('aria-label', label)
    const icon = document.createElement('e-icon')
    icon.setAttribute('name', 'search')
    if (input.parentElement === this) input.before(icon)
    else this.append(icon, input)
  }

  protected relabel(input: Control, label: string): void {
    input.setAttribute('aria-label', label)
  }
}

export function defineFields(): void {
  if (!customElements.get('e-text-field')) customElements.define('e-text-field', ETextField)
  if (!customElements.get('e-date-field')) customElements.define('e-date-field', EDateField)
  if (!customElements.get('e-text-area')) customElements.define('e-text-area', ETextArea)
  if (!customElements.get('e-search-field')) customElements.define('e-search-field', ESearchField)
}
