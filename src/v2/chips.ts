// e-chips and e-chip. The script builds a × button on each removable chip, in the room v2.css kept for
// it. Inside a form, an e-chips with a name keeps one hidden field holding the chips' values, so the
// save bar counts a removed chip as an edit, and a value written back to the field, as Discard does,
// brings the removed chips back.
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

const words = {
  en: (chip: string) => `Remove ${chip}`,
  bn: (chip: string) => `${chip} সরান`,
}

// The input's own value property, which the field's override reads and writes through.
const native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
const read = (field: HTMLInputElement): string => native?.get?.call(field) ?? ''
const write = (field: HTMLInputElement, value: string) => native?.set?.call(field, value)

const valueOf = (chip: Element) => chip.getAttribute('value') ?? ''

/**
 * A row of chips, such as a customer's tags or a product's collections. It wraps, 8 px apart.
 * Inside a form, with a `name`, it keeps a hidden field of that name holding the chips' values joined
 * by commas, such as "facebook,repeat": the values present when it appeared in that order, then any
 * added later in page order, so a chip put back anywhere gives the same value again. A value must
 * not hold a comma. Writing the field's value, as the save bar's Discard does, removes the chips not
 * in it and brings back the removed ones in their places.
 * @tag e-chips
 * @attr name - The name of the field the chips' values are submitted under. Without it, or outside a form, there is no field.
 * @attr label - What the chips are, such as "Tags", read by a screen reader.
 * @slot - The `e-chip`s.
 * @fires e-remove - A chip's × was pressed and the chip removed. Bubbles; detail is `{ value }`, the chip's value.
 */
export class EChips extends HTMLElement {
  #built = false
  #field: HTMLInputElement | null = null
  // Each value's place when the row appeared.
  #rank = new Map<string, number>()
  // The removed chips, by value, ready to come back.
  #kept = new Map<string, Element>()
  #observer = new MutationObserver(() => this.#sync())

  connectedCallback(): void {
    this.#observer.observe(this, { childList: true })
    if (this.#built) return
    this.#built = true
    this.setAttribute('role', 'group')
    this.tabIndex = -1
    const label = this.getAttribute('label')
    if (label) this.setAttribute('aria-label', label)
    for (const [at, chip] of this.#chips().entries()) this.#rank.set(valueOf(chip), at)
    this.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('e-chip > button') : null
      if (button?.parentElement?.parentElement === this) this.#remove(button.parentElement)
    })
    const name = this.getAttribute('name')
    if (!name || !this.closest('form')) return
    // The field is in place with the opening value as the tag upgrades, so the save bar's first look
    // at the form, or its next one after a page change, records that value as the saved one.
    const field = document.createElement('input')
    field.type = 'hidden'
    field.name = name
    write(field, this.#value())
    Object.defineProperty(field, 'value', {
      configurable: true,
      get: () => read(field),
      set: (value: string) => {
        write(field, value)
        this.#follow(value)
      },
    })
    this.#field = field
    this.prepend(field)
  }

  disconnectedCallback(): void {
    this.#observer.disconnect()
  }

  #chips(): Element[] {
    return [...this.children].filter((child) => child.localName === 'e-chip')
  }

  #rankOf(value: string): number {
    return this.#rank.get(value) ?? this.#rank.size
  }

  #value(): string {
    return this.#chips()
      .map(valueOf)
      .sort((one, other) => this.#rankOf(one) - this.#rankOf(other))
      .join(',')
  }

  // Writes the chips' value to the field, and tells the save bar when it changed: a removed chip, or
  // one the app put back.
  #sync(): void {
    const field = this.#field
    if (!field || read(field) === this.#value()) return
    write(field, this.#value())
    field.dispatchEvent(new Event('input', { bubbles: true }))
  }

  #remove(chip: Element): void {
    const removable = this.#chips().filter((one) => one.querySelector(':scope > button'))
    const at = removable.indexOf(chip)
    const next = removable[at + 1] ?? removable[at - 1]
    this.#kept.set(valueOf(chip), chip)
    chip.remove()
    ;(next?.querySelector<HTMLElement>(':scope > button') ?? this).focus()
    this.#sync()
    this.dispatchEvent(new CustomEvent('e-remove', { bubbles: true, detail: { value: valueOf(chip) } }))
  }

  // Shows the chips a value written to the field names: the others go, and removed ones come back
  // before the first chip that stood after them.
  #follow(value: string): void {
    if (value === this.#value()) return
    const wanted = value ? value.split(',') : []
    for (const chip of this.#chips()) {
      if (wanted.includes(valueOf(chip))) continue
      this.#kept.set(valueOf(chip), chip)
      chip.remove()
    }
    for (const one of wanted) {
      const chip = this.#kept.get(one)
      if (!chip || this.#chips().some((shown) => valueOf(shown) === one)) continue
      this.#kept.delete(one)
      const after = this.#chips().find((shown) => this.#rankOf(valueOf(shown)) > this.#rankOf(one))
      this.insertBefore(chip, after ?? null)
    }
  }
}

/**
 * One chip: its text, and a × to remove it when `removable`.
 * @tag e-chip
 * @attr value - What the chip stands for, written to the row's field. No commas.
 * @attr {boolean} removable - The script adds a × that removes the chip, named "Remove" and the chip's text.
 * @slot - The chip's text.
 */
export class EChip extends HTMLElement {
  #button: HTMLButtonElement | null = null
  #stop: (() => void) | undefined

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#say())
    if (this.#button || !this.hasAttribute('removable')) return
    this.#button = document.createElement('button')
    this.#button.type = 'button'
    this.#button.innerHTML = '<e-icon name="x"></e-icon>'
    this.append(this.#button)
    this.#say()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  #say(): void {
    const text = [...this.childNodes]
      .filter((node) => node !== this.#button)
      .map((node) => node.textContent ?? '')
      .join('')
      .trim()
    this.#button?.setAttribute('aria-label', words[langOf(this)](text))
  }
}

export function defineChips(): void {
  if (!customElements.get('e-chips')) customElements.define('e-chips', EChips)
  if (!customElements.get('e-chip')) customElements.define('e-chip', EChip)
}
