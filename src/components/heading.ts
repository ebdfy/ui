import { LitElement, css, html } from 'lit'

/**
 * Sets a title at level 1, 2 or 3. Pick the level for the outline of the page, not for the size you want.
 *
 * @slot - The words of the title.
 */
export class EbHeading extends LitElement {
  static override properties = {
    level: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      display: block;
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
    }
    h1,
    h2,
    h3 {
      margin: 0;
      font-weight: var(--eb-font-weight-bold);
      overflow-wrap: anywhere;
    }
    h1 {
      font-size: var(--eb-font-size-heading-1);
      line-height: var(--eb-line-height-heading-1);
    }
    h2 {
      font-size: var(--eb-font-size-heading-2);
      line-height: var(--eb-line-height-heading-2);
    }
    h3 {
      font-size: var(--eb-font-size-heading-3);
      font-weight: var(--eb-font-weight-semibold);
      line-height: var(--eb-line-height-heading-3);
    }
  `

  /** The level in the outline of the page: 1, 2 or 3. 2 when unset. */
  declare level: '1' | '2' | '3'

  constructor() {
    super()
    this.level = '2'
  }

  override render() {
    if (this.level === '1') return html`<h1><slot></slot></h1>`
    if (this.level === '3') return html`<h3><slot></slot></h3>`
    return html`<h2><slot></slot></h2>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-heading': EbHeading
  }
}
