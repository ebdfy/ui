import { LitElement, css, html } from 'lit'

import { langOf } from '../lang.ts'

const words = {
  bn: { loading: 'লোড হচ্ছে' },
  en: { loading: 'Loading' },
}

export class EbSpinner extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
      width: 20px;
      height: 20px;
      vertical-align: middle;
    }
    .ring {
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      border: 2px solid var(--eb-color-line);
      border-top-color: var(--eb-color-accent);
      border-radius: 50%;
      animation: turn 1s linear infinite;
    }
    @keyframes turn {
      to {
        transform: rotate(360deg);
      }
    }
  `

  override render() {
    return html`<div class="ring" role="status" aria-label=${words[langOf(this)].loading}></div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-spinner': EbSpinner
  }
}
