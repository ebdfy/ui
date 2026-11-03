import { LitElement, css, html } from 'lit'

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
