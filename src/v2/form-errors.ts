// The v2 form helper, ebdfy.showErrors: puts the API's userErrors on the fields they name. A field
// path such as ["address", "line1"] names the control submitted as address.line1, and the message
// shows under the e-* tag holding it, from the tag's error attribute (or, for a tag holding two
// controls, such as the district picker's upazila, its upazila-error). A message that names no field
// of the form shows in a banner at the top. Focus moves to the first field named, every message is
// announced, and any error tells the save bar the save was refused, so the bar comes back up.
import { refused } from '../save-bar.ts'

export interface UserError {
  field?: string[] | null
  code?: string
  message: string
}

const watches = (tag: Element, name: string) =>
  ((tag.constructor as { observedAttributes?: string[] }).observedAttributes ?? []).includes(name)

// The e-* field a native control belongs to: the nearest tag that shows an error, never a layout tag
// such as e-stack around a plain control.
const tagOf = (control: Element): Element | null => {
  for (let at = control.parentElement; at; at = at.parentElement)
    if (at.localName.startsWith('e-')) return watches(at, 'error') ? at : null
  return null
}

const isError = (name: string) => name === 'error' || name.endsWith('-error')

// Takes every error the helper or a field's own check showed off the form: the attributes, the
// banner and the announcement. Discard calls it too, as the values the errors were about go back.
export function clearErrors(form: HTMLFormElement): void {
  // Only the kit's own tags: an app's data-error or other hook of its own stays.
  for (const element of form.querySelectorAll('*'))
    if (element.localName.startsWith('e-'))
      for (const name of element.getAttributeNames()) if (isError(name)) element.removeAttribute(name)
  form.querySelector(':scope > [data-e-form-errors]')?.remove()
  const live = form.querySelector(':scope > [data-e-announce]')
  if (live) live.textContent = ''
}

// Shows the message under the tag of the control submitted under the path, and returns the control,
// or null when the form has none.
function place(form: HTMLFormElement, path: string, message: string): Element | null {
  const control = [...form.elements].find((element) => 'name' in element && element.name === path)
  const tag = control && tagOf(control)
  if (!control || !tag) return null
  // A tag that shows an error per control watches an attribute named after the control's last part.
  const own = `${path.split('.').pop()}-error`
  tag.setAttribute(watches(tag, own) ? own : 'error', message)
  return control
}

// The control a person types in for this one: itself, or the tag's visible control when the named
// one is a hidden input, as the taka field's is.
function focusable(control: Element): HTMLElement | null {
  if (!(control instanceof HTMLInputElement && control.type === 'hidden')) return control as HTMLElement
  return tagOf(control)?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea') ?? null
}

export function showErrors(form: HTMLFormElement, errors: UserError[]): void {
  clearErrors(form)
  const placed: Element[] = []
  const unplaced: UserError[] = []
  for (const error of errors) {
    const control = error.field?.length ? place(form, error.field.join('.'), error.message) : null
    if (control) placed.push(control)
    else unplaced.push(error)
  }

  if (unplaced.length) {
    const banner = document.createElement('div')
    banner.dataset.eFormErrors = ''
    banner.append(
      ...unplaced.map((error) => Object.assign(document.createElement('p'), { textContent: error.message })),
    )
    form.prepend(banner)
  }

  let live = form.querySelector<HTMLElement>(':scope > [data-e-announce]')
  if (!live) {
    live = document.createElement('div')
    live.dataset.eAnnounce = ''
    live.setAttribute('aria-live', 'assertive')
    form.append(live)
  }
  live.textContent = errors.map((error) => error.message).join(' ')

  // The first field in the form's own order, so focus lands at the top of what needs fixing.
  const first = [...form.elements].find((element) => placed.includes(element))
  if (first) focusable(first)?.focus()
  if (errors.length) form.dispatchEvent(new Event(refused, { bubbles: true }))
}
