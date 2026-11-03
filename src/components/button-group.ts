import { LitElement, css, html, nothing } from 'lit'

export class EbButtonGroup extends LitElement {
  static override properties = {
    label: { type: String },
  }

  static override styles = css`
    :host {
      display: block;
    }
    .group {
      display: flex;
      flex-flow: row wrap;
      gap: 8px;
    }
  `

  declare label: string

  constructor() {
    super()
    this.label = ''
  }

  override render() {
    return html`<div class="group" role="group" aria-label=${this.label || nothing}><slot></slot></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-button-group': EbButtonGroup
  }
}
