// The Admin's search: a modal the top band's search button opens, as do Ctrl+K or ⌘K in the page and,
// through the bridge, in an app's frame. The Admin fills its results as the staff member types. Esc
// closes it, and focus goes back where it was: to the element that had it, or into the app's frame,
// whose bridge then focuses its own element again.
import { isSearchKey } from './v2/bridge.ts'

export function openSearch(back?: () => void): void {
  const dialog = document.querySelector<HTMLDialogElement>('e-admin-frame > dialog.e-search')
  if (!dialog || dialog.open) return
  const had = document.activeElement
  dialog.addEventListener(
    'close',
    () => {
      if (back) back()
      else if (had instanceof HTMLElement && had.isConnected) had.focus()
    },
    { once: true },
  )
  dialog.showModal()
  const field = dialog.querySelector<HTMLInputElement>('input[type="search"]')
  field?.focus()
  field?.select()
}

export function followSearch(frame: Element): void {
  frame.querySelector('[slot="actions"] > .e-search-button')?.addEventListener('click', () => openSearch())
  // A search field's own Esc would only empty it; here Esc closes the modal, as in any other.
  const dialog = frame.querySelector<HTMLDialogElement>(':scope > dialog.e-search')
  dialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    dialog.close()
  })
  // A touch phone has no Esc: a tap on the dimmed page around the modal closes it, as a click does.
  // A press that starts in the modal and ends outside it is a drag, not a tap around it.
  let pressedAround = false
  dialog?.addEventListener('pointerdown', (event) => {
    pressedAround = event.target === dialog
  })
  dialog?.addEventListener('click', (event) => {
    if (event.target === dialog && pressedAround) dialog.close()
  })
  document.addEventListener('keydown', (event) => {
    if (!isSearchKey(event)) return
    event.preventDefault()
    openSearch()
  })
}
