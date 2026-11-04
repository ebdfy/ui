import { LitElement, css, html } from 'lit'

/**
 * Holds a page's buttons and sticks to the bottom of the viewport the page scrolls in, which works
 * inside an iframe page.
 *
 * @slot - The buttons.
 */
export class EbBottomBar extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      justify-content: flex-end;
      box-sizing: border-box;
      position: sticky;
      bottom: 0;
      padding: var(--eb-space-card) var(--eb-space-card) calc(var(--eb-space-card) + env(safe-area-inset-bottom));
      border-top: 1px solid var(--eb-color-divider);
      background: var(--eb-color-surface);
    }
    /* On a phone a group of buttons in the bar fills its row, each button an equal share. A desktop
       dialog, narrow but used with a pointer, turns the fill off. */
    @media (max-width: 640px) {
      :host {
        --eb-bar-fill: 1;
      }
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
