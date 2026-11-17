// The Admin's one save bar, in the frame's top band (design review 5.3 and 5.4). It shows while a
// form[data-save-bar] in the panel holds an edit, and offers Discard and Save. From 1040 px it is a
// pill in the band's middle cell; below, it takes the whole band, and the store and the icons keep
// their room unseen, so nothing moves.
//
// On an Admin page Save posts the form by fetch with the save-bar header, and the Admin answers the
// panel's HTML: 200 is the saved page, whose toast attribute names its toast, and 422 the same form
// with each field's error in markup, which the bar puts on the form being edited, so what was typed,
// focus and the values to go back to all stay.
import { toastSeconds, words } from './host-rules.ts'
import type { SaveBarAction } from './save-bar.ts'
import { clearCorrected, enterForm, inError, isSaveKey, refusal, refused, watchSaveBars } from './save-bar.ts'
import { askToLeave } from './v2-host-leave.ts'
import { panelEvent, panelHeader, putPanel } from './v2-host-panel.ts'
import { showErrors, type UserError } from './v2/form-errors.ts'

// The request header that marks a save from the bar.
export const saveBarHeader = 'Ebdfy-Save-Bar'

const language = () => (document.documentElement.lang.startsWith('bn') ? 'bn' : 'en')
const say = () => words[language()]

// A count in the page's own digits.
const count = (n: number) => new Intl.NumberFormat(language() === 'bn' ? 'bn-IN' : 'en-IN').format(n)

export interface SaveBar {
  readonly element: HTMLElement
  // Whether the bar is up, which is whether leaving would lose an edit.
  readonly dirty: boolean
  // Puts every edit back, as the bar's Discard does.
  discard(): void
  // A small shake that says the bar is why nothing moved.
  nudge(): void
  // What an app's bridge says of its own form, and how to press its Save or Discard.
  app(said: AppSaveBar, act: (action: SaveBarAction) => void): void
}

// An app's saveBar message: whether its form holds an edit, and, from 2.1, why its save was refused.
// An app on the frozen 2.0 script sends visible alone.
export interface AppSaveBar {
  visible?: boolean
  refused?: { fields?: number; message?: string }
}

// The session events: the bar raises the first on a form whose save met an expired session, and
// resubmits it when the Admin, its log-in done, fires the second.
export const sessionExpired = 'e-session-expired'
export const sessionRestored = 'e-session-restored'

// How long a save may wait for an answer before the bar calls it offline.
export const saveSeconds = 10

type State =
  | { name: 'clean' | 'dirty' | 'saving' }
  | { name: 'offline' | 'conflict'; form: HTMLFormElement }
  // A refusal of a form here, or, from an app, what its bridge said of its own.
  | { name: 'refused'; form?: HTMLFormElement; fields?: number; message?: string }

function made<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  element.className = className
  return element
}

// An error attribute, not a page's own copy of one such as the playground's data-bn-error.
const isError = (name: string) => !name.startsWith('data-') && (name === 'error' || name.endsWith('-error'))

// The errors an answer's form shows in markup: each kit tag's error attributes, by the name the tag
// gives its control (a tag's upazila-error names its control <name>.upazila), and the banner's lines.
function errorsOf(form: Element): UserError[] {
  const errors: UserError[] = []
  // A tag's name is its own, or its control's, as e-rich-text's text area carries it.
  for (const tag of form.querySelectorAll('*')) {
    const attributes = tag.localName.startsWith('e-') ? tag.getAttributeNames().filter(isError) : []
    const name = attributes.length && (tag.getAttribute('name') ?? tag.querySelector('[name]')?.getAttribute('name'))
    if (!name) continue
    for (const attribute of attributes) {
      const field = attribute === 'error' ? [name] : [name, attribute.slice(0, -'-error'.length)]
      errors.push({ field, message: tag.getAttribute(attribute) ?? '' })
    }
  }
  for (const line of form.querySelectorAll(':scope > [data-e-form-errors] > p'))
    errors.push({ message: line.textContent ?? '' })
  return errors
}

// A control the browser checks before a form goes.
const checked = (control: Element): control is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
  control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement

// The kit tag a control belongs to: the nearest e- element around it within its form.
function ownTag(control: Element, form: HTMLFormElement): Element | null {
  for (let at = control.parentElement; at && at !== form; at = at.parentElement)
    if (at.localName.startsWith('e-')) return at
  return null
}

