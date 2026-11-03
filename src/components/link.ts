import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

import { focusRing } from '../tokens.ts'

export class EbLink extends LitElement {
  static override properties = {
    href: { type: String },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        display: inline;
        font-family: var(--eb-font-family);
        font-size: inherit;
        line-height: inherit;
        overflow-wrap: anywhere;
      }
      a {
        color: var(--eb-color-text);
        text-decoration: underline;
        text-decoration-color: var(--eb-color-text-3);
        text-underline-offset: 2px;
      }
    `,
  ]

  declare href: string | undefined

  override render() {
    return html`<a part="link" href=${ifDefined(this.href)}><slot></slot></a>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-link': EbLink
  }
}
