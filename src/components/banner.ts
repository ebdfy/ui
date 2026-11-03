import { LitElement, css, html } from 'lit'

import { info, triangleAlert } from '../icons.ts'

const words = {
  bn: { danger: 'সতর্কতা', info: 'তথ্য' },
  en: { danger: 'Warning', info: 'Note' },
}

// A message that is part of the page, in an info or a danger tone. The icon has a name in the
// banner's language and the banner has no live role, since it is not an announcement.
export class EbBanner extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px;
      border-radius: var(--eb-radius-md);
      background: var(--eb-color-surface-2);
      box-shadow: inset 0 0 0 1px var(--eb-color-divider);
      color: var(--eb-color-text-2);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    :host([tone='danger']) {
      background: var(--eb-color-danger-soft);
      box-shadow: inset 0 0 0 1px var(--eb-color-danger-edge);
      color: var(--eb-color-text);
    }
    .icon {
      flex: none;
      width: 16px;
      height: 16px;
      margin-top: 2px;
    }
    :host([tone='danger']) .icon {
      color: var(--eb-color-danger-text);
    }
    svg {
      display: block;
      width: 16px;
      height: 16px;
    }
  `

  // Written out, not as a type alias, so the manifest names the values.
  declare tone: 'info' | 'danger'

  constructor() {
    super()
    this.tone = 'info'
  }

  override render() {
    const lang = this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn') ? 'bn' : 'en'
    const danger = this.tone === 'danger'
    return html`<span class="icon" role="img" aria-label=${words[lang][danger ? 'danger' : 'info']}
        >${danger ? triangleAlert : info}</span
      ><slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-banner': EbBanner
  }
}
