// e-file-field: adopts the <input type="file" name> written inside the tag, so a form posts the file
// before the script and with it off. The script puts the input in one bordered row, behind a Choose
// file face, beside the chosen file's name, its size and, for a CSV, its row count. A file the page
// does not take, by its accept or its max-size, is refused under the field and the input emptied.
import { digits, type Lang } from '../format.ts'
import { langOf } from '../lang.ts'
import { discarded } from '../save-bar.ts'
import { markError } from './field.ts'
import { onLangChange } from './speech.ts'

const words = {
  en: {
    choose: 'Choose file',
    none: 'No file chosen',
    rows: (count: number) => `${digits(count, 'en')} ${count === 1 ? 'row' : 'rows'}`,
    kind: (kinds: string) => `Pick a ${kinds} file`,
    size: (most: string) => `Pick a file of at most ${most}`,
  },
  bn: {
    choose: 'ফাইল বাছাই করুন',
    none: 'কোনো ফাইল বাছাই হয়নি',
    rows: (count: number) => `${digits(count, 'bn')}টি সারি`,
    kind: (kinds: string) => `একটি ${kinds} ফাইল বাছাই করুন`,
    size: (most: string) => `সর্বোচ্চ ${most}-এর একটি ফাইল বাছাই করুন`,
  },
}

// A size in the units a person reads: 1.2 MB, 640 KB, 5 MB, counted in 1,024s as the API counts.
export function fileSize(bytes: number, lang: Lang): string {
  const [amount, unit] =
    bytes < 1024 ? [bytes, 'B'] : bytes < 1024 ** 2 ? [bytes / 1024, 'KB'] : [bytes / 1024 ** 2, 'MB']
  return `${digits(Math.round(amount * 10) / 10, lang)} ${unit}`
}

// The records of a CSV after its header line: a line break inside quotes is part of its field, a
// byte order mark is no data, and blank lines are no rows.
export function csvRows(text: string): number {
  let rows = 0
  let quoted = false
  let filled = false
  for (const char of text.replace(/^﻿/, '')) {
    if (char === '"') quoted = !quoted
    if (!quoted && (char === '\n' || char === '\r')) {
      if (filled) rows++
      filled = false
    } else filled = true
  }
  if (filled) rows++
  return Math.max(rows - 1, 0)
}

// Whether a file is of a kind the accept list names: an extension, a type, or a type/* family.
function accepted(file: File, accept: string): boolean {
  const kinds = accept
    .split(',')
    .map((kind) => kind.trim().toLowerCase())
    .filter(Boolean)
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return (
    !kinds.length ||
    kinds.some((kind) =>
      kind.startsWith('.')
        ? name.endsWith(kind)
        : kind.endsWith('/*')
          ? type.startsWith(kind.slice(0, -1))
          : type === kind,
    )
  )
}

let count = 0

/**
 * A file field picks one file to upload, such as a CSV of products. It shows the chosen file's name
 * and size, and a CSV's row count without its header line. Its native `<input type="file">`, written
 * inside, joins the form, which posts the file; with JavaScript off it shows as the browser draws it.
 * @tag e-file-field
 * @attr label - The label above the field.
 * @attr name - The name the file has in its form, given to a written input that has none.
 * @attr accept - The kinds of file the field takes, as a native input's accept, such as `.csv`. Another kind is refused under the field.
 * @attr {number} max-size - The largest file the field takes, in bytes; a larger one is refused under the field.
 * @attr error - A message shown under the field, which then reads invalid. Choosing a file clears it.
 * @slot - The field's own `<input type="file">`, written inside so the form posts it before the script.
 */
export class EFileField extends HTMLElement {
  static observedAttributes = ['label', 'error']

  #input: HTMLInputElement | null = null
  #label = document.createElement('label')
  #choose = document.createElement('span')
  #chosen = document.createElement('span')
  #stop: (() => void) | undefined
  // The last choice, so a count that ends after a newer choice is dropped.
  #turn = 0

  connectedCallback(): void {
    this.#stop = onLangChange(() => this.#draw())
    if (this.#input) return
    const input = this.querySelector<HTMLInputElement>(':scope > input[type="file"]') ?? document.createElement('input')
    input.type = 'file'
    for (const name of ['name', 'accept']) {
      const value = this.getAttribute(name)
      if (value !== null && !input.hasAttribute(name)) input.setAttribute(name, value)
    }
    input.id ||= `e-file-${++count}`
    this.#input = input
    const written = this.querySelector<HTMLLabelElement>(':scope > label')
    if (written) this.#label = written
    else this.#label.textContent = this.getAttribute('label') ?? ''
    this.#label.htmlFor = input.id
    const row = document.createElement('div')
    row.dataset.part = 'row'
    this.#choose.dataset.part = 'choose'
    this.#choose.setAttribute('aria-hidden', 'true')
    this.#chosen.dataset.part = 'chosen'
    row.append(input, this.#choose, this.#chosen)
    this.prepend(this.#label, row)
    markError(this, input)
    input.addEventListener('input', () => this.#check())
    input.form?.addEventListener(discarded, () => this.#draw())
    this.#draw()
  }

  disconnectedCallback(): void {
    this.#stop?.()
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.#input) return
    if (name === 'label' && !this.#label.isConnected) return
    if (name === 'label') this.#label.textContent = value ?? ''
    else markError(this, this.#input)
  }

  #check(): void {
    const input = this.#input!
    const file = input.files?.[0]
    const say = words[langOf(this)]
    const most = Number(this.getAttribute('max-size'))
    const accept = input.accept
    const refusal = !file
      ? null
      : !accepted(file, accept)
        ? say.kind(
            accept
              .split(',')
              .map((kind) => kind.trim())
              .join(', '),
          )
        : most > 0 && file.size > most
          ? say.size(fileSize(most, langOf(this)))
          : null
    // On the input's own input event, before the save bar hears it, so a refused file never counts.
    if (refusal) {
      input.value = ''
      this.setAttribute('error', refusal)
    } else this.removeAttribute('error')
    this.#draw()
  }

  #draw(): void {
    const lang = langOf(this)
    const say = words[lang]
    const file = this.#input?.files?.[0]
    const turn = ++this.#turn
    this.#choose.textContent = say.choose
    if (!file) {
      this.#chosen.replaceChildren(say.none)
      return
    }
    const name = document.createElement('strong')
    name.textContent = file.name
    const size = document.createElement('span')
    size.textContent = fileSize(file.size, lang)
    this.#chosen.replaceChildren(name, size)
    if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') return
    void file.text().then((text) => {
      if (turn !== this.#turn) return
      const rows = document.createElement('span')
      rows.textContent = say.rows(csvRows(text))
      this.#chosen.append(rows)
    })
  }
}

export function defineFileField(): void {
  if (!customElements.get('e-file-field')) customElements.define('e-file-field', EFileField)
}
