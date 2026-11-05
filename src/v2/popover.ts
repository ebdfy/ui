// e-popover: the element marked slot="trigger" opens a panel below it; Escape closes it, focus back on the trigger.
// The script moves the content into one panel inside the tag, once, so the tag's box stays the
// trigger's. place() puts the panel below the trigger, inside the window.
import { place } from './place.ts'

let count = 0

/**
 * A panel of any content that opens below its trigger. Escape or a press outside closes it. It fires no event.
 * @tag e-popover
 * @attr label - Names the panel for assistive tech.
 * @slot - The panel's content, in elements rather than loose text.
 * @slot trigger - The control that opens and closes the panel.
 */
export class EPopover extends HTMLElement {
  static observedAttributes = ['label']

  #panel: HTMLElement | null = null
  // e-button builds its native button when it upgrades, which may be after this tag connects.
  #observer = new MutationObserver(() => this.#state())

  get #tag(): HTMLElement | null {
    return this.querySelector<HTMLElement>(':scope > [slot="trigger"]')
  }

  // The native button an e-button builds is what takes focus and the aria-* state. Until it is built
  // there is none, so the tag itself never carries a state that would go stale.
  get #trigger(): HTMLElement | null {
    const tag = this.#tag
    return tag?.localName.includes('-') ? tag.querySelector<HTMLElement>(':scope > button') : tag
  }

  get #open(): boolean {
    return this.#panel !== null && !this.#panel.hidden
  }

  connectedCallback(): void {
    if (!this.#panel) {
      // A dialog named by the label: the content is any markup, not a list of commands. It is not
      // modal and focus stays on the trigger, and the panel follows it, so Tab goes on into it.
      const panel = document.createElement('div')
      panel.setAttribute('role', 'dialog')
      panel.id = `e-popover-${++count}`
      panel.dataset.part = 'panel'
      panel.hidden = true
      panel.append(...[...this.childNodes].filter((node) => node !== this.#tag))
      this.append(panel)
      this.#panel = panel
      this.attributeChangedCallback()
    }
    this.addEventListener('click', this.#click)
    this.#observer.observe(this, { childList: true, subtree: true })
    this.#state()
  }

  // The label names the panel, and a new one, as a page switching language sets, renames it.
  attributeChangedCallback(): void {
    const label = this.getAttribute('label')
    if (label === null) this.#panel?.removeAttribute('aria-label')
    else this.#panel?.setAttribute('aria-label', label)
  }

  disconnectedCallback(): void {
    this.removeEventListener('click', this.#click)
    this.#observer.disconnect()
    if (this.#open) this.#hide(false)
  }

  #state(): void {
    const trigger = this.#trigger
    trigger?.setAttribute('aria-haspopup', 'dialog')
    trigger?.setAttribute('aria-expanded', String(this.#open))
    trigger?.setAttribute('aria-controls', this.#panel!.id)
  }

  #place = (): void => {
    const trigger = this.#trigger
    if (trigger) place(trigger, this.#panel!)
  }

  #show(): void {
    this.#panel!.hidden = false
    this.#place()
    this.#state()
    document.addEventListener('pointerdown', this.#outside)
    document.addEventListener('keydown', this.#keydown)
    // Scroll does not bubble, so a capturing listener hears every scrolling box.
    document.addEventListener('scroll', this.#place, true)
    window.addEventListener('resize', this.#place)
  }

  #hide(refocus: boolean): void {
    this.#panel!.hidden = true
    document.removeEventListener('pointerdown', this.#outside)
    document.removeEventListener('keydown', this.#keydown)
    document.removeEventListener('scroll', this.#place, true)
    window.removeEventListener('resize', this.#place)
    this.#state()
    if (refocus) this.#trigger?.focus()
  }

  #click = (event: Event): void => {
    if (!(event.target instanceof Node) || !this.#tag?.contains(event.target)) return
    if (this.#open) this.#hide(true)
    else this.#show()
  }

  // A press outside closes the popover and leaves focus where the person put it.
  #outside = (event: Event): void => {
    if (event.target instanceof Node && !this.contains(event.target)) this.#hide(false)
  }

  // On the document, as a click on the panel's plain text leaves focus on the body.
  #keydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    this.#hide(true)
  }
}

export function definePopover(): void {
  if (!customElements.get('e-popover')) customElements.define('e-popover', EPopover)
}
