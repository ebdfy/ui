// e-taka-field: an amount in taka. The input shows ৳ and the amount in the digits of the field's
// language with lakh grouping, as typed while it has focus and grouped again once the person leaves
// it. A hidden input holds the plain Latin number under the tag's name: the form submits it, and the
// save bar keeps and restores it, so a page switching language changes only what is shown.
import { digits, phone as latin } from '../format.ts'
import { langOf } from '../lang.ts'
import { markError } from './field.ts'
import { onLangChange } from './speech.ts'

const own = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!

let count = 0

/**
 * A taka field takes an amount in taka. It shows ৳ and the amount in the digits of the page's
 * language with lakh grouping, and submits the plain Latin number under its name.
 * @tag e-taka-field
 * @attr label - The label above the field.
 * @attr name - The name the amount has in its form, held by a hidden input.
 * @attr value - The amount the field opens with, as a Latin number such as `12500`.
 * @attr error - A message shown under the field, which then reads invalid.
 */
export class ETakaField extends HTMLElement {
  static observedAttributes = ['label', 'error']

  #input: HTMLInputElement | null = null
  #amount: HTMLInputElement | null = null
  #stop: (() => void) | undefined

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#draw())
    if (this.#input) return
    const input = document.createElement('input')
    input.id = `e-taka-${++count}`
    input.inputMode = 'decimal'
    const label = document.createElement('label')
    label.htmlFor = input.id
    label.textContent = this.getAttribute('label') ?? ''
    const prefix = document.createElement('span')
    prefix.dataset.ePrefix = ''
    prefix.setAttribute('aria-hidden', 'true')
    prefix.textContent = '৳'

    const amount = document.createElement('input')
    amount.type = 'hidden'
    const name = this.getAttribute('name')
    if (name !== null) amount.name = name
    amount.value = this.getAttribute('value') ?? ''
    // Whatever sets the amount, as the save bar's Discard does, redraws the input, unless the input
    // itself set it as the person typed.
    let typing = false
    Object.defineProperty(amount, 'value', {
      get: () => own.get!.call(amount),
      set: (value: string) => {
        own.set!.call(amount, value)
        if (!typing) this.#draw()
      },
    })
    // The save bar hears edits from the named control only, so the amount tells it of each one.
    input.addEventListener('input', () => {
      typing = true
      amount.value = latin(input.value).replace(/[^\d.]/g, '')
      typing = false
      amount.dispatchEvent(new Event('input', { bubbles: true }))
    })
    input.addEventListener('change', () => amount.dispatchEvent(new Event('change', { bubbles: true })))
    input.addEventListener('blur', () => this.#draw())

    this.#input = input
    this.#amount = amount
    this.append(label, input, prefix, amount)
    this.#draw()
    markError(this, input)
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    const input = this.#input
    if (!input) return
    if (name === 'error') markError(this, input)
    else input.labels![0]!.textContent = value ?? ''
  }

  #draw(): void {
    const value = this.#amount!.value
    const amount = Number(value)
    this.#input!.value = value === '' || Number.isNaN(amount) ? value : digits(amount, langOf(this))
  }
}

export function defineTakaField(): void {
  if (!customElements.get('e-taka-field')) customElements.define('e-taka-field', ETakaField)
}
