// e-report-builder: v2.css lays it out and draws its filter chips from their ticked values; v2-host.js,
// which only the Admin loads, asks its result address as the choices change and puts the answer in
// place. The page writes every choice as a form field, so the form saves them with the bar and with
// the script off, and the Admin's Worker works out the result: the builder is chrome, not a data engine.
import { langOf } from '../lang.ts'
import { discarded } from '../save-bar.ts'
import { panelEvent } from '../v2-host-panel.ts'

const words = {
  en: {
    loading: 'Loading the report',
    failed: "The report couldn't load",
    retry: 'Try again',
    add: 'Add filter',
    done: 'Done',
    reads: (label: string, values: string) => `${label} is ${values}`,
    change: (label: string) => `Change the ${label} filter`,
    remove: (label: string) => `Remove the ${label} filter`,
    longest: 'Pick at most 366 days',
    order: 'Pick a day on or after From',
  },
  bn: {
    loading: 'রিপোর্ট আসছে',
    failed: 'রিপোর্টটি আনা যায়নি',
    retry: 'আবার চেষ্টা করুন',
    add: 'ফিল্টার যোগ করুন',
    done: 'সম্পন্ন',
    reads: (label: string, values: string) => `${label}: ${values}`,
    change: (label: string) => `${label} ফিল্টার বদলান`,
    remove: (label: string) => `${label} ফিল্টার সরান`,
    longest: 'সর্বোচ্চ ৩৬৬ দিন বাছুন',
    order: 'শুরুর দিন বা তার পরের দিন বাছুন',
  },
}

