// The form helper: puts the API's userErrors on the fields they name. A field path such as
// ["address", "area"] names the field submitted as address.area. A message that names no field
// shows in a banner at the top of the form. Every message is announced, and any error tells the save
// bar the save was refused, so the bar comes back up.
import { EbDistrictPicker } from './components/district-picker.ts'
import { Field } from './components/field.ts'
import { refused } from './save-bar.ts'

export interface UserError {
  field?: string[] | null
  code?: string
  message: string
}

const hidden = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap'

const bannerStyle = [
  'margin:0 0 var(--eb-space-gap)',
  'padding:12px var(--eb-space-card)',
  'border-radius:var(--eb-radius-field)',
  'border:1px solid var(--eb-color-critical)',
  'background:var(--eb-color-surface)',
  'color:var(--eb-color-critical)',
  'font-family:var(--eb-font-family)',
  'font-size:var(--eb-font-size-body)',
  'line-height:var(--eb-line-height-body)',
].join(';')

// Shows the message on the field that submits under the path, and says whether one did.
function place(form: HTMLFormElement, path: string, message: string): boolean {
  for (const element of form.elements) {
    if (element instanceof EbDistrictPicker && element.areaName === path) element.areaError = message
    else if (element instanceof EbDistrictPicker && element.districtName === path) element.error = message
    else if (element instanceof Field && element.name && element.name === path) element.error = message
    else continue
    return true
  }
  return false
}

export function showErrors(form: HTMLFormElement, errors: UserError[]): void {
  for (const element of form.elements) {
    if (element instanceof Field) element.error = ''
    if (element instanceof EbDistrictPicker) element.areaError = ''
  }
  form.querySelector(':scope > [data-eb-form-errors]')?.remove()

  const unplaced = errors.filter((error) => !error.field?.length || !place(form, error.field.join('.'), error.message))
  if (unplaced.length) {
    const banner = document.createElement('div')
    banner.dataset.ebFormErrors = ''
    banner.style.cssText = bannerStyle
    for (const error of unplaced)
      banner.append(Object.assign(document.createElement('p'), { textContent: error.message, style: 'margin:0' }))
    form.prepend(banner)
  }

  let live = form.querySelector<HTMLElement>(':scope > [data-eb-announce]')
  if (!live) {
    live = document.createElement('div')
    live.dataset.ebAnnounce = ''
    live.setAttribute('aria-live', 'assertive')
    live.style.cssText = hidden
    form.append(live)
  }
  live.textContent = errors.map((error) => error.message).join(' ')
  if (errors.length) form.dispatchEvent(new Event(refused, { bubbles: true }))
}
