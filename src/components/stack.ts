import { LitElement, css, html } from 'lit'

/**
 * Puts its children in a column with the standard gap, or side by side in a row that wraps.
 *
 * @slot - The children to stack.
 */
export class EbStack extends LitElement {
  static override properties = {
    direction: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--eb-space-gap);
    }
    :host([direction='row']) {
      flex-flow: row wrap;
      align-items: center;
    }
  `

  /** Column, or row to put the children side by side. Column when unset. */
  declare direction: 'column' | 'row'

  constructor() {
    super()
    this.direction = 'column'
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-stack': EbStack
  }
}
