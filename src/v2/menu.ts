// e-menu and e-menu-item: the e-button marked slot="trigger" opens a panel of e-menu-items below it,
// by the WAI-ARIA menu pattern. The script moves the items into one role=menu panel inside the tag,
// once, so the tag's box stays the trigger's. place() puts the panel below the trigger.
import { place } from './place.ts'

/**
 * One choice in an `e-menu`. Listen for `click` on it; the menu closes after a press.
 * @tag e-menu-item
 * @attr {'danger'} tone - Draws the item in the danger colour, for an action such as Delete.
 * @attr href - An address the item follows when picked, as a link does: Ctrl or ⌘ opens it in a new tab.
 * @slot - The item's label, after an optional 20 px `e-icon` or an app's `.e-tile` with `data-size="20"`.
 */
export class EMenuItem extends HTMLElement {
  connectedCallback(): void {
    this.setAttribute('role', 'menuitem')
    this.tabIndex = -1
    this.addEventListener('click', this.#follow)
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#follow)
  }

  // The press passes to a link made for the moment, so the page's own handling of links, such as
  // the Admin's leave guard, and Ctrl or ⌘ for a new tab apply to the item too.
  #follow = (event: MouseEvent): void => {
    const href = this.getAttribute('href')
    if (href === null || event.target instanceof HTMLAnchorElement) return
    const link = document.createElement('a')
    link.href = href
    link.hidden = true
    this.append(link)
    link.dispatchEvent(new MouseEvent('click', event))
    link.remove()
  }
}

/**
 * A menu of actions. A press on the trigger opens a panel of items below it; the arrow keys, Home and
 * End move between items, and Escape, a Tab or a press outside closes it.
 * @tag e-menu
 * @slot trigger - The `e-button` that opens the menu (`slot="trigger"`).
 * @slot - The `e-menu-item` children, which the script moves into the panel.
 */
export class EMenu extends HTMLElement {
  #panel: HTMLElement | null = null

  // The native button an e-button builds is what takes focus and the aria-* state.
  get #trigger(): HTMLElement | null {
    const tag = this.querySelector<HTMLElement>(':scope > [slot="trigger"]')
    return tag?.querySelector<HTMLElement>(':scope > button') ?? tag
  }

  get #items(): HTMLElement[] {
    return [...(this.#panel?.querySelectorAll<HTMLElement>(':scope > e-menu-item') ?? [])]
  }

  get #open(): boolean {
    return this.#panel !== null && !this.#panel.hidden
  }

  connectedCallback(): void {
    if (!this.#panel) {
      const panel = document.createElement('div')
      panel.setAttribute('role', 'menu')
      panel.dataset.part = 'panel'
      panel.hidden = true
      panel.append(...this.querySelectorAll(':scope > e-menu-item'))
      this.append(panel)
      this.#panel = panel
      panel.addEventListener('keydown', this.#keydown)
      panel.addEventListener('click', this.#panelClick)
    }
    this.addEventListener('click', this.#click)
    this.#state()
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#click)
    document.removeEventListener('pointerdown', this.#outside)
    if (this.#panel) this.#panel.hidden = true
  }

  #state(): void {
    const trigger = this.#trigger
    trigger?.setAttribute('aria-haspopup', 'menu')
    trigger?.setAttribute('aria-expanded', String(this.#open))
  }

  #show(): void {
    const panel = this.#panel!
    panel.hidden = false
    const trigger = this.#trigger
    if (trigger) place(trigger, panel)
    this.#state()
    document.addEventListener('pointerdown', this.#outside)
    this.#items[0]?.focus()
  }

  #hide(refocus: boolean): void {
    this.#panel!.hidden = true
    document.removeEventListener('pointerdown', this.#outside)
    this.#state()
    if (refocus) this.#trigger?.focus()
  }

  #click = (event: Event): void => {
    const trigger = this.#trigger
    if (!trigger || !(event.target instanceof Node)) return
    if (!this.querySelector(':scope > [slot="trigger"]')?.contains(event.target)) return
    if (this.#open) this.#hide(true)
    else this.#show()
  }

  // A press outside closes the menu and leaves focus where the person put it.
  #outside = (event: Event): void => {
    if (event.target instanceof Node && !this.contains(event.target)) this.#hide(false)
  }

  #panelClick = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('e-menu-item')) this.#hide(true)
  }

  #keydown = (event: KeyboardEvent): void => {
    const items = this.#items
    const at = items.findIndex((item) => item === document.activeElement)
    const go = (index: number) => {
      event.preventDefault()
      items[(index + items.length) % items.length]?.focus()
    }
    if (event.key === 'ArrowDown') go(at + 1)
    else if (event.key === 'ArrowUp') go(at < 0 ? items.length - 1 : at - 1)
    else if (event.key === 'Home') go(0)
    else if (event.key === 'End') go(items.length - 1)
    else if ((event.key === 'Enter' || event.key === ' ') && at >= 0) {
      event.preventDefault()
      items[at]!.click()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.#hide(true)
    } else if (event.key === 'Tab') {
      // Focus goes to the trigger first, so the Tab itself moves on from there and never into the panel.
      this.#hide(true)
    }
  }
}

export function defineMenu(): void {
  if (!customElements.get('e-menu-item')) customElements.define('e-menu-item', EMenuItem)
  if (!customElements.get('e-menu')) customElements.define('e-menu', EMenu)
}
