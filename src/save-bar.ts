// The app half of the save bar. A <form data-save-bar> raises the Admin's bar when a named field
// differs from the value it held when the form appeared or was last saved. Fields with no name, and
// search fields, never count. Discard writes those values back, so a value a script set without
// focus goes back too; Save submits the form. A submit makes the values the saved ones at once, so
// a second tap on Save finds nothing to submit, until the app shows userErrors for it: then nothing
// was saved, and the values from before the submit are the saved ones again.

export type SaveBarAction = 'save' | 'discard'

// What showErrors raises on a form when the API refused its save.
export const refused = 'eb-save-refused'

// The properties that hold what a person entered: a native input's or an eb field's value, a
// checkbox's checked, and the district picker's district and area.
interface Entered {
  value?: string
  checked?: boolean
  district?: string
  area?: string
}

// What the form helper shows when the API refuses a save.
interface Shown {
  error?: string
  areaError?: string
}

type Field = Element & Entered & Shown

function snapshot({ value, checked, district, area }: Field): Entered {
  return { value, checked, district, area }
}

function restore(field: Field, state: Entered): void {
  if (state.value !== undefined) field.value = state.value
  if (state.checked !== undefined) field.checked = state.checked
  if (state.district !== undefined) field.district = state.district
  if (state.area !== undefined) field.area = state.area
}

function counts(element: Element): boolean {
  if (!('name' in element) || !element.name) return false
  if (element.localName === 'eb-search-field') return false
  return !(element instanceof HTMLInputElement && ['search', 'submit', 'button', 'reset'].includes(element.type))
}

// SAFETY: a form's elements are native controls and eb fields, which keep what was entered in the
// Entered properties or lack them.
const fieldsOf = (form: HTMLFormElement) => [...form.elements].filter(counts) as Field[]

const same = (a: Entered, b: Entered) => JSON.stringify(a) === JSON.stringify(b)

// The form a field belongs to, which a native input and an eb field both name.
function formOf(target: EventTarget | null): HTMLFormElement | null {
  const form = target && 'form' in target ? target.form : null
  return form instanceof HTMLFormElement && form.hasAttribute('data-save-bar') ? form : null
}

export function watchSaveBars(doc: Document, show: (visible: boolean) => void) {
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
  const scan = () => doc.querySelectorAll<HTMLFormElement>('form[data-save-bar]').forEach(watch)

  const dirty = (form: HTMLFormElement) =>
    [...(saved.get(form) ?? [])].some(([field, values]) => field.isConnected && !same(values, snapshot(field)))

  const update = () => {
    for (const form of saved.keys()) if (!form.isConnected) saved.delete(form)
    const now = [...saved.keys()].some(dirty)
    if (now !== visible) show((visible = now))
  }

  const edited = (event: Event) => {
    const form = formOf(event.target)
    if (!form || !(event.target instanceof Element) || !counts(event.target)) return
    watch(form)
    update()
  }

  // On the way up, once the field has taken the new value.
  doc.addEventListener('input', edited)
  doc.addEventListener('change', edited)
  // A submitted form's values are its new saved ones, whichever way it was submitted.
  doc.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !saved.has(form)) return
    before.set(form, saved.get(form)!)
    saved.set(form, new Map(fieldsOf(form).map((field) => [field, snapshot(field)])))
    update()
  })
  doc.addEventListener(refused, (event) => {
    const form = event.target
    const values = form instanceof HTMLFormElement ? before.get(form) : undefined
    if (!values || !(form instanceof HTMLFormElement)) return
    before.delete(form)
    saved.set(form, values)
    update()
  })
  new MutationObserver(scan).observe(doc, { childList: true, subtree: true })
  scan()

  return {
    act(action: SaveBarAction): void {
      if (action === 'discard') {
        // The values go back to the saved ones, so the errors a refused save showed on them go too.
        for (const [form, values] of saved) {
          for (const [field, state] of values) {
            restore(field, state)
            if (field.error) field.error = ''
            if (field.areaError) field.areaError = ''
          }
          form.querySelector(':scope > [data-eb-form-errors]')?.remove()
          const announced = form.querySelector(':scope > [data-eb-announce]')
          if (announced) announced.textContent = ''
        }
        update()
        return
      }
      for (const form of [...saved.keys()].filter(dirty)) form.requestSubmit()
    },
  }
}
