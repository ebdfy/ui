import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

import { image } from '../icons.ts'

export class EbThumbnail extends LitElement {
  static override properties = {
    src: { type: String },
    alt: { type: String },
    size: { type: String, reflect: true },
    failed: { state: true },
  }

  static override styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 56px;
      height: 56px;
      overflow: hidden;
      border-radius: var(--eb-radius-field);
      background: var(--eb-color-ground);
      color: var(--eb-color-text-muted);
      vertical-align: middle;
    }
    :host([size='small']) {
      width: 40px;
      height: 40px;
    }
    :host([size='large']) {
      width: 80px;
      height: 80px;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    svg {
      width: 50%;
      height: 50%;
    }
  `

  declare src: string | undefined
  declare alt: string
  declare size: 'small' | 'medium' | 'large'
  declare failed: boolean

  constructor() {
    super()
    this.alt = ''
    this.size = 'medium'
    this.failed = false
  }

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('src')) this.failed = false
  }

  override render() {
    if (!this.src || this.failed) return image
    return html`<img src=${this.src} alt=${ifDefined(this.alt)} @error=${() => (this.failed = true)} />`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-thumbnail': EbThumbnail
  }
}
