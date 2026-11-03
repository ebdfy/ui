import { LitElement, css, html, nothing } from 'lit'

import { apple } from './kbd.ts'
import { EbPopover } from './popover.ts'

export class EbMenuItem extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
    shortcut: { type: String },
  }

  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      min-height: var(--eb-size-control-md);
      padding: 0 8px;
      border-radius: var(--eb-radius-sm);
      color: var(--eb-color-text);
      cursor: pointer;
    }
    @media (max-width: 599.98px) {
      :host {
        min-height: var(--eb-size-target);
      }
    }
    :host(:hover),
    :host(:focus-visible) {
      background: var(--eb-color-surface-3);
    }
    :host(:focus-visible) {
      outline: 2px solid var(--eb-color-focus);
      outline-offset: 2px;
    }
    eb-kbd {
      margin-inline-start: auto;
    }
    :host([tone='critical']) {
      color: var(--eb-color-danger-text);
    }
  `

  declare tone: 'default' | 'critical'
  declare shortcut: string

  constructor() {
    super()
    this.tone = 'default'
    this.shortcut = ''
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.setAttribute('role', 'menuitem')
    this.tabIndex = -1
  }
  override willUpdate(changed: Map<string, unknown>): void {
    if (!changed.has('shortcut')) return
    if (!this.shortcut) {
      this.removeAttribute('aria-keyshortcuts')
      return
    }
    // ARIA names the keys Control and Meta, and the letter in capitals.
    const mod = apple(navigator.userAgent) ? 'Meta' : 'Control'
    const keys = this.shortcut.split('+').map((part) => (part.toLowerCase() === 'mod' ? mod : part.toUpperCase()))
    this.setAttribute('aria-keyshortcuts', keys.join('+'))
  }

  override render() {
    // The hint is aria-hidden so the item's name stays its label; aria-keyshortcuts carries the keys.
    return html`<slot></slot>${
        this.shortcut ? html`<eb-kbd part="shortcut" shortcut=${this.shortcut} aria-hidden="true"></eb-kbd>` : nothing
      }`
  }
}

export class EbMenu extends EbPopover {
  static override styles = css`
    ${EbPopover.styles}
    .panel {
      padding: 4px;
    }
  `

  protected override get panelRole(): string {
    return 'menu'
  }

  get #items(): EbMenuItem[] {
    return [...this.querySelectorAll<EbMenuItem>(':scope > eb-menu-item')]
  }

  protected override opened(): void {
    this.#items[0]?.focus()
  }

  protected override onPanelClick(event: MouseEvent): void {
    if (event.composedPath().some((el) => el instanceof EbMenuItem)) this.hide()
  }

  protected override onPanelKeydown(event: KeyboardEvent): void {
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
      items[at]?.click()
    } else if (event.key === 'Tab') this.hide()
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-menu': EbMenu
    'eb-menu-item': EbMenuItem
  }
}
