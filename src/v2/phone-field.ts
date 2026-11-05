// e-phone-field: an e-text-field for a Bangladesh mobile number. Bangla digits turn Latin as they are
// typed, and the form refuses a number that is not 11 digits starting 01, showing why under the field
// in place of the browser's bubble.
import { phone } from '../format.ts'
import { langOf } from '../lang.ts'
import { EField } from './field.ts'

const mobile = /^01\d{9}$/

const own = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!

// A phone in Latin digits only, whatever digits or signs it was typed or given in.
const latin = (text: string) => phone(text).replace(/\D/g, '')

const message = {
  en: 'Enter an 11-digit number starting 01',
  bn: '01 দিয়ে শুরু ১১ অঙ্কের নম্বর লিখুন',
}

let count = 0

/**
 * A phone field takes a Bangladesh mobile number, 11 digits starting 01. Bangla digits turn Latin as
 * they are typed, and the form refuses any other number, saying why under the field in the page's language.
 * @tag e-phone-field
 * @attr label - The label above the field.
 * @attr name - The name the number has in its form.
 * @attr value - The number the field opens with; Bangla digits turn Latin.
 * @attr placeholder - A hint shown while the field is empty.
 * @attr {boolean} required - The form will not submit while the field is empty.
 * @attr autocomplete - What the browser may fill in, as a native input's autocomplete.
 * @attr error - A message shown under the field, which then reads invalid. A number that fails the check sets it.
 */
export class EPhoneField extends EField {
  protected build(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    if (!(input instanceof HTMLInputElement)) return
    input.type = 'tel'
    input.inputMode = 'tel'
    input.id = `e-phone-${++count}`
    const label = document.createElement('label')
    label.htmlFor = input.id
    label.textContent = text
    this.append(label, input)

    const check = () => {
      const valid = input.value === '' || mobile.test(input.value)
      input.setCustomValidity(valid ? '' : message[langOf(this)])
      return valid
    }
    // A number set without typing, as the markup, a script or the save bar's Discard gives one, turns
    // Latin and is checked again too.
    Object.defineProperty(input, 'value', {
      get: () => own.get!.call(input),
      set: (value: string) => {
        own.set!.call(input, latin(value))
        if (check()) this.removeAttribute('error')
      },
    })
    input.value = own.get!.call(input)
    // The caret stays after the digit just typed, wherever in the number that was.
    input.addEventListener('input', () => {
      const typed = own.get!.call(input)
      if (latin(typed) === typed) {
        if (check()) this.removeAttribute('error')
        return
      }
      const caret = latin(typed.slice(0, input.selectionStart ?? typed.length)).length
      input.value = typed
      input.setSelectionRange(caret, caret)
    })
    // The message shows under the field, so the browser's bubble stays away, and the first refused
    // field of the form takes focus, as the bubble would have given it.
    input.addEventListener('invalid', (event) => {
      event.preventDefault()
      this.setAttribute('error', input.validationMessage)
      if (input.form?.querySelector(':invalid') === input) input.focus()
    })
  }

  protected relabel(input: HTMLInputElement | HTMLTextAreaElement, text: string): void {
    const label = input.labels?.[0]
    if (label) label.textContent = text
  }
}

export function definePhoneField(): void {
  if (!customElements.get('e-phone-field')) customElements.define('e-phone-field', EPhoneField)
}
