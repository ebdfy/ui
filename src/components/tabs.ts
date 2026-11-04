import { LitElement, css, html, nothing } from 'lit'

import { digits } from '../format.ts'
import { langOf } from '../lang.ts'

/**
 * One underline tab: a label with an optional count after it. The tabs around it set `selected`.
 *
 * @slot - The label of the tab.
 */
export class EbTab extends LitElement {
  static override properties = {
    value: { type: String },
    count: { type: Number },
    selected: { type: Boolean, reflect: true },
  }

  static override styles = [
    css`
      :host {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        height: var(--eb-size-control-md);
        padding: 0 12px;
        border-bottom: 2px solid transparent;
        color: var(--eb-color-text-2);
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        font-weight: var(--eb-font-weight-medium);
        line-height: var(--eb-line-height-body);
        white-space: nowrap;
        cursor: pointer;
      }
      @media (max-width: 599.98px) {
        :host {
          height: var(--eb-size-target);
        }
      }
      :host(:hover),
      :host([selected]) {
        color: var(--eb-color-text);
      }
      :host([selected]) {
        border-bottom-color: var(--eb-color-text);
      }
      /* The ring is on the host, which is what takes focus, so focusRing's inner rule does not reach it. */
      :host(:focus-visible) {
        outline: 2px solid var(--eb-color-focus);
        outline-offset: 2px;
      }
      .count {
        color: var(--eb-color-text-3);
        font-variant-numeric: tabular-nums;
      }
    `,
  ]

  /** What the tabs' value is while this tab is selected. */
  declare value: string
  /** The number shown after the label. Omitted shows no count. */
  declare count: number | undefined
  /** Set by the tabs around it for the tab matching their value; not for apps to set. */
  declare selected: boolean

  constructor() {
    super()
    this.value = ''
    this.selected = false
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.setAttribute('role', 'tab')
  }

  override willUpdate(): void {
    this.setAttribute('aria-selected', String(this.selected))
  }

  override render() {
    const count =
      this.count === undefined ? nothing : html`<span class="count">${digits(this.count, langOf(this))}</span>`
    return html`<slot></slot>${count}`
  }
}

/**
 * A row of tabs that filter a list. It sets the tab matching its value as selected, and fires
 * eb-change when a person picks another. Arrow keys move focus; Enter or Space selects.
 *
 * @slot - The eb-tab elements.
 * @fires eb-change - A person picked another tab. The detail holds its value; the app sets value to follow.
 */
export class EbTabs extends LitElement {
  static override properties = {
    label: { type: String },
    value: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      display: block;
      border-bottom: 1px solid var(--eb-color-divider);
    }
    /* Scrolls sideways on a narrow screen. The padding leaves room for a tab's focus ring, which the
       scroll box would clip. Only the block margin is negative: a negative inline margin would push
       the row past the page edge. */
    .row {
      display: flex;
      overflow-x: auto;
      padding: 4px;
      margin-block: -4px;
    }
  `

  /** Names the tabs for a screen reader. */
  declare label: string
  /** The value of the selected tab. */
  declare value: string

  constructor() {
    super()
    this.label = ''
    this.value = ''
    this.addEventListener('click', (event) => this.pick(this.tabAt(event)))
    this.addEventListener('keydown', (event) => this.onKeydown(event))
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.setAttribute('role', 'tablist')
  }

  override willUpdate(): void {
    this.setAttribute('aria-label', this.label)
  }

  override updated(): void {
    this.sync()
  }

  override render() {
    return html`<div class="row"><slot @slotchange=${() => this.sync()}></slot></div>`
  }

  private get tabs(): EbTab[] {
    return [...this.querySelectorAll<EbTab>(':scope > eb-tab')]
  }

  private tabAt(event: Event): EbTab | null {
    return event.target instanceof Element ? event.target.closest('eb-tab') : null
  }

  // Selects the tab the value names, if any, and makes it the row's one Tab stop; with none
  // selected, the first tab is the stop, so the row is never out of reach of the keyboard.
  private sync(): void {
    const tabs = this.tabs
    const selected = this.value ? tabs.find((tab) => tab.value === this.value) : undefined
    for (const tab of tabs) {
      tab.selected = tab === selected
      tab.tabIndex = tab === (selected ?? tabs[0]) ? 0 : -1
    }
  }

  private pick(tab: EbTab | null): void {
    if (!tab || tab.value === this.value) return
    this.value = tab.value
    this.sync()
    this.dispatchEvent(new CustomEvent('eb-change', { bubbles: true, composed: true, detail: { value: tab.value } }))
  }

  private onKeydown(event: KeyboardEvent): void {
    const tab = this.tabAt(event)
    if (!tab) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.pick(tab)
      return
    }
    const tabs = this.tabs
    const at = tabs.indexOf(tab)
    const to = new Map([
      ['ArrowRight', (at + 1) % tabs.length],
      ['ArrowLeft', (at - 1 + tabs.length) % tabs.length],
      ['Home', 0],
      ['End', tabs.length - 1],
    ])
    const next = to.get(event.key)
    if (next === undefined) return
    event.preventDefault()
    tabs[next]?.focus()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-tab': EbTab
    'eb-tabs': EbTabs
  }
}
