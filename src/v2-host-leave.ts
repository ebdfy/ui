// Leaving a page whose form holds an edit asks first (design review 5.6). A link in the frame, a
// menu entry, a tab, a row, the back arrow, the user menu, the store switch or Log out, stops; the
// bar nudges, and a dialog asks: "Leave without saving?", with "Stay on this page" focused and
// "Leave". Leave discards and goes where the tap pointed. Reload, closing the tab and a typed address
// get the browser's own prompt, which cannot be worded.
import { words } from './host-rules.ts'
import { defineButton } from './v2/button.ts'

defineButton()

const say = () => words[document.documentElement.lang.startsWith('bn') ? 'bn' : 'en']

// What the guard needs of the bar.
export interface Guarded {
  readonly dirty: boolean
  discard(): void
  nudge(): void
}

export interface Question {
  title: string
  sentence: string
  stay: string
  leave: string
}

// The dialog, built once: its question, its sentence and its two buttons' row.
let dialog: { box: HTMLDialogElement; title: HTMLElement; sentence: HTMLElement; actions: HTMLElement } | null = null

// Asks one question in the Admin's own dialog and answers whether the staff member chose to leave.
// Esc, or a tap on Stay, stays.
export function askToLeave(frame: Element, question: Question): Promise<boolean> {
  if (!dialog) {
    const box = document.createElement('dialog')
    box.className = 'e-leave'
    const actions = document.createElement('div')
    actions.className = 'e-leave-actions'
    dialog = { box, title: document.createElement('h2'), sentence: document.createElement('p'), actions }
    // Named by its question and described by its sentence, as a screen reader reads a dialog.
    dialog.title.id = 'e-leave-title'
    dialog.sentence.id = 'e-leave-sentence'
    box.setAttribute('aria-labelledby', dialog.title.id)
    box.setAttribute('aria-describedby', dialog.sentence.id)
    box.append(dialog.title, dialog.sentence, actions)
    frame.append(box)
  }
  const shown = dialog.box
  dialog.title.textContent = question.title
  dialog.sentence.textContent = question.sentence
  const stay = document.createElement('e-button')
  stay.textContent = question.stay
  const leave = document.createElement('e-button')
  leave.setAttribute('tone', 'danger')
  leave.setAttribute('fill', '')
  leave.textContent = question.leave
  dialog.actions.replaceChildren(stay, leave)
  return new Promise((answer) => {
    let left = false
    stay.addEventListener('click', () => shown.close())
    leave.addEventListener('click', () => {
      left = true
      shown.close()
    })
    shown.addEventListener('close', () => answer(left), { once: true })
    shown.showModal()
    // Staying is the safe answer, so it has focus.
    stay.querySelector('button')?.focus()
  })
}

// The leave dialog's words for the page shown now, named by its heading.
function leaving(frame: Element): Question {
  const copy = say()
  const record = frame.querySelector(':scope > e-admin-panel > header h1')?.textContent?.trim() ?? ''
  return {
    title: copy.leaveAsk,
    sentence: copy.leaveSentence.replace('{record}', record),
    stay: copy.stayOnPage,
    leave: copy.leave,
  }
}

// Asks before going, and goes once the bar is clean, so no browser prompt follows the dialog.
export async function leaveThen(frame: Element, bar: Guarded, go: () => void): Promise<void> {
  bar.nudge()
  if (!(await askToLeave(frame, leaving(frame)))) return
  bar.discard()
  go()
}

// The guard a move asks: whether the page holds an edit, and leave, which asks and then goes.
export interface Guard {
  readonly dirty: boolean
  leave(go: () => void): void
}

export function guardLeaving(frame: Element, bar: Guarded): Guard {
  // First of every click on the page, so neither the panel's swap nor an app's nav moves meanwhile.
  document.addEventListener(
    'click',
    (event) => {
      if (!bar.dirty || event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement) || !frame.contains(link)) return
      if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return
      // A move within the page, such as to a section, leaves nothing.
      const url = new URL(link.href)
      if (
        url.origin === location.origin &&
        url.pathname === location.pathname &&
        url.search === location.search &&
        url.hash
      )
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      void leaveThen(frame, bar, () => link.click())
    },
    true,
  )
  window.addEventListener('beforeunload', (event) => {
    if (bar.dirty) event.preventDefault()
  })
  return {
    get dirty() {
      return bar.dirty
    },
    leave: (go) => void leaveThen(frame, bar, go),
  }
}
