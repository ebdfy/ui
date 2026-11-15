// e-index-table. CSS lays out the card; the script gives each filter chip its remove button, in the
// room the CSS kept for it. Removing a chip takes it away and tells the page with a bubbling
// e-filter-remove event naming the filter, and focus goes to the search field so it is not lost.
//
// It also keeps the selection. The app puts an e-checkbox in each row's first cell and one in the head
// row; ticking rows marks them selected, shows the count and the app's slot="bulk" actions in place
// of the toolbar, and sets the head checkbox to ticked, mixed or clear. New rows from the app start
// unselected. Each change of count is told with a bubbling e-selection-change event.
//
// On a phone the row checkboxes wait for select mode. The script builds a Select button into the
// toolbar, and a select-all checkbox and a Done button into the bulk bar; a long press on a row also
// starts select mode and ticks that row. Leaving it unticks every row.
//
// A table with no rows marks the card empty, which shows the app's e-empty-state in its place.
import { digits } from '../format.ts'
import { langOf } from '../lang.ts'
import { onLangChange } from './speech.ts'

interface Box extends HTMLElement {
  checked: boolean
  indeterminate: boolean
}

const words = {
  en: {
    remove: (filter: string) => `Remove ${filter}`,
    selected: (count: number) => `${count} selected`,
    select: 'Select',
    all: 'Select all',
    done: 'Done',
  },
  bn: {
    remove: (filter: string) => `${filter} সরান`,
    selected: (count: number) => `${digits(count, 'bn')}টি নির্বাচিত`,
    select: 'নির্বাচন করুন',
    all: 'সব নির্বাচন করুন',
    done: 'শেষ',
  },
}

// A press held this long without moving this far starts select mode, as on a phone's own lists.
const hold = 500
const slop = 8
const phone = '(max-width: 599.98px)'

// Sets an e-button's words, in the native button it built once upgraded, only when they change, so
// the subtree observer that called the build is not woken again.
function write(button: HTMLElement, text: string): void {
  const target = button.querySelector(':scope > button') ?? button
  if (target.textContent !== text) target.textContent = text
}

/**
 * Many records in one card: view tabs, a toolbar with search, filter chips and sort, a table whose rows
 * can be ticked, and a pager. Below 600 px the rows are flat lines edge to edge; a cell's `card` attribute
 * places it: `title` and `end` on the first line, `body` and `status` on the second, `meta` and `aside` on
 * the third. A cell with none stays off the line. A `card="figures"` cell holding a `<dl>` of label and
 * value pairs, each a `<div>` with a `<dt>` and a `<dd>`, takes a fourth line, each value under its
 * label, as an Inventory row's on hand, committed, available and incoming; from 600 px it hides, so
 * leave it out of `--e-columns`.
 * The parts are told apart by their tags: `e-tabs`, `e-table`, `e-empty-state` and `e-pagination` take a
 * row each, and every other child sits in the toolbar. On a phone a search field shares its line with the
 * button written right after it, such as Add filter, so write the chips after that button.
 *
 * Below 600 px the row checkboxes hide until select mode. Once the rows hold checkboxes and there is a
 * bulk bar, the script builds a Select button into the toolbar, and a "Select all" checkbox and a Done
 * button into the bulk bar, which shows in select mode
 * even with no row ticked. A long press on a row, held 500 ms, also starts select mode and ticks that
 * row. Leaving select mode unticks every row and hides the checkboxes. From 600 px the checkboxes always
 * show and the built parts stay hidden.
 * @tag e-index-table
 * @attr label - Names the card as a region for assistive tech.
 * @attr {boolean} select-mode - Below 600 px, every row shows its checkbox. Removing it unticks them all.
 * @fires e-selection-change - A row or the head checkbox changed the number of ticked rows. `detail` is `{ count }`.
 * @fires e-filter-remove - A filter chip was removed. `detail` is `{ name }`, the chip's `name` attribute.
 * @slot - The app's parts in order: `e-tabs`, the toolbar controls, `e-table`, `e-empty-state` and `e-pagination`.
 * @slot filter - A removable filter chip (`slot="filter"`, with a `name`). The script adds its remove button.
 * @slot bulk - The actions for ticked rows (`slot="bulk"`). While rows are ticked, or in select mode on a phone, they take the toolbar's place, after the count.
 */
export class EIndexTable extends HTMLElement {
  #chips = new MutationObserver(() => this.#build())
  #rows = new MutationObserver(() => this.#count())
  #stop: (() => void) | undefined
  #status: HTMLElement | null = null
  #selected = 0
  #select: HTMLElement | null = null
  #all: Box | null = null
  #done: HTMLElement | null = null
  #press: { timer: number; x: number; y: number } | null = null
  // A long press just ticked a row, so the click that ends it must not open the row's link.
  #pressed = false

  static observedAttributes = ['label', 'select-mode']

  get selectMode(): boolean {
    return this.hasAttribute('select-mode')
  }

