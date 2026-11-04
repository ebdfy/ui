import { LitElement, css, html, nothing } from 'lit'

import { chevronLeft, chevronRight } from '../icons.ts'
import { langOf } from '../lang.ts'
import { focusRing } from '../tokens.ts'

const words = {
  bn: { nav: 'পাতা', previous: 'আগের পাতা', next: 'পরের পাতা' },
  en: { nav: 'Pagination', previous: 'Previous page', next: 'Next page' },
}

/**
 * Pages by cursor, so it knows only whether a page exists on each side. The optional label is the
 * range text (for example "1–5 of 6"), written by the app in its own language.
 *
 * @fires eb-previous - The previous button was pressed; the app loads the page before.
 * @fires eb-next - The next button was pressed; the app loads the page after.
 */
export class EbPagination extends LitElement {
  static override properties = {
    hasPrevious: { type: Boolean, attribute: 'has-previous' },
    hasNext: { type: Boolean, attribute: 'has-next' },
    label: { type: String },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        display: block;
      }
      nav {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
      }
      .label {
        margin-inline-end: 8px;
        color: var(--eb-color-text-2);
        font-size: var(--eb-font-size-meta);
        line-height: var(--eb-line-height-meta);
        font-variant-numeric: tabular-nums;
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: var(--eb-size-control-md);
        height: var(--eb-size-control-md);
        padding: 0;
        border: 1px solid var(--eb-color-control);
        border-radius: var(--eb-radius-field);
        background: var(--eb-color-surface);
        color: var(--eb-color-text);
        cursor: pointer;
      }
      /* On a phone every target is 44 px, as the bulk bar's buttons are. */
      @media (max-width: 640px) {
        button {
          width: var(--eb-size-target);
          height: var(--eb-size-target);
        }
      }
      button:disabled {
        color: var(--eb-color-text-2);
        cursor: default;
        opacity: 0.5;
      }
      svg {
        width: 16px;
        height: 16px;
      }
    `,
  ]

  /** There is a page before this one; without it the previous button is disabled. */
  declare hasPrevious: boolean
  /** There is a page after this one; without it the next button is disabled. */
  declare hasNext: boolean
  /** The range text shown before the buttons, such as "21–40 of 128", in the page's language. */
  declare label: string

  constructor() {
    super()
    this.hasPrevious = false
    this.hasNext = false
    this.label = ''
  }

  override render() {
    const t = words[langOf(this)]
    return html`<nav aria-label=${t.nav}>
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
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
