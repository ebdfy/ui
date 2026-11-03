import { LitElement, css, html, nothing } from 'lit'

export class EbCard extends LitElement {
  static override properties = {
    heading: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      padding: var(--eb-space-card);
      border-radius: var(--eb-radius-lg);
      background: var(--eb-color-surface);
      box-shadow:
        inset 0 0 0 1px var(--eb-color-divider),
        var(--eb-shadow-1);
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
      overflow-wrap: anywhere;
    }
    h2 {
      margin: 0 0 var(--eb-space-gap);
      font-size: var(--eb-font-size-heading-3);
      font-weight: var(--eb-font-weight-semibold);
      line-height: var(--eb-line-height-heading-3);
    }
  `

  declare heading: string

  constructor() {
    super()
    this.heading = ''
  }

  override render() {
    return html`${this.heading ? html`<h2>${this.heading}</h2>` : nothing}<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-card': EbCard
  }
}
