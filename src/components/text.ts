import { LitElement, css, html } from 'lit'

/**
 * Sets a paragraph. Use the meta variant for the smaller, quieter line under it.
 *
 * @slot - The words of the paragraph.
 */
export class EbText extends LitElement {
  static override properties = {
    variant: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
      overflow-wrap: anywhere;
    }
    :host([variant='meta']) {
      color: var(--eb-color-text-2);
      font-size: var(--eb-font-size-meta);
      line-height: var(--eb-line-height-meta);
    }
  `

  /** The look: body, or meta for the smaller, quieter line. Body when unset. */
  declare variant: 'body' | 'meta'

  constructor() {
    super()
    this.variant = 'body'
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-text': EbText
  }
}
