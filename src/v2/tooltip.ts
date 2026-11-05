// e-tooltip: a short text shown by its trigger, the element it wraps, on hover and on keyboard focus.
// The script adds a role=tooltip bubble inside the tag, position: fixed, placed by place(). A trigger
// with no name of its own takes the text as its name; one with a name is described by it.
import { place } from './place.ts'

let count = 0

const focusable = 'a[href], button, input, select, textarea, [tabindex]'

/**
 * A short text shown beside the control it wraps, on hover and on keyboard focus. Escape hides it. It
 * fires no event. A control with no name takes the text as its name; one with a name is described by it.
 * @tag e-tooltip
 * @attr text - The words in the bubble.
 * @slot - The one control the tooltip belongs to.
 */
export class ETooltip extends HTMLElement {
  static observedAttributes = ['text']

  #bubble: HTMLElement | null = null
  #hovered = false
  #focused = false
  // Whether the trigger's aria-label is ours, so a change of text rewrites it.
  #named = false
  // e-button builds its native button when it upgrades, which may be after this tag connects.
  #observer = new MutationObserver(() => this.#wire())

  get #tag(): HTMLElement | null {
    const first = this.firstElementChild
    return first instanceof HTMLElement && first !== this.#bubble ? first : null
  }

  // The element that takes focus: the tag, or the native control a custom tag builds inside it.
  get #control(): HTMLElement | null {
    const tag = this.#tag
    return tag?.matches(focusable) ? tag : (tag?.querySelector<HTMLElement>(focusable) ?? null)
  }

  connectedCallback(): void {
    if (!this.#bubble) {
      const bubble = document.createElement('div')
      bubble.setAttribute('role', 'tooltip')
      bubble.id = `e-tooltip-${++count}`
      bubble.dataset.part = 'bubble'
      bubble.hidden = true
      bubble.textContent = this.getAttribute('text') ?? ''
      this.append(bubble)
      this.#bubble = bubble
    }
    this.addEventListener('pointerenter', this.#enter)
    this.addEventListener('pointerleave', this.#leave)
    this.addEventListener('focusin', this.#focusin)
    this.addEventListener('focusout', this.#focusout)
    this.#observer.observe(this, { childList: true, subtree: true })
    this.#wire()
  }

  disconnectedCallback(): void {
    this.removeEventListener('pointerenter', this.#enter)
    this.removeEventListener('pointerleave', this.#leave)
    this.removeEventListener('focusin', this.#focusin)
    this.removeEventListener('focusout', this.#focusout)
    this.#observer.disconnect()
    this.#set(false, false)
  }

  attributeChangedCallback(): void {
    if (!this.#bubble) return
    this.#bubble.textContent = this.getAttribute('text') ?? ''
    this.#wire()
  }

  // The name goes on the tag as an attribute: e-button passes its aria-label to the native button,
  // and keeps it there across its own updates. The description has no such path, so it goes on the
  // native control once that exists.
  #wire(): void {
    const tag = this.#tag
    if (!tag || !this.#bubble) return
    const text = this.#bubble.textContent ?? ''
    if (this.#named || (!tag.hasAttribute('aria-label') && !tag.textContent?.trim())) {
      this.#named = true
      if (tag.getAttribute('aria-label') !== text) tag.setAttribute('aria-label', text)
    } else {
      this.#control?.setAttribute('aria-describedby', this.#bubble.id)
    }
  }

  #set(hovered: boolean, focused: boolean): void {
    this.#hovered = hovered
    this.#focused = focused
    const bubble = this.#bubble
    const tag = this.#tag
    if (!bubble || !tag) return
    const shown = hovered || focused
    if (shown === !bubble.hidden) return
    bubble.hidden = !shown
    if (shown) {
      place(tag, bubble)
      document.addEventListener('keydown', this.#escape, true)
    } else {
      document.removeEventListener('keydown', this.#escape, true)
    }
  }

  // The bubble is inside the tag, so the pointer may move onto it and the bubble stays.
  #enter = (): void => this.#set(true, this.#focused)
  #leave = (): void => this.#set(false, this.#focused)

  // Only keyboard focus shows it: a click focuses the button too, and the hover has shown it already.
  #focusin = (event: FocusEvent): void => {
    if (event.target instanceof Element && event.target.matches(':focus-visible')) this.#set(this.#hovered, true)
  }
  #focusout = (): void => this.#set(this.#hovered, false)

  // Escape hides the bubble and goes no further, so a popover or modal around it stays open: a
  // listener stops, and preventDefault stops a <dialog>'s own close on Escape.
  #escape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    this.#set(false, false)
  }
}

export function defineTooltip(): void {
  if (!customElements.get('e-tooltip')) customElements.define('e-tooltip', ETooltip)
}
