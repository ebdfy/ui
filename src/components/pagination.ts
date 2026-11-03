import { LitElement, css, html } from 'lit'

import { chevronLeft, chevronRight } from '../icons.ts'
import { langOf } from '../lang.ts'
import { focusRing } from '../tokens.ts'

const words = {
  bn: { nav: 'পাতা', previous: 'আগের পাতা', next: 'পরের পাতা' },
  en: { nav: 'Pagination', previous: 'Previous page', next: 'Next page' },
}

// Pages by cursor, so it knows only whether a page exists on each side.
export class EbPagination extends LitElement {
  static override properties = {
    hasPrevious: { type: Boolean, attribute: 'has-previous' },
    hasNext: { type: Boolean, attribute: 'has-next' },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        display: block;
      }
      nav {
        display: flex;
        justify-content: space-between;
        gap: var(--eb-space-gap);
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: var(--eb-size-target);
        height: var(--eb-size-target);
        padding: 0;
        border: 1px solid var(--eb-color-line-strong);
        border-radius: var(--eb-radius-field);
        background: var(--eb-color-surface);
        color: var(--eb-color-text);
        cursor: pointer;
      }
      button:disabled {
        color: var(--eb-color-text-muted);
        cursor: default;
        opacity: 0.5;
      }
    `,
  ]

  declare hasPrevious: boolean
  declare hasNext: boolean

  constructor() {
    super()
    this.hasPrevious = false
    this.hasNext = false
  }

  override render() {
    const t = words[langOf(this)]
    return html`<nav aria-label=${t.nav}>
      <button
        type="button"
        aria-label=${t.previous}
        ?disabled=${!this.hasPrevious}
        @click=${() => this.fire('eb-previous')}
      >
        ${chevronLeft}
      </button>
      <button type="button" aria-label=${t.next} ?disabled=${!this.hasNext} @click=${() => this.fire('eb-next')}>
        ${chevronRight}
      </button>
    </nav>`
  }

  private fire(type: 'eb-previous' | 'eb-next'): void {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }))
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-pagination': EbPagination
  }
}