  set selectMode(on: boolean) {
    this.toggleAttribute('select-mode', on)
  }

  // A new label, as a page switching language sets, names the region afresh. Leaving select mode
  // unticks every row.
  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (name === 'select-mode') {
      if (value === null && old !== null) this.#leave()
      return
    }
    if (!value || !this.isConnected) return
    if (!this.hasAttribute('aria-label') || this.getAttribute('aria-label') === old)
      this.setAttribute('aria-label', value)
  }

  connectedCallback(): void {
    const label = this.getAttribute('label')
    if (label && !this.hasAttribute('aria-label')) this.setAttribute('aria-label', label)
    this.setAttribute('role', 'region')
    this.#build()
    this.#chips.observe(this, { childList: true, subtree: true, characterData: true })
    const table = this.querySelector(':scope > e-table')
    if (table) this.#rows.observe(table, { childList: true })
    // Only the empty mark here: the checkboxes inside may not be upgraded yet, and a property set on
    // one before then would hide its own.
    this.#empty()
    this.addEventListener('change', this.#tick)
    this.addEventListener('pointerdown', this.#down)
    this.addEventListener('pointermove', this.#move)
    this.addEventListener('pointerup', this.#cancel)
    this.addEventListener('pointercancel', this.#cancel)
    this.addEventListener('contextmenu', this.#menu)
    this.addEventListener('click', this.#click)
    this.#stop = onLangChange(() => {
      this.#build()
      this.#say()
    })
  }

  disconnectedCallback(): void {
    this.#chips.disconnect()
    this.#rows.disconnect()
    this.removeEventListener('change', this.#tick)
    this.removeEventListener('pointerdown', this.#down)
    this.removeEventListener('pointermove', this.#move)
    this.removeEventListener('pointerup', this.#cancel)
    this.removeEventListener('pointercancel', this.#cancel)
    this.removeEventListener('contextmenu', this.#menu)
    this.removeEventListener('click', this.#click)
    this.#cancel()
    this.#stop?.()
  }

  #boxes(): Box[] {
    return [...this.querySelectorAll<Box>(':scope > e-table > e-row:not([head]) > * > e-checkbox')]
  }

  // The head checkbox and the select-all tick or clear every row; any checkbox then recounts.
  #tick = (event: Event): void => {
    const box = event.target instanceof Element ? event.target.closest<Box>('e-checkbox') : null
    if (!box) return
    if (box === this.#all) {
      for (const one of this.#boxes()) one.checked = box.checked
    } else {
      if (box.closest('e-table')?.parentElement !== this) return
      if (box.closest('e-row[head]')) for (const one of this.#boxes()) one.checked = box.checked
    }
    this.#count()
  }

  #count(): void {
    const boxes = this.#boxes()
    let ticked = 0
    for (const box of boxes) {
      box.closest('e-row')?.toggleAttribute('selected', box.checked)
      if (box.checked) ticked += 1
    }
    const head = this.querySelector<Box>(':scope > e-table > e-row[head] > * > e-checkbox')
    for (const all of [head, this.#all]) {
      if (!all) continue
      all.checked = ticked > 0 && ticked === boxes.length
      all.indeterminate = ticked > 0 && ticked < boxes.length
    }
    this.toggleAttribute('selecting', ticked > 0)
    // A row ticked anywhere, as on a phone turned on its side, is a selection to leave by Done once the
    // list is under 600 px again, so ticking puts the list in select mode.
    if (ticked > 0) this.toggleAttribute('select-mode', true)
    this.#empty()
    if (ticked === this.#selected) return
    this.#selected = ticked
    this.#say()
    this.dispatchEvent(new CustomEvent('e-selection-change', { bubbles: true, detail: { count: ticked } }))
  }

  #leave(): void {
    for (const box of this.#boxes()) box.checked = false
    this.#count()
    // Done goes with the bar, so focus goes back to Select rather than to the page's start.
    if (this.#done?.contains(document.activeElement)) this.#select?.querySelector('button')?.focus()
  }

  #empty(): void {
    const table = this.querySelector(':scope > e-table')
    if (table) this.toggleAttribute('empty', !table.querySelector(':scope > e-row:not([head])'))
  }

  // The count leads the bulk actions, after the select-all, and a screen reader hears it change.
  #say(): void {
    const bulk = this.querySelector(':scope > [slot="bulk"]')
    if (!bulk) return
    if (!this.#status) {
      this.#status = document.createElement('span')
      this.#status.setAttribute('role', 'status')
      if (this.#all?.parentElement === bulk) this.#all.after(this.#status)
      else bulk.prepend(this.#status)
    }
    this.#status.textContent = this.#selected ? words[langOf(this)].selected(this.#selected) : ''
  }

  // Each chip gets its button once; its name follows the chip's words and the page's language. Once
  // the rows hold checkboxes, the select mode parts are built once too, their words in the page's.
  #build(): void {
    for (const chip of this.querySelectorAll<HTMLElement>(':scope > [slot="filter"]')) {
      let button = chip.querySelector<HTMLButtonElement>(':scope > button')
      if (!button) {
        button = document.createElement('button')
        button.type = 'button'
        const icon = document.createElement('e-icon')
        icon.setAttribute('name', 'x')
        button.append(icon)
        button.addEventListener('click', () => this.#remove(chip))
        chip.append(button)
      }
      const name = words[langOf(chip)].remove((chip.textContent ?? '').trim())
      if (button.getAttribute('aria-label') !== name) button.setAttribute('aria-label', name)
    }
    // Without a bulk bar there is no Done to leave select mode by, so none is offered.
    const table = this.querySelector(':scope > e-table')
    const bulk = this.querySelector(':scope > [slot="bulk"]')
    if (!table || !bulk || (!this.#select && !this.#boxes().length)) return
    const said = words[langOf(this)]
    if (!this.#select) {
      // A 44 px icon button on the search's line, after its Add filter, so it takes no line of its own.
      this.#select = document.createElement('e-button')
      this.#select.toggleAttribute('data-select', true)
      this.#select.toggleAttribute('icon', true)
      const icon = document.createElement('e-icon')
      icon.setAttribute('name', 'check')
      this.#select.append(icon)
      this.#select.addEventListener('click', () => {
        this.selectMode = true
        this.#all?.querySelector('input')?.focus()
      })
      const search = this.querySelector(':scope > e-search-field')
      const after = search?.nextElementSibling?.localName === 'e-button' ? search.nextElementSibling : search
      if (after) after.after(this.#select)
      else table.before(this.#select)
    }
    if (this.#select.getAttribute('aria-label') !== said.select) this.#select.setAttribute('aria-label', said.select)
    if (!this.#all) {
      // SAFETY: the kit defines e-checkbox with this one, so the new tag is an ECheckbox with checked
      // and indeterminate.
      this.#all = document.createElement('e-checkbox') as Box
      this.#all.toggleAttribute('data-select-all', true)
      bulk.prepend(this.#all)
    }
    if (!this.#done) {
      this.#done = document.createElement('e-button')
      this.#done.toggleAttribute('data-done', true)
      this.#done.addEventListener('click', () => (this.selectMode = false))
      bulk.append(this.#done)
    }
    if (this.#all.getAttribute('label') !== said.all) this.#all.setAttribute('label', said.all)
    write(this.#done, said.done)
  }

  // A long press on a row, on a phone and away from its checkbox, starts select mode and ticks it.
  #down = (event: PointerEvent): void => {
    this.#pressed = false
    this.#cancel()
    const target = event.target instanceof Element ? event.target : null
    const row = target?.closest('e-row:not([head])')
    if (!row || row.parentElement?.parentElement !== this || target?.closest('e-checkbox')) return
    const box = row.querySelector<Box>(':scope > * > e-checkbox')
    if (!box || !this.#done || !matchMedia(phone).matches) return
    const timer = window.setTimeout(() => {
      this.#press = null
      this.#pressed = true
      this.selectMode = true
      box.checked = true
      this.#count()
    }, hold)
    this.#press = { timer, x: event.clientX, y: event.clientY }
  }

  // A press that moves is a scroll, not a long press.
  #move = (event: PointerEvent): void => {
    if (this.#press && Math.hypot(event.clientX - this.#press.x, event.clientY - this.#press.y) > slop) this.#cancel()
  }

  #cancel = (): void => {
    if (this.#press) window.clearTimeout(this.#press.timer)
    this.#press = null
  }

  // A touch held on a link opens the browser's menu for it; a long press is the list's own.
  #menu = (event: Event): void => {
    if (this.#press || this.#pressed) event.preventDefault()
  }

  #click = (event: Event): void => {
    if (this.#pressed) {
      this.#pressed = false
      event.preventDefault()
      return
    }
    // In select mode on a phone a tap on a row ticks it, as its checkbox does, instead of opening it.
    if (!this.hasAttribute('select-mode') || !matchMedia(phone).matches) return
    const target = event.target instanceof Element ? event.target : null
    const row = target?.closest('e-row:not([head])')
    if (!row || row.parentElement?.parentElement !== this || target?.closest('e-checkbox')) return
    const box = row.querySelector<Box>(':scope > * > e-checkbox')
    if (!box) return
    event.preventDefault()
    box.checked = !box.checked
    this.#count()
  }

  #remove(chip: HTMLElement): void {
    const name = chip.getAttribute('name')
    chip.remove()
    this.querySelector<HTMLElement>(':scope > e-search-field > input')?.focus()
    this.dispatchEvent(new CustomEvent('e-filter-remove', { bubbles: true, detail: { name } }))
  }
}

export function defineIndexTable(): void {
  if (!customElements.get('e-index-table')) customElements.define('e-index-table', EIndexTable)
}