// A bar form straight in the Admin's panel, not one in an app's frame or a modal.
const panelForm = (target: EventTarget | null): HTMLFormElement | null =>
  target instanceof HTMLFormElement &&
  target.matches('form[data-save-bar]') &&
  !!target.closest('e-admin-frame > e-admin-panel') &&
  !target.closest('e-modal')
    ? target
    : null

// A form's own second button for the bar, such as Save as draft.
const secondOf = (form: HTMLFormElement | null | undefined) =>
  form?.querySelector<HTMLButtonElement>('button[data-save-bar-button]') ?? null

export function mountSaveBar(frame: Element): SaveBar {
  const bar = made('div', 'e-save-bar')
  bar.setAttribute('role', 'region')
  bar.hidden = true
  const dot = made('span', 'e-save-bar-dot')
  dot.setAttribute('aria-hidden', 'true')
  const message = made('p', 'e-save-bar-message')
  message.setAttribute('aria-live', 'polite')
  // The message in full, and the short form that fits beside × and Save below 1040 px.
  const full = made('span', 'e-save-bar-full')
  const short = made('span', 'e-save-bar-short')
  message.append(full, short)
  // One button for Discard: its word from 1040 px, and below it a × that keeps the word as its name.
  const discard = made('button', 'e-save-bar-discard')
  discard.type = 'button'
  const cross = document.createElement('e-icon')
  cross.setAttribute('name', 'x')
  const discardWord = document.createElement('span')
  discard.append(cross, discardWord)
  // A form's own second button, such as Create order's Save as draft, from 1040 px.
  const second = made('button', 'e-save-bar-second')
  second.type = 'button'
  second.hidden = true
  const save = made('button', 'e-save-bar-save')
  save.type = 'button'
  bar.append(dot, message, discard, second, save)
  frame.append(bar)

  // Below 1040 px a sentence too long for the bar shows in full at the top of its form.
  let banner: HTMLElement | null = null
  const showBanner = (form: HTMLFormElement | null, text: string) => {
    if (!form) {
      banner?.remove()
      banner = null
      return
    }
    banner ??= made('div', 'e-save-banner')
    banner.setAttribute('role', 'alert')
    banner.textContent = text
    if (banner.parentElement !== form) form.prepend(banner)
  }

  let state: State = { name: 'clean' }
  // What the bar does as the panel's forms gain or lose their edits, set once the bar can draw.
  let edits: ((edited: boolean) => void) | null = null
  const forms = watchSaveBars(document, (edited) => edits?.(edited))
  // The form that names the bar's words: a create form names its message and its primary.
  const lead = () => forms.dirty()[0] ?? document.querySelector<HTMLFormElement>('e-admin-panel form[data-save-bar]')
  const draw = () => {
    const copy = say()
    const form = lead()
    const making = form?.dataset.saveMessage
    let text = making || copy.unsaved
    let brief = making ? copy.notSavedYet : text
    let primary = form?.dataset.saveLabel || copy.barSave
    const own = secondOf(form)
    second.textContent = own?.textContent?.trim() ?? ''
    second.hidden = !own || state.name === 'saving'
    let sentence = ''
    if (state.name === 'saving') {
      text = copy.saving
      brief = text
    }
    if (state.name === 'refused') {
      const said = state.form ? refusal(state.form) : state
      const fields = said.fields ?? 0
      const reason = said.message ?? ''
      if (fields === 0 && reason) {
        text = copy.notSavedBecause.replace('{message}', reason)
        brief = copy.notSaved
      } else {
        text = (fields === 1 ? copy.fieldToFix : copy.fieldsToFix).replace('{n}', count(fields))
        brief = (fields === 1 ? copy.fieldToFixShort : copy.fieldsToFixShort).replace('{n}', count(fields))
      }
    }
    if (state.name === 'offline') {
      sentence = copy.offline
      text = sentence
      brief = copy.notSaved
      primary = copy.tryAgain
    }
    if (state.name === 'conflict') {
      sentence = copy.conflict
      text = sentence
      brief = copy.conflictShort
      primary = copy.reload
    }
    showBanner(sentence && 'form' in state ? (state.form ?? null) : null, sentence)
    bar.setAttribute('aria-label', copy.unsaved)
    full.textContent = text
    short.textContent = brief
    discardWord.textContent = copy.barDiscard
    save.textContent = primary
    bar.dataset.state = state.name
    for (const button of [discard, second, save]) button.disabled = state.name === 'saving'
    bar.hidden = state.name === 'clean'
    frame.toggleAttribute('data-save-bar', !bar.hidden)
  }
  const become = (next: State) => {
    state = next
    draw()
  }
  // The bar speaks the page's language, which can change while it shows.
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })

  edits = (edited) => {
    // A save on its way holds the bar up while the watcher counts the form saved.
    if (state.name === 'saving') return
    if (!edited) become({ name: 'clean' })
    else if (state.name === 'clean') become({ name: 'dirty' })
  }
  // A record not saved yet shows the bar from the first frame.
  edits(forms.dirty().length > 0)

  // The forms still to send, in page order: two bar forms on a page save one after the other.
  let queue: HTMLFormElement[] = []
  let failed: State | null = null
  // Counts each Discard, so a save still on its way when the staff member threw the edit away, or
  // left, answers nothing.
  let discards = 0
  // The second button pressed for this save, if one was.
  let pressed: HTMLButtonElement | null = null
  const next = () => {
    const form = queue.shift()
    if (form) return form.requestSubmit(pressed?.form === form ? pressed : null)
    pressed = null
    become(failed ?? { name: forms.dirty().length ? 'dirty' : 'clean' })
    failed = null
  }

  // One save at a time: a form the browser's own checks refuse goes no further, and shows why.
  // The app's form's buttons, while an app's page holds the bar.
  let appActs: ((action: SaveBarAction) => void) | null = null

  const saveAll = (submitter: HTMLButtonElement | null = null) => {
    if (state.name === 'saving') return
    if (appActs) return appActs('save')
    const edited = submitter?.form ? [submitter.form] : forms.dirty()
    // A form marked novalidate is left to the Admin's own checks, as the browser leaves it.
    const invalid = edited.find((form) => !form.noValidate && !form.checkValidity())
    if (invalid) {
      // Each refused field shows the browser's reason under it, as an error from the Admin would, and
      // the first takes focus.
      const fields = [...invalid.elements].filter(checked).filter((one) => one.willValidate && !one.validity.valid)
      for (const control of fields) {
        const tag = ownTag(control, invalid)
        if (tag && !tag.getAttributeNames().some(isError)) tag.setAttribute('error', control.validationMessage)
      }
      fields[0]?.focus()
      become({ name: 'refused', form: invalid })
      return
    }
    queue = edited
    failed = null
    pressed = submitter
    next()
  }

  let toast: HTMLElement | null = null
  let toastTimer = 0
  const showToast = (said: string, panel: Element | null) => {
    const text = said.trim()
    if (!text || !panel) return
    clearTimeout(toastTimer)
    toast?.remove()
    toast = made('div', 'e-toast')
    toast.setAttribute('role', 'status')
    toast.textContent = text
    panel.append(toast)
    toastTimer = window.setTimeout(() => toast?.remove(), toastSeconds * 1000)
  }

  // The form whose save met an expired session, sent again once the session is back.
  let expired: HTMLFormElement | null = null
  const notSaved = (form: HTMLFormElement, after: State) => {
    form.dispatchEvent(new Event(refused, { bubbles: true }))
    become(after)
  }

  const send = async (form: HTMLFormElement, submitter: HTMLElement | null) => {
    become({ name: 'saving' })
    const before = discards
    let response: Response
    let html: string
    try {
      // The answer's body is read within the same 10 s.
      const signal = AbortSignal.timeout(saveSeconds * 1000)
      response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form, submitter),
        headers: { [saveBarHeader]: '1', [panelHeader]: '1' },
        signal,
      })
      html = await response.text()
    } catch {
      if (before !== discards) return
      queue = []
      notSaved(form, { name: 'offline', form })
      return
    }
    if (before !== discards) return
    if (response.status === 401) {
      expired = form
      queue = []
      notSaved(form, { name: 'dirty' })
      form.dispatchEvent(new CustomEvent(sessionExpired, { bubbles: true }))
      return
    }
    if (response.status === 409) {
      queue = []
      notSaved(form, { name: 'conflict', form })
      return
    }
    const page = new DOMParser().parseFromString(html, 'text/html')
    const answer = page.querySelector('e-admin-panel')
    if (response.ok && answer) {
      // With one form the saved page takes its place; beside another, or with typing done while it
      // saved, the form stays as it is.
      const alone = document.querySelectorAll('e-admin-panel form[data-save-bar]').length === 1 && !forms.edited(form)
      // The Admin puts the answer in the staff member's language before its toast is read.
      let panel = form.closest('e-admin-panel')
      if (alone) {
        // A create the Admin answered by a redirect, as /orders/new to the order it made, shows the
        // address it landed on, in the same history entry.
        if (response.redirected) history.replaceState(history.state, '', response.url)
        panel = putPanel(frame, answer, page.title)
      } else document.dispatchEvent(new CustomEvent(panelEvent, { detail: { panel: answer } }))
      showToast(answer.getAttribute('toast') ?? '', panel)
      next()
      return
    }
    if (response.status === 422 && answer) {
      // The Admin puts the answer in the staff member's language before it is read.
      document.dispatchEvent(new CustomEvent(panelEvent, { detail: { panel: answer } }))
      const index = [...document.querySelectorAll('e-admin-panel form[data-save-bar]')].indexOf(form)
      const shown = answer.querySelectorAll('form[data-save-bar]')[index]
      failed = { name: 'refused', form }
      showErrors(form, shown ? errorsOf(shown) : [])
      next()
      return
    }
    queue = []
    notSaved(form, { name: 'offline', form })
  }

  document.addEventListener(sessionRestored, () => {
    const form = expired
    expired = null
    if (form?.isConnected) form.requestSubmit()
  })

  document.addEventListener('submit', (event) => {
    const form = panelForm(event.target)
    if (!form || event.defaultPrevented) return
    event.preventDefault()
    void send(form, event.submitter)
  })

  // A field put right loses its error, and once none is left the bar is back to the edit.
  document.addEventListener('input', (event) => {
    if (state.name !== 'refused' || !state.form || !clearCorrected(event, state.form)) return
    if (inError(state.form).length === 0) become({ name: forms.dirty().length ? 'dirty' : 'clean' })
    else draw()
  })
  // A part may clear an error itself as a choice changes, as the report builder clears a range's.
  document.addEventListener('change', (event) => {
    if (state.name !== 'refused' || !(event.target instanceof Node) || !state.form?.contains(event.target)) return
    if (inError(state.form).length === 0) become({ name: forms.dirty().length ? 'dirty' : 'clean' })
  })

  // Ctrl+S or ⌘S saves while the bar shows; Enter in a one-line field of a bar form saves it. Esc
  // never discards.
  document.addEventListener('keydown', (event) => {
    if (isSaveKey(event)) {
      if (bar.hidden) return
      event.preventDefault()
      saveAll()
      return
    }
    if (!panelForm(enterForm(event))) return
    event.preventDefault()
    if (!bar.hidden) saveAll()
  })

  const discardAll = () => {
    discards += 1
    queue = []
    failed = null
    pressed = null
    appActs?.('discard')
    forms.act('discard')
    // A form not saved yet still has nothing saved, so its bar stays.
    become({ name: forms.dirty().length ? 'dirty' : 'clean' })
  }
  // On a create form Discard throws the whole record away, so it asks first.
  discard.addEventListener('click', () => {
    const asked = lead()?.dataset.saveDiscard
    if (!asked) return discardAll()
    const copy = say()
    void askToLeave(frame, { title: asked, sentence: '', stay: copy.keepEditing, leave: copy.barDiscard }).then(
      (sure) => sure && discardAll(),
    )
  })
  second.addEventListener('click', () => saveAll(secondOf(lead())))
  save.addEventListener('click', () => {
    if (state.name !== 'conflict') return saveAll()
    // Reload takes the page as it is now; what was typed goes, as the staff member chose.
    forms.act('discard')
    become({ name: 'clean' })
    location.reload()
  })
  // A page a native post answered shows its toast too.
  const panel = frame.querySelector(':scope > e-admin-panel')
  if (panel) showToast(panel.getAttribute('toast') ?? '', panel)
  draw()

  return {
    element: bar,
    // An untouched record not saved yet loses nothing on leaving; an app's edit is not in this page's forms.
    get dirty() {
      return !bar.hidden && !(state.name === 'dirty' && forms.dirty().length > 0 && !forms.edited())
    },
    discard: discardAll,
    app(said, act) {
      appActs = act
      if (said?.visible !== true) return become({ name: 'clean' })
      const refusedNow = said.refused
      if (refusedNow && (Number(refusedNow.fields) > 0 || refusedNow.message))
        return become({
          name: 'refused',
          fields: Number(refusedNow.fields) || 0,
          message: refusedNow.message ? String(refusedNow.message) : undefined,
        })
      become({ name: 'dirty' })
    },
    nudge() {
      bar.classList.remove('e-save-bar-nudge')
      // A reflow between, so a second nudge plays again.
      void bar.offsetWidth
      bar.classList.add('e-save-bar-nudge')
    },
  }
}
