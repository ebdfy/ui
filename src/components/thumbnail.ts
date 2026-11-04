import { LitElement, css, html } from 'lit'
import { ifDefined } from 'lit/directives/if-defined.js'

import { image } from '../icons.ts'

/** Shows a product's picture in a small square, or a plain picture icon when there is none or it fails to load. */
export class EbThumbnail extends LitElement {
  static override properties = {
    src: { type: String },
    alt: { type: String },
    size: { type: String, reflect: true },
    failed: { state: true },
  }

  static override styles = css`
    :host {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 56px;
      height: 56px;
      overflow: hidden;
      border-radius: var(--eb-radius-field);
      background: var(--eb-color-surface-2);
      color: var(--eb-color-text-2);
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
    /* The ring is drawn over the picture, so a white product on a white page keeps its edge. */
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px var(--eb-color-divider);
      pointer-events: none;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    /* Ink's icon sizes: 16 px in the small and medium tiles, 20 px in the large one. */
    svg {
      width: 16px;
      height: 16px;
    }
    :host([size='large']) svg {
      width: 20px;
      height: 20px;
    }
  `

  /** The address of the picture. Unset, the icon shows. */
  declare src: string | undefined
  /** What the picture shows, for a screen reader. */
  declare alt: string
  /** The size of the square: small, medium or large. Medium when unset. */
  declare size: 'small' | 'medium' | 'large'
  /** Set by the thumbnail when the picture fails to load; not for apps to set. */
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
