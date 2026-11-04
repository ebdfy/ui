import { LitElement, css, html } from 'lit'

/** A 1 px line in the line colour that fills the width of its row. */
export class EbDivider extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    hr {
      height: 1px;
      margin: 0;
      border: 0;
      background: var(--eb-color-divider);
    }
  `

  override render() {
    return html`<hr />`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-divider': EbDivider
  }
}
