import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

const gap = 4
const edge = 8

// Puts a shown panel below its trigger, start edges aligned, then nudges it to stay `edge` px inside
// the window. It goes above the trigger only when there is no room below. A panel with room on
// neither side stays below and takes the room left there, scrolling for the rest. Plain JS on
// purpose: CSS anchor positioning is missing in Safari and older Chrome.
export function placePanel(trigger: Element, panel: HTMLElement): void {
  panel.style.maxHeight = ''
  const anchor = trigger.getBoundingClientRect()
  const size = panel.getBoundingClientRect()
  const left = Math.max(edge, Math.min(anchor.left, window.innerWidth - edge - size.width))
  let top = anchor.bottom + gap
  const above = anchor.top - gap - size.height
  const room = window.innerHeight - edge - top
  if (size.height > room && above >= edge) top = above
  else if (size.height > room) panel.style.maxHeight = `${room}px`
  panel.style.left = `${left}px`
  panel.style.top = `${top}px`
}

// An eb-button hides its real button in a shadow root, and a host element cannot take focus.
function focusTrigger(trigger: HTMLElement): void {
  const inner = trigger.shadowRoot?.querySelector<HTMLElement>('button')
  ;(inner ?? trigger).focus()
}

// The focused element in the tree that holds `el`. Inside a shadow root, document.activeElement is
// the shadow host, so the root's own activeElement is read instead.
export function focusedNear(el: Element): Element | null {
  const root = el.getRootNode()
  return root instanceof ShadowRoot || root instanceof Document ? root.activeElement : null
}

/**
 * Opens a panel of any content below its trigger. Escape or a press outside closes it.
 *
 * @slot - The content of the panel.
 * @slot trigger - The eb-button that opens the panel.
 */
export class EbPopover extends LitElement {
  static override properties = {
    open: { type: Boolean, reflect: true },
    label: { type: String },
  }

  static override styles = css`
    :host {
      display: inline-block;
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    .panel {
      position: fixed;
      inset: auto;
      margin: 0;
      box-sizing: border-box;
      width: max-content;
      max-width: calc(100vw - 16px);
      max-height: calc(100vh - 16px);
      overflow: auto;
      padding: var(--eb-space-gap);
      border: 0;
      border-radius: var(--eb-radius-lg);
      background: var(--eb-color-surface);
      color: var(--eb-color-text);
      box-shadow:
        inset 0 0 0 1px var(--eb-color-overlay-edge),
        var(--eb-shadow-3);
    }
    /* The panel fades in and rises 4 px; with reduced motion it opens at once. */
    @media (prefers-reduced-motion: no-preference) {
      .panel {
        transition-property: opacity, transform;
        transition-duration: var(--eb-duration-fast);
        transition-timing-function: var(--eb-ease-out);
      }
      @starting-style {
        .panel {
          opacity: 0;
          transform: translateY(4px);
        }
      }
    }
  `

  /** The panel is showing. */
  declare open: boolean
  /** Names the panel for a screen reader. */
  declare label: string

  // Whether the panel was open when the pointer went down on the trigger: a press outside the panel
  // light-dismisses it first, and the click that follows must not open it again.
  #openAtPress: boolean | undefined

  constructor() {
    super()
    this.open = false
    this.label = ''
  }

  show(): void {
    this.open = true
  }

  hide(): void {
    this.open = false
  }

  protected get panelRole(): string | undefined {
    return undefined
  }

  protected get trigger(): HTMLElement | null {
    return this.querySelector<HTMLElement>(':scope > [slot="trigger"]')
  }

  protected get panel(): HTMLElement {
    const panel = this.renderRoot.querySelector<HTMLElement>('.panel')
    if (!panel) throw new Error('eb-popover has not rendered')
    return panel
  }

  // Runs once the panel is on screen and placed.
  protected opened(): void {}

  protected onPanelKeydown(_event: KeyboardEvent): void {}

  protected onPanelClick(_event: MouseEvent): void {}

  override updated(): void {
    const trigger = this.trigger
    trigger?.setAttribute('aria-haspopup', this.panelRole ?? 'true')
    trigger?.setAttribute('aria-expanded', String(this.open))
    const panel = this.panel
    const shown = panel.matches(':popover-open')
    if (this.open && !shown) {
      panel.showPopover()
      if (trigger) placePanel(trigger, panel)
      this.opened()
    } else if (!this.open && shown) {
      panel.hidePopover()
    }
  }

  #press = (): void => {
    this.#openAtPress = this.open
  }

  #click = (): void => {
    const wasOpen = this.#openAtPress ?? this.open
    this.#openAtPress = undefined
    if (wasOpen) this.hide()
    else this.show()
  }

  // Whether focus goes back to the trigger once the panel has closed.
  #refocus = false

  // Fires for every way the panel closes: hide(), Escape and a press outside. It only notes where
  // focus is: changing state here would have updated() hide the panel again mid-close.
  #beforeToggle = (event: ToggleEvent): void => {
    if (event.newState !== 'closed') return
    // Keep focus where the person put it when they dismissed by pressing another control.
    const active = focusedNear(this)
    this.#refocus = document.activeElement === document.body || (active !== null && this.contains(active))
  }

  #toggle = (event: ToggleEvent): void => {
    if (event.newState !== 'closed') return
    this.open = false
    const trigger = this.trigger
    if (this.#refocus && trigger) focusTrigger(trigger)
    this.#refocus = false
  }

  override render() {
    return html`
      <slot
        name="trigger"
        @pointerdown=${this.#press}
        @click=${this.#click}
        @slotchange=${() => this.requestUpdate()}
      ></slot>
      <div
        class="panel"
        popover="auto"
        role=${ifDefined(this.panelRole)}
        aria-label=${ifDefined(this.label || undefined)}
        @beforetoggle=${this.#beforeToggle}
        @toggle=${this.#toggle}
        @keydown=${this.onPanelKeydown}
        @click=${this.onPanelClick}
      >
        <slot></slot>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-popover': EbPopover
  }
}
