import { LitElement, css, html } from 'lit'

const gap = 4
const edge = 4

const focusable = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]'

/**
 * A short text shown above its trigger, the element it wraps, on hover or keyboard focus.
 *
 * @slot - The trigger: the element the tooltip is for.
 * @csspart tooltip - The bubble that holds the text.
 */
export class EbTooltip extends LitElement {
  static override properties = {
    text: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
    }
    /* The tooltip may have made its trigger focusable, so it draws the trigger's ring too. */
    ::slotted(:focus-visible) {
      outline: 2px solid var(--eb-color-focus);
      outline-offset: 2px;
    }
    .bubble {
      position: fixed;
      inset: auto;
      margin: 0;
      box-sizing: border-box;
      width: max-content;
      max-width: calc(100vw - ${edge * 2}px);
      overflow: visible;
      border: 0;
      padding: 4px 8px;
      border-radius: var(--eb-radius-sm);
      background: var(--eb-color-inverse);
      color: var(--eb-color-on-inverse);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-caption);
      line-height: var(--eb-line-height-caption);
      box-shadow:
        inset 0 0 0 1px var(--eb-color-inverse-edge),
        var(--eb-shadow-2);
    }
    /* The bubble fades in and rises 4 px; with reduced motion it shows at once. */
    @media (prefers-reduced-motion: no-preference) {
      .bubble {
        transition-property: opacity, transform;
        transition-duration: var(--eb-duration-fast);
        transition-timing-function: var(--eb-ease-out);
      }
      @starting-style {
        .bubble {
          opacity: 0;
          transform: translateY(4px);
        }
      }
    }
  `

  /** The short text the tooltip shows. */
  declare text: string

  #hovered = false
  #focused = false
  // Whether the aria-label on the trigger is ours, so a change of text may rewrite it.
  #named = false

  constructor() {
    super()
    this.text = ''
    this.addEventListener('mouseenter', () => this.#set({ hovered: true }))
    this.addEventListener('mouseleave', () => this.#set({ hovered: false }))
    this.addEventListener('focusin', (event) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) {
        this.#set({ focused: true })
      }
    })
    this.addEventListener('focusout', () => this.#set({ focused: false }))
  }

  get #trigger(): HTMLElement | null {
    const first = this.firstElementChild
    return first instanceof HTMLElement ? first : null
  }

  get #bubble(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.bubble')
  }

  #set(state: { hovered?: boolean; focused?: boolean }): void {
    this.#hovered = state.hovered ?? this.#hovered
    this.#focused = state.focused ?? this.#focused
    this.#sync()
  }

  // A press of Escape while the bubble shows closes it and goes no further.
  #escape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    this.#hovered = false
    this.#focused = false
    this.#sync()
  }

  #sync(): void {
    const bubble = this.#bubble
    const trigger = this.#trigger
    if (!bubble || !trigger) return
    const wanted = this.#hovered || this.#focused
    if (wanted === bubble.matches(':popover-open')) return
    if (wanted) {
      bubble.showPopover()
      const anchor = trigger.getBoundingClientRect()
      const size = bubble.getBoundingClientRect()
      const centred = anchor.left + (anchor.width - size.width) / 2
      const left = Math.max(edge, Math.min(centred, window.innerWidth - edge - size.width))
      bubble.style.left = `${left}px`
      bubble.style.top = `${anchor.top - gap - size.height}px`
      document.addEventListener('keydown', this.#escape, true)
    } else {
      bubble.hidePopover()
      document.removeEventListener('keydown', this.#escape, true)
    }
  }

  // aria-labelledby cannot reach into this shadow root, so the trigger takes the text as its own name
  // when it has none, and the keyboard reaches it when it is not focusable.
  #nameTrigger(): void {
    const trigger = this.#trigger
    if (!trigger) return
    // A custom element such as eb-button holds its own focusable part, so it needs no tab stop.
    const custom = trigger.localName.includes('-')
    if (!custom && !trigger.matches(focusable)) trigger.setAttribute('tabindex', '0')
    const unnamed = !trigger.hasAttribute('aria-label') && !trigger.textContent?.trim()
    if (unnamed || this.#named) {
      trigger.setAttribute('aria-label', this.text)
      this.#named = true
    }
  }

  override updated(): void {
    this.#nameTrigger()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    document.removeEventListener('keydown', this.#escape, true)
  }

  override render() {
    return html`<slot @slotchange=${() => this.#nameTrigger()}></slot>
      <div class="bubble" part="tooltip" role="tooltip" popover="manual">${this.text}</div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-tooltip': EbTooltip
  }
}
