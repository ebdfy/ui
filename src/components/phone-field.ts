import { phone } from '../format.ts'
import { EbTextField } from './text-field.ts'

const mobile = /^01\d{9}$/

/** Takes a Bangladesh mobile number: 11 digits starting with 01, kept in Latin digits whatever was typed. */
export class EbPhoneField extends EbTextField {
  protected override readonly inputType = 'tel'
  protected override readonly keyboard = 'tel'

  protected override parse(text: string): string {
    return phone(text).replace(/\D/g, '')
  }

  protected override invalidMessage(): string {
    if (this.value && !mobile.test(this.value)) return 'Enter an 11-digit phone starting with 01.'
    return super.invalidMessage()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-phone-field': EbPhoneField
  }
}
