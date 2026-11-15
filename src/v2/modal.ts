// e-modal: builds one native <dialog> inside the tag, holding a header (the heading and a close
// button), the tag's content and a footer for the children marked slot="footer". It stays in the
// app's page, so the app's script and listeners keep working. Open and close fire bubbling
// e-modal-open and e-modal-close events, whichever way it closes.
//
// A <form data-save-bar> inside it saves from the modal's footer, never the Admin's bar: while a
// named field differs from its saved value, Discard and Save take the place of the footer's own
// buttons, and a way out (Escape or the close button) first asks whether to close without saving.
import { words } from '../host-rules.ts'
import { watchSaveBars } from '../save-bar.ts'

type State = 'clean' | 'edited' | 'asking'

const say = () => words[document.documentElement.lang.startsWith('bn') ? 'bn' : 'en']

function button(part: string, tone?: 'primary'): HTMLElement {
  const made = document.createElement('e-button')
  made.setAttribute('type', 'button')
  made.dataset.part = part
  if (tone) made.setAttribute('tone', tone)
  return made
}

// An e-button's label sits in the native button it built.
function label(made: HTMLElement, text: string): void {
  ;(made.querySelector(':scope > button') ?? made).textContent = text
}

/**
 * A dialog that holds a task until the person closes it. It is closed on the page; open it with
 * `ebdfy.modal.show(id)` and close it with `ebdfy.modal.hide(id)`, naming the modal's `id`.
 * @tag e-modal
 * @attr heading - The title in the header.
 * @attr {'small' | 'large'} size - A narrower or wider dialog; none for medium. On a phone every size is a sheet at the bottom.
 * @attr {'420' | '560' | '720'} width - The dialog's width in px: 420 for a question, 560 for a short form, 720 for a table. It wins over size.
 * @fires e-modal-open - After the modal opens. Bubbles; detail is empty.
 * @fires e-modal-close - After the modal closes, by whatever way. Bubbles; detail is empty.
 * @slot - The modal's content.
 * @slot footer - Buttons in the footer.
 */
export class EModal extends HTMLElement {
  static observedAttributes = ['heading']

  #dialog: HTMLDialogElement | null = null
  #title = document.createElement('h2')
  #close = document.createElement('button')
  #footer = document.createElement('footer')
  #own: Element[] = []
  #state: State = 'clean'
  // The footer's save bar and its ask, built once and worded as they show.
  #discard = button('discard')
  #save = button('save', 'primary')
  #ask = document.createElement('p')
  #keepEditing = button('keep-editing')
  #closeAnyway = button('close-anyway', 'primary')
  #bar: ReturnType<typeof watchSaveBars> | null = null

  connectedCallback(): void {
    if (this.#dialog) return
    const dialog = document.createElement('dialog')
    const header = document.createElement('header')
    this.#title.id = `${this.id || 'e-modal'}-heading-${Math.random().toString(36).slice(2, 8)}`
    this.#close.type = 'button'
    this.#close.textContent = '×'
    this.#close.addEventListener('click', () => this.#leave())
    header.append(this.#title, this.#close)
    const body = document.createElement('div')
    this.#own = [...this.children].filter((child) => child.getAttribute('slot') === 'footer')
    this.#ask.dataset.part = 'ask'
    this.#footer.append(...this.#own, this.#ask, this.#keepEditing, this.#closeAnyway, this.#discard, this.#save)
    body.append(...this.childNodes)
    dialog.append(header, body, this.#footer)
    dialog.setAttribute('aria-labelledby', this.#title.id)
    // Escape asks first while there are edits. Chromium lets a page hold Escape back once per press
    // of another key, so a second Escape in a row closes the modal, and the edits go as they would.
    dialog.addEventListener('cancel', (event) => {
      if (this.#state === 'clean') return
      event.preventDefault()
      this.#show('asking')
    })
    // Chromium fires close for every way out, so one listener tells the page.
    dialog.addEventListener('close', () => {
      if (this.#state !== 'clean') this.#bar?.act('discard')
      this.dispatchEvent(new CustomEvent('e-modal-close', { bubbles: true }))
    })
    this.#discard.addEventListener('click', () => this.#bar?.act('discard'))
    this.#save.addEventListener('click', () => this.#bar?.act('save'))
    this.#keepEditing.addEventListener('click', () => this.#show('edited'))
    // The edits go before the dialog closes, so a page that reads its fields as it hides finds them
    // put back; the close event, a task later, then finds nothing left to discard.
    this.#closeAnyway.addEventListener('click', () => {
      this.#bar?.act('discard')
      dialog.close()
    })
    this.append(dialog)
    this.#dialog = dialog
    this.#bar = watchSaveBars(dialog, (edited) => this.#show(edited ? 'edited' : 'clean'))
    this.#show('clean')
    this.attributeChangedCallback()
  }

  attributeChangedCallback(): void {
    this.#title.textContent = this.getAttribute('heading') ?? ''
  }

  // An app that takes an open modal off the page, as a framework unmounting it does, closes it. Its
  // close event then fires off the page, where nothing hears it, so the page hears it from the
  // document, and the Admin lifts its scrim.
  disconnectedCallback(): void {
    if (!this.#dialog?.open) return
    this.#dialog.close()
    document.dispatchEvent(new CustomEvent('e-modal-close', { bubbles: true }))
  }

  // The footer shows the modal's own buttons, its save bar, or the ask, in the page's language at
  // the time; with none of them it is hidden.
  #show(state: State): void {
    this.#state = state
    const copy = say()
    label(this.#discard, copy.discard)
    label(this.#save, copy.save)
    this.#ask.textContent = copy.closeAsk
    label(this.#keepEditing, copy.keepEditing)
    label(this.#closeAnyway, copy.closeAnyway)
    for (const item of this.#own) item.toggleAttribute('hidden', state !== 'clean')
    for (const item of [this.#discard, this.#save]) item.hidden = state !== 'edited'
    for (const item of [this.#ask, this.#keepEditing, this.#closeAnyway]) item.hidden = state !== 'asking'
    this.#footer.hidden = state === 'clean' && this.#own.length === 0
  }

  #leave(): void {
    if (this.#state === 'clean') this.#dialog?.close()
    else this.#show('asking')
  }

  show(): void {
    const dialog = this.#dialog
    if (!dialog || dialog.open) return
    this.#close.setAttribute('aria-label', say().close)
    this.#show(this.#state)
    dialog.showModal()
    this.dispatchEvent(new CustomEvent('e-modal-open', { bubbles: true }))
  }

  hide(): void {
    this.#dialog?.close()
  }
}

export function defineModal(): void {
  if (!customElements.get('e-modal')) customElements.define('e-modal', EModal)
}

const modalById = (id: string): EModal | null => {
  const tag = document.getElementById(id)
  return tag instanceof EModal ? tag : null
}

export const showModal = (id: string): void => modalById(id)?.show()
export const hideModal = (id: string): void => modalById(id)?.hide()