// A filter's boxes, each named for its dimension and ticked for a value in the filter.
const boxesOf = (filter: Element) => [...filter.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')]
// The words written beside a box.
const wordsOf = (box: HTMLInputElement) => box.nextElementSibling?.textContent?.trim() ?? box.value

function made(tag: string, attributes: Record<string, string>, text = ''): HTMLElement {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  element.textContent = text
  return element
}

/**
 * A report a staff member builds: a card of choices, each a form field, and a result card whose
 * `e-report-result` the Admin draws for them. Every change but the name asks the `result` address
 * with the choices as its query, and the answer's `e-report-result` takes the old one's place; while
 * it loads the old one stays under a loading bar, and a failed answer keeps it and offers Try again.
 * Chart and Table are an `e-button-group` that writes the hidden `view` field. It sits in a
 * `form[data-save-bar]`, which saves the choices. It works in the Admin, where v2-host.js runs.
 * @tag e-report-builder
 * @attr result - The address asked on each change; it answers HTML holding an `e-report-result`.
 * @slot - The choices' card, marked `data-part="build"`, then the result's card, marked `data-part="result"`.
 */
export class EReportBuilder extends HTMLElement {
  #asked = 0
  #picker: (HTMLElement & { show?: () => void; hide?: () => void }) | null = null
  // What the picker's Done does for the values it shows.
  #done: (() => void) | null = null

  connectedCallback(): void {
    for (const filter of this.querySelectorAll('e-report-filter')) this.#chip(filter)
    this.querySelector('[data-part="add-filter"]')?.addEventListener('click', this.#adding)
    this.addEventListener('change', this.#changed)
    this.addEventListener('e-button-group-change', this.#view)
    this.closest('form')?.addEventListener(discarded, this.#discarded)
  }

  disconnectedCallback(): void {
    this.removeEventListener('change', this.#changed)
    this.removeEventListener('e-button-group-change', this.#view)
    this.closest('form')?.removeEventListener(discarded, this.#discarded)
  }

  get #say() {
    return words[langOf(this)]
  }

  #field(name: string): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  }

  // Only a choice asks: the name is the report's, not the result's, and a control with no name, as
  // a filter's tick list, is not a choice yet.
  #changed = (event: Event): void => {
    const target = event.target
    const name = target instanceof HTMLInputElement || target instanceof HTMLSelectElement ? target.name : ''
    if (name && name !== 'name') void this.#ask()
  }

  // Chart or Table writes the view field, which the save bar counts as an edit.
  #view = (event: Event): void => {
    const field = this.#field('view')
    const value = event instanceof CustomEvent ? String(event.detail?.value ?? '') : ''
    if (!field || !value) return
    field.value = value
    field.dispatchEvent(new Event('input', { bubbles: true }))
    void this.#ask()
  }

  // Discard put the saved choices back without a change event, so the view's buttons and the chips'
  // names follow their fields and the result is asked for them.
  #discarded = (): void => {
    const view = this.#field('view')?.value
    for (const button of this.querySelectorAll('e-button-group > e-button[value]'))
      button.toggleAttribute('pressed', button.getAttribute('value') === view)
    for (const filter of this.querySelectorAll('e-report-filter')) this.#name(filter)
    void this.#ask()
  }

  // v2.css draws a chip's words from its ticked boxes; the script lays a button over the chip that
  // opens its values, and its x, which unticks them all.
  #chip(filter: Element): void {
    if (filter.querySelector(':scope > [data-part="edit"]')) return
    const label = filter.getAttribute('label') ?? ''
    const edit = made('button', { type: 'button', 'data-part': 'edit' })
    const remove = made('button', { type: 'button', 'data-part': 'remove', 'aria-label': this.#say.remove(label) })
    remove.append(made('e-icon', { name: 'x' }))
    edit.addEventListener('click', () => this.#values(filter))
    remove.addEventListener('click', () => {
      this.#tick(filter, [])
      this.querySelector<HTMLElement>('[data-part="add-filter"] button')?.focus()
    })
    filter.append(edit, remove)
    this.#name(filter)
  }

  // The chip's button reads as the chip does, "Channel is Facebook, Messenger", and says what it does.
  #name(filter: Element): void {
    const label = filter.getAttribute('label') ?? ''
    const values = boxesOf(filter)
      .filter((box) => box.checked)
      .map(wordsOf)
      .join(', ')
    filter
      .querySelector(':scope > [data-part="edit"]')
      ?.setAttribute('aria-label', `${this.#say.reads(label, values)}. ${this.#say.change(label)}`)
    const add = this.querySelector<HTMLElement>('[data-part="add-filter"]')
    if (add) add.hidden = this.#unused().length === 0
  }

  // The filters with no value ticked, which Add filter offers.
  #unused(): Element[] {
    return [...this.querySelectorAll('e-report-filter')].filter((filter) => !boxesOf(filter).some((box) => box.checked))
  }

  // Ticks the filter's boxes for these values and tells the form, which asks the result and counts
  // the edit; the same values again change nothing.
  #tick(filter: Element, values: string[]): void {
    const boxes = boxesOf(filter)
    if (boxes.every((box) => box.checked === values.includes(box.value))) return
    for (const box of boxes) box.checked = values.includes(box.value)
    this.#name(filter)
    boxes[0]?.dispatchEvent(new Event('change', { bubbles: true }))
  }

  // One modal for Add filter: first the dimensions no filter uses, then a dimension's values to tick.
  #modal(): HTMLElement & { show?: () => void; hide?: () => void } {
    if (this.#picker) return this.#picker
    const picker = made('e-modal', { width: '420', 'data-part': 'picker' })
    const done = made('e-button', { type: 'button', tone: 'primary', slot: 'footer' }, this.#say.done)
    done.addEventListener('click', () => this.#done?.())
    picker.append(made('div', { 'data-part': 'list' }), done)
    // Enter in the modal is the modal's, not the form's Save.
    picker.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
    })
    this.append(picker)
    this.#picker = picker
    return picker
  }

  #adding = (): void => {
    const picker = this.#modal()
    const list = picker.querySelector('[data-part="list"]')
    picker.setAttribute('heading', this.#say.add)
    picker.toggleAttribute('data-values', false)
    list?.replaceChildren(
      ...this.#unused().map((filter) => {
        const pick = made('button', { type: 'button' }, filter.getAttribute('label') ?? '')
        pick.addEventListener('click', () => this.#values(filter))
        return pick
      }),
    )
    picker.show?.()
  }

  // A dimension's values, ticked as the filter has them; Done puts the ticks in the filter.
  #values(filter: Element): void {
    const picker = this.#modal()
    const list = picker.querySelector('[data-part="list"]')
    picker.setAttribute('heading', filter.getAttribute('label') ?? '')
    picker.toggleAttribute('data-values', true)
    const ticks = boxesOf(filter).map((box) => {
      const tick = made('e-checkbox', { label: wordsOf(box), value: box.value })
      tick.toggleAttribute('checked', box.checked)
      return tick
    })
    list?.replaceChildren(...ticks)
    this.#done = () => {
      const values = ticks
        .filter((tick) => tick.querySelector('input')?.checked)
        .map((tick) => tick.getAttribute('value') ?? '')
      picker.hide?.()
      this.#tick(filter, values)
    }
    picker.show?.()
  }

  // The result's query: every choice but the name, the custom range's days only for Custom, and
  // the view last.
  #query(): URLSearchParams {
    const form = this.closest('form')
    const query = new URLSearchParams()
    if (!form) return query
    const data = new FormData(form)
    const custom = data.get('range') === 'CUSTOM'
    for (const [name, value] of data) {
      if (name === 'name' || name === 'view' || (!custom && (name === 'from' || name === 'to'))) continue
      query.append(name, String(value))
    }
    query.append('view', String(data.get('view') ?? 'TABLE'))
    return query
  }

  // A custom range is asked only once both days are picked and it spans 1 to 366 days, both ends
  // counted; a span the API would refuse says why under To.
  #inRange(): boolean {
    const to = this.querySelector('e-date-field[name="to"]')
    if (this.querySelector<HTMLSelectElement>('select[name="range"]')?.value !== 'CUSTOM') {
      to?.removeAttribute('error')
      this.#field('to')?.setCustomValidity('')
      return true
    }
    const from = this.#field('from')?.value
    const until = this.#field('to')?.value
    if (!from || !until) return false
    const days = (Date.parse(until) - Date.parse(from)) / 86_400_000 + 1
    const error = days > 366 ? this.#say.longest : days < 1 ? this.#say.order : ''
    if (error) to?.setAttribute('error', error)
    else to?.removeAttribute('error')
    // The bar's Save checks the form's validity, so a refused range is not saved either.
    this.#field('to')?.setCustomValidity(error)
    return !error
  }

  async #ask(): Promise<void> {
    const ticket = ++this.#asked
    const card = this.querySelector('[data-part="result"]')
    this.querySelector(':scope [data-part="failed"]')?.remove()
    if (!this.#inRange()) {
      this.querySelector('[data-part="loading"]')?.remove()
      return
    }
    let loading = this.querySelector('[data-part="loading"]')
    if (!loading) {
      loading = made('e-progress-bar', { 'data-part': 'loading', label: this.#say.loading })
      this.querySelector('e-report-result')?.before(loading)
    }
    let answer: Element | null = null
    try {
      const response = await fetch(new URL(`${this.getAttribute('result') ?? ''}?${this.#query()}`, location.href))
      if (response.ok) {
        answer = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('e-report-result')
      }
    } catch {
      answer = null
    }
    // A later change asked again, or the page moved on: this answer is no one's.
    if (ticket !== this.#asked || !this.isConnected) return
    loading.remove()
    const shown = this.querySelector('e-report-result')
    if (answer && shown) {
      const adopted = document.adoptNode(answer)
      // The Admin puts the answer in the staff member's language before it shows.
      document.dispatchEvent(new CustomEvent(panelEvent, { detail: { panel: adopted } }))
      shown.replaceWith(adopted)
      return
    }
    const say = this.#say
    const failed = made('e-banner', { tone: 'critical', 'data-part': 'failed' })
    const retry = made('e-button', { type: 'button' }, say.retry)
    retry.addEventListener('click', () => void this.#ask())
    failed.append(made('p', {}, say.failed), retry)
    ;(shown ?? card?.lastElementChild)?.before(failed)
  }
}

export function defineReportBuilder(): void {
  if (!customElements.get('e-report-builder')) customElements.define('e-report-builder', EReportBuilder)
}

/**
 * One filter of a report builder: a chip for a dimension, drawn while one of its values is ticked. The
 * page writes each value as a hidden box named for the dimension beside its words, ticked for a value
 * in the filter, so the ticked ones post as repeated fields; v2.css draws the chip as "Channel is
 * Facebook, Messenger" from them, or "চ্যানেল: ফেসবুক, মেসেঞ্জার" in Bangla.
 * @tag e-report-filter
 * @attr name - The dimension's field, such as `channel`; its boxes carry the same name.
 * @attr label - The dimension's name, such as `Channel`, which starts the chip.
 * @slot - A `<span>` for each value: `<input type="checkbox" name value hidden>`, `checked` when in the filter, then a `<span>` of its words.
 */
export declare class EReportFilter extends HTMLElement {}

/**
 * A report's result, which the result address answers and the builder puts in place: an `e-table`
 * ending in an `e-row total`, an `e-chart` naming every bar with a line of its totals, or an
 * `e-empty-state`. A chart in it stands each bar's name upright under the bar.
 * @tag e-report-result
 * @attr {'TABLE' | 'CHART'} view - Whether it is the table or the chart.
 * @slot - The table, the chart, or the empty state.
 */
export declare class EReportResult extends HTMLElement {}
