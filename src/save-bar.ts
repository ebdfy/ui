// The app half of the save bar. A <form data-save-bar> raises the Admin's bar when a named field
// differs from the value it held when the form appeared or was last saved. Fields with no name, and
// search fields, never count. Discard writes those values back, so a value a script set without
// focus goes back too; Save submits the form. A submit makes the values the saved ones at once, so
// a second tap on Save finds nothing to submit, until the app shows userErrors for it: then nothing
// was saved, and the values from before the submit are the saved ones again.

import { clearErrors } from './v2/form-errors.ts'

export type SaveBarAction = 'save' | 'discard'

// What showErrors raises on a form when the API refused its save.
export const refused = 'e-save-refused'

// What Discard fires on each form once its values are back, so a part drawn from them draws again.
export const discarded = 'e-save-discarded'

// The properties that hold what a person entered: a native control's value, and a checkbox's checked.
interface Entered {
  value?: string
  checked?: boolean
}

type Field = Element & Entered

function snapshot({ value, checked }: Field): Entered {
  return { value, checked }
}

// Whether the field took its saved state back. A script may set a file input only to '', so the
// file chosen when the form was saved cannot come back.
function restore(field: Field, state: Entered): boolean {
  if (field instanceof HTMLInputElement && field.type === 'file' && state.value) return false
  if (state.value !== undefined) field.value = state.value
  if (state.checked !== undefined) field.checked = state.checked
  return true
}

function counts(element: Element): boolean {
  if (!('name' in element) || !element.name) return false
  return !(element instanceof HTMLInputElement && ['search', 'submit', 'button', 'reset'].includes(element.type))
}

// SAFETY: a form's elements are native controls, which keep what was entered in the Entered
// properties or lack them.
const fieldsOf = (form: HTMLFormElement) => [...form.elements].filter(counts) as Field[]

const same = (a: Entered, b: Entered) => JSON.stringify(a) === JSON.stringify(b)

// The form a field belongs to, which a native control names.
function formOf(target: EventTarget | null): HTMLFormElement | null {
  const form = target && 'form' in target ? target.form : null
  return form instanceof HTMLFormElement && form.hasAttribute('data-save-bar') ? form : null
}

