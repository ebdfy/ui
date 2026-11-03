import { LitElement, css, html } from 'lit'

export class EbDivider extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    hr {
      height: 1px;
      margin: 0;
      border: 0;
      background: var(--eb-color-line);
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
