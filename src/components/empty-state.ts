import { LitElement, css, html, nothing } from 'lit'

export class EbEmptyState extends LitElement {
  static override properties = {
    heading: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      padding: 32px var(--eb-space-card);
      border-radius: var(--eb-radius-card);
      background: var(--eb-color-surface);
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
      overflow-wrap: anywhere;
      text-align: center;
    }
    h2 {
      margin: 0 0 var(--eb-space-gap);
      font-size: var(--eb-font-size-heading-3);
      font-weight: var(--eb-font-weight-semibold);
      line-height: var(--eb-line-height-heading-3);
    }
    ::slotted(p) {
      margin: 0;
    }
    ::slotted([slot='action']) {
      margin-top: var(--eb-space-card);
    }
  `

  declare heading: string

  constructor() {
    super()
    this.heading = ''
  }

  override render() {
    return html`${this.heading ? html`<h2>${this.heading}</h2>` : nothing}<slot></slot><slot name="action"></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-empty-state': EbEmptyState
  }
}