// root is the page's document, or the dialog of an e-modal: a form inside an e-modal saves from that
// modal's own footer, so only its dialog watches it, never the page's bar.
export function watchSaveBars(root: Document | Element, show: (visible: boolean) => void) {
  const owns = (form: HTMLFormElement) => (form.closest('e-modal > dialog') ?? form.ownerDocument) === root
  const saved = new Map<HTMLFormElement, Map<Field, Entered>>()
  // The saved values from before each form's last submit.
  const before = new Map<HTMLFormElement, Map<Field, Entered>>()
  let visible = false

  // Records the value of each field of the form not yet seen.
  const watch = (form: HTMLFormElement) => {
    const values = saved.get(form) ?? new Map<Field, Entered>()
    saved.set(form, values)
    for (const field of fieldsOf(form)) if (!values.has(field)) values.set(field, snapshot(field))
  }
  const scan = () => {
    for (const form of root.querySelectorAll<HTMLFormElement>('form[data-save-bar]')) if (owns(form)) watch(form)
  }

  const edited = (form: HTMLFormElement) =>
    [...(saved.get(form) ?? [])].some(([field, values]) => field.isConnected && !same(values, snapshot(field)))
  // A record not saved yet, marked data-save-new, holds an edit from the start.
  const dirty = (form: HTMLFormElement) => form.hasAttribute('data-save-new') || edited(form)

  const update = () => {
    for (const form of saved.keys()) if (!form.isConnected) saved.delete(form)
    const now = [...saved.keys()].some(dirty)
    if (now !== visible) show((visible = now))
  }

  const onEdit = (event: Event) => {
    const form = formOf(event.target)
    if (!form || !owns(form) || !(event.target instanceof Element) || !counts(event.target)) return
    watch(form)
    update()
  }

  // On the way up, once the field has taken the new value.
  root.addEventListener('input', onEdit)
  root.addEventListener('change', onEdit)
  // A submitted form's values are its new saved ones, whichever way it was submitted.
  root.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !saved.has(form)) return
    before.set(form, saved.get(form)!)
    saved.set(form, new Map(fieldsOf(form).map((field) => [field, snapshot(field)])))
    update()
  })
  root.addEventListener(refused, (event) => {
    const form = event.target
    const values = form instanceof HTMLFormElement ? before.get(form) : undefined
    if (!values || !(form instanceof HTMLFormElement)) return
    before.delete(form)
    saved.set(form, values)
    update()
  })
  // A form that comes in is watched, and one that goes, as a panel swap takes it, no longer counts.
  new MutationObserver(() => {
    scan()
    update()
  }).observe(root, { childList: true, subtree: true })
  scan()
  update()

  return {
    // The forms that hold an edit, in page order.
    dirty(): HTMLFormElement[] {
      return [...saved.keys()]
        .filter((form) => form.isConnected && dirty(form))
        .sort((one, other) => (one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    },
    // Whether a field of this form, or of any, differs from its saved value: a record not saved yet
    // holds an edit from the start, but leaving it, or its saved answer, loses only what was typed.
    edited(only?: HTMLFormElement): boolean {
      return [...saved.keys()].some((form) => form.isConnected && (!only || form === only) && edited(form))
    },
    act(action: SaveBarAction): void {
      if (action === 'discard') {
        // The values go back to the saved ones, so the errors a refused save showed on them go too.
        for (const [form, values] of saved) {
          // A file that cannot come back is the saved one from now, so the bar does not stay up.
          for (const [field, state] of values) {
            if (!restore(field, state)) values.set(field, snapshot(field))
          }
          clearErrors(form)
          form.dispatchEvent(new Event(discarded, { bubbles: true }))
        }
        update()
        return
      }
      for (const form of [...saved.keys()].filter(dirty)) form.requestSubmit()
    },
  }
}

const isError = (name: string) => name === 'error' || name.endsWith('-error')

// The kit tags of a form that show an error now.
export const inError = (form: HTMLFormElement): Element[] =>
  [...form.querySelectorAll('*')].filter(
    (element) => element.localName.startsWith('e-') && element.getAttributeNames().some(isError),
  )

// What a refused form says now: how many fields show an error, and the banner's first line for an
// error that names no field.
export function refusal(form: HTMLFormElement): { fields: number; message?: string } {
  const message = form.querySelector(':scope > [data-e-form-errors] > p')?.textContent ?? undefined
  return message ? { fields: inError(form).length, message } : { fields: inError(form).length }
}

// A field the person typed in loses its error: the nearest kit tag around it drops every error
// attribute. Only typing counts: a part's own events as it shows an error, and the change that fires
// as the refusal moves focus away, are no correction.
export function clearCorrected(event: Event, form: HTMLFormElement): boolean {
  if (event.type !== 'input' || !event.isTrusted || !(event.target instanceof Element)) return false
  if (!form.contains(event.target)) return false
  for (let at = event.target.parentElement; at && at !== form; at = at.parentElement) {
    if (!at.localName.startsWith('e-')) continue
    for (const name of at.getAttributeNames().filter(isError)) at.removeAttribute(name)
    return true
  }
  return false
}

// Ctrl+S, or ⌘S on Apple: Save while the bar shows.
export const isSaveKey = (event: KeyboardEvent): boolean =>
  event.key.toLowerCase() === 's' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey

// The bar form whose one-line field Enter was pressed in, as Enter there is Save; a text area's Enter
// is a new line, and a key a part already acted on, as a list's pick, is the part's.
export function enterForm(event: KeyboardEvent): HTMLFormElement | null {
  if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return null
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return null
  const field = event.target
  if (!(field instanceof HTMLInputElement) || ['button', 'submit', 'reset'].includes(field.type)) return null
  return formOf(field)
}
