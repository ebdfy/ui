// e-tabs and e-tab. CSS draws the row; these add the tablist roles, the keyboard and the
// e-tab-change event, and move nothing. The app moves the selection by setting `selected` on a tab.
/**
 * One tab of an `e-tabs` row. The app moves the selection by setting `selected`; a click or key on a tab does it too.
 * @tag e-tab
 * @attr {boolean} selected - The current tab, underlined. Only one tab in a row has it.
 * @attr {number} count - A number shown after the label, and added to the tab's accessible name.
 * @attr value - What `e-tab-change` reports when the tab is chosen.
 * @slot - The tab's label.
 */
export class ETab extends HTMLElement {
  static observedAttributes = ['selected', 'count']

  // The count is drawn by CSS and is not reliably part of the name, so the name carries it.
  #seen = new MutationObserver(() => this.#name())

  connectedCallback(): void {
    this.setAttribute('role', 'tab')
    this.#mark()
    this.#name()
    this.#seen.observe(this, { childList: true, characterData: true, subtree: true })
  }

  disconnectedCallback(): void {
    this.#seen.disconnect()
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return
    if (name === 'count') this.#name()
    else {
      // Only one tab is selected, so a tab the app selects takes it from the others.
      if (this.hasAttribute('selected')) {
        for (const other of this.parentElement?.querySelectorAll(':scope > e-tab[selected]') ?? []) {
          if (other !== this) other.removeAttribute('selected')
        }
      }
      this.#mark()
    }
  }

  // The selected tab is the one Tab reaches; with none selected, the first is, so the row is never
  // out of reach.
  #mark(): void {
    const selected = this.hasAttribute('selected')
    const none = !this.parentElement?.querySelector(':scope > e-tab[selected]')
    const first = this.parentElement?.querySelector(':scope > e-tab') === this
    this.setAttribute('aria-selected', String(selected))
    this.setAttribute('tabindex', selected || (none && first) ? '0' : '-1')
  }

  #name(): void {
    const count = this.getAttribute('count')
    if (count) this.setAttribute('aria-label', `${this.textContent.trim()} ${count}`)
    else this.removeAttribute('aria-label')
  }
}

/**
 * A row of tabs, one for each view. It adds the tablist roles and the arrow, Home and End keys. It
 * moves nothing but the selected mark, and a row wider than its box scrolls inside it.
 * @tag e-tabs
 * @attr label - Names the row for assistive tech.
 * @attr {boolean} overflowing - Set by the script while the row has more to scroll to at its end, which fades the last 24 px. Do not set it.
 * @fires e-tab-change - The person chose a tab that was not selected. `detail` is `{ value }`, the tab's `value`.
 * @slot - Its `e-tab`s.
 */
export class ETabs extends HTMLElement {
  static observedAttributes = ['label']

  connectedCallback(): void {
    this.setAttribute('role', 'tablist')
    this.#label()
    this.addEventListener('click', this.#click)
    this.addEventListener('keydown', this.#keydown)
    this.addEventListener('scroll', this.#edge)
    this.#size.observe(this)
    this.#edge()
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#click)
    this.removeEventListener('keydown', this.#keydown)
    this.removeEventListener('scroll', this.#edge)
    this.#size.disconnect()
  }

  // Fires when the row's own box changes size, such as on a window resize.
  #size = new ResizeObserver(() => this.#edge())

  // Abs, because a right-to-left row scrolls through negative offsets. One pixel of slack covers
  // fractional scroll positions.
  #edge = (): void => {
    const more = this.scrollWidth - this.clientWidth - Math.abs(this.scrollLeft) > 1
    this.toggleAttribute('overflowing', more)
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#label()
  }

  #label(): void {
    const label = this.getAttribute('label')
    if (label) this.setAttribute('aria-label', label)
  }

  #tab(event: Event): ETab | null {
    const tab = event.target instanceof Element ? event.target.closest('e-tab') : null
    return tab instanceof ETab ? tab : null
  }

  #select(tab: ETab): void {
    if (tab.hasAttribute('selected')) return
    tab.setAttribute('selected', '')
    this.dispatchEvent(new CustomEvent('e-tab-change', { bubbles: true, detail: { value: tab.getAttribute('value') } }))
  }

  #click = (event: Event): void => {
    const tab = this.#tab(event)
    if (tab) this.#select(tab)
  }

  #keydown = (event: KeyboardEvent): void => {
    const tab = this.#tab(event)
    if (!tab) return
    const tabs = [...this.querySelectorAll<ETab>(':scope > e-tab')]
    const at = tabs.indexOf(tab)
    let to: ETab | undefined
    if (event.key === 'ArrowRight') to = tabs[(at + 1) % tabs.length]
    else if (event.key === 'ArrowLeft') to = tabs[(at - 1 + tabs.length) % tabs.length]
    else if (event.key === 'Home') to = tabs[0]
    else if (event.key === 'End') to = tabs[tabs.length - 1]
    else if (event.key === 'Enter' || event.key === ' ') to = tab
    if (!to) return
    event.preventDefault()
    this.#select(to)
    to.focus()
  }
}

export function defineTabs(): void {
  if (!customElements.get('e-tab')) customElements.define('e-tab', ETab)
  if (!customElements.get('e-tabs')) customElements.define('e-tabs', ETabs)
}
