import { LitElement, css, html } from 'lit'

// Whether a user agent names an Apple platform, where the shortcut key is ⌘ and not Ctrl.
export function apple(userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/.test(userAgent)
}

// A keyboard shortcut's hint, such as the one at the end of a menu item. `mod+d` reads Ctrl+D, or
// ⌘D on Apple. The letters stay Latin on a Bangla page.
export class EbKbd extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
    kbd {
      display: inline-grid;
      place-items: center;
      min-width: 20px;
      height: 20px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: var(--eb-radius-sm);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-caption);
      line-height: var(--eb-line-height-caption);
      font-weight: 600;
      color: var(--eb-color-text-2);
      background: var(--eb-color-surface-2);
      box-shadow: inset 0 0 0 1px var(--eb-color-edge);
      white-space: nowrap;
    }
  `

  static override properties = {
    shortcut: { type: String },
  }

  declare shortcut: string

  constructor() {
    super()
    this.shortcut = ''
  }

  override render() {
    const isApple = apple(navigator.userAgent)
    const keys = this.shortcut
      .split('+')
      .map((part) => (part.toLowerCase() === 'mod' ? (isApple ? '⌘' : 'Ctrl') : part.toUpperCase()))
    return html`<kbd part="kbd">${keys.join(isApple ? '' : '+')}</kbd>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-kbd': EbKbd
  }
}
