// e-index-table. CSS lays out the card; the script gives each filter chip its remove button, in the
// room the CSS kept for it. Removing a chip takes it away and tells the page with a bubbling
// e-filter-remove event naming the filter, and focus goes to the search field so it is not lost.
//
// It also keeps the selection. The app puts an e-checkbox in each row's first cell and one in the head
// row; ticking rows marks them selected, shows the count and the app's slot="bulk" actions in place
// of the toolbar, and sets the head checkbox to ticked, mixed or clear. New rows from the app start
// unselected. Each change of count is told with a bubbling e-selection-change event.
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
  en: { remove: (filter: string) => `Remove ${filter}`, selected: (count: number) => `${count} selected` },
  bn: {
    remove: (filter: string) => `${filter} সরান`,
    selected: (count: number) => `${digits(count, 'bn')}টি নির্বাচিত`,
  },
}

/**
 * Many records in one card: view tabs, a toolbar with search, filter chips and sort, a table whose rows
 * can be ticked, and a pager. Below 600 px each row is a card; a cell's `card` attribute (`title`,
 * `status`, `aside`, `body`, `end` or `meta`) places it there, and a cell with none stays out of the card.
 * The parts are told apart by their tags: `e-tabs`, `e-table`, `e-empty-state` and `e-pagination` take a
 * row each, and every other child sits in the toolbar.
 * @tag e-index-table
 * @attr label - Names the card as a region for assistive tech.
 * @fires e-selection-change - A row or the head checkbox changed the number of ticked rows. `detail` is `{ count }`.
 * @fires e-filter-remove - A filter chip was removed. `detail` is `{ name }`, the chip's `name` attribute.
 * @slot - The app's parts in order: `e-tabs`, the toolbar controls, `e-table`, `e-empty-state` and `e-pagination`.
 * @slot filter - A removable filter chip (`slot="filter"`, with a `name`). The script adds its remove button.
 * @slot bulk - The actions for ticked rows (`slot="bulk"`). While rows are ticked they take the toolbar's place, after the count.
 */
export class EIndexTable extends HTMLElement {
  #chips = new MutationObserver(() => this.#build())
  #rows = new MutationObserver(() => this.#count())
  #stop: (() => void) | undefined
  #status: HTMLElement | null = null
  #selected = 0

  static observedAttributes = ['label']

  // A new label, as a page switching language sets, names the region afresh.
  attributeChangedCallback(_name: string, old: string | null, label: string | null): void {
    if (!label || !this.isConnected) return
    if (!this.hasAttribute('aria-label') || this.getAttribute('aria-label') === old)
      this.setAttribute('aria-label', label)
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
    this.#stop = onLangChange(() => {
      this.#build()
      this.#say()
    })
  }

  disconnectedCallback(): void {
    this.#chips.disconnect()
    this.#rows.disconnect()
    this.removeEventListener('change', this.#tick)
    this.#stop?.()
  }

  #boxes(): Box[] {
    return [...this.querySelectorAll<Box>(':scope > e-table > e-row:not([head]) > * > e-checkbox')]
  }

  // The head checkbox ticks or clears every row; any checkbox then recounts.
  #tick = (event: Event): void => {
    const box = event.target instanceof Element ? event.target.closest<Box>('e-checkbox') : null
    if (!box || box.closest('e-table')?.parentElement !== this) return
    if (box.closest('e-row[head]')) for (const one of this.#boxes()) one.checked = box.checked
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
    if (head) {
      head.checked = ticked > 0 && ticked === boxes.length
      head.indeterminate = ticked > 0 && ticked < boxes.length
    }
    this.toggleAttribute('selecting', ticked > 0)
    this.#empty()
    if (ticked === this.#selected) return
    this.#selected = ticked
    this.#say()
    this.dispatchEvent(new CustomEvent('e-selection-change', { bubbles: true, detail: { count: ticked } }))
  }

  #empty(): void {
    const table = this.querySelector(':scope > e-table')
    if (table) this.toggleAttribute('empty', !table.querySelector(':scope > e-row:not([head])'))
  }

  // The count leads the bulk actions, and a screen reader hears it change.
  #say(): void {
    const bulk = this.querySelector(':scope > [slot="bulk"]')
    if (!bulk) return
    if (!this.#status) {
      this.#status = document.createElement('span')
      this.#status.setAttribute('role', 'status')
      bulk.prepend(this.#status)
    }
    this.#status.textContent = this.#selected ? words[langOf(this)].selected(this.#selected) : ''
  }

  // Each chip gets its button once; its name follows the chip's words and the page's language.
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
