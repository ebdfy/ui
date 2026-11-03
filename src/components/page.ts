import { LitElement, css, html, nothing } from 'lit'

export class EbPage extends LitElement {
  static override properties = {
    heading: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      min-height: 100dvh;
      padding: var(--eb-space-card);
      background: var(--eb-color-bg);
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    h1 {
      margin: 0 0 var(--eb-space-card);
      font-size: var(--eb-font-size-heading-2);
      font-weight: var(--eb-font-weight-bold);
      line-height: var(--eb-line-height-heading-2);
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--eb-space-gap);
    }
  `

  declare heading: string

  constructor() {
    super()
    this.heading = ''
  }

  override render() {
    return html`${this.heading ? html`<h1>${this.heading}</h1>` : nothing}
      <div class="content"><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-page': EbPage
  }
}
