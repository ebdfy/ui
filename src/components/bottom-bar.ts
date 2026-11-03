import { LitElement, css, html } from 'lit'

// Sticks to the bottom of the viewport the page scrolls in, which works inside an iframe page.
export class EbBottomBar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      justify-content: flex-end;
      box-sizing: border-box;
      position: sticky;
      bottom: 0;
      padding: var(--eb-space-card) var(--eb-space-card) calc(var(--eb-space-card) + env(safe-area-inset-bottom));
      border-top: 1px solid var(--eb-color-line);
      background: var(--eb-color-surface);
    }
  `

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-bottom-bar': EbBottomBar
  }
}
