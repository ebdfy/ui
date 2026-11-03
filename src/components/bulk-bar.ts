import { LitElement, css, html } from 'lit'
import type { PropertyValues } from 'lit'

import { digits } from '../format.ts'
import { close } from '../icons.ts'
import { langOf } from '../lang.ts'
import { focusRing } from '../tokens.ts'

const words = {
  bn: { selected: (count: string) => `${count}টি নির্বাচিত`, clear: 'নির্বাচন মুছুন' },
  en: { selected: (count: string) => `${count} selected`, clear: 'Clear selection' },
}

// What a person can do to the rows they have selected. The app sets count from the table's
// selection and slots the actions in; the bar only reports a request to clear.
export class EbBulkBar extends LitElement {
  static override properties = {
    count: { type: Number },
  }

  static override styles = [
    focusRing,
    css`
      :host {
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        gap: 12px;
        height: var(--eb-size-control-lg);
        padding: 0 8px 0 12px;
        border-radius: var(--eb-radius-lg);
        background: var(--eb-color-inverse);
        color: var(--eb-color-on-inverse);
        font-family: var(--eb-font-family);
        font-size: var(--eb-font-size-body);
        box-shadow:
          inset 0 0 0 1px var(--eb-color-inverse-edge),
          var(--eb-shadow-3);
        /* The violet ring sits under 3:1 on the inverse surface in light, so the ring takes the
           inverse action colour. The slotted ghost buttons draw their words and hover from these
           inherited tokens, so on this surface they read as the inverse words. */
        --eb-color-focus: var(--eb-color-inverse-act);
        --eb-color-text: var(--eb-color-on-inverse);
        --eb-color-text-2: var(--eb-color-on-inverse);
        --eb-color-surface-3: color-mix(in oklch, var(--eb-color-on-inverse) 14%, transparent);
      }
      :host([empty]) {
        display: none;
      }
      :host {
        max-width: 100%;
      }
      [role='status'] {
        flex: none;
        font-weight: 600;
        white-space: nowrap;
      }
      /* On a narrow screen the actions scroll inside the bar, so the count and Clear selection stay
         in view. */
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
        /* Room for the actions' 2 px rings at their 2 px offset, which the scroll box would clip. */
        padding: 4px;
        margin-inline: -4px;
        overflow-x: auto;
      }
      ::slotted(*) {
        flex: none;
      }
      .rule,
      button {
        flex: none;
      }
      .rule {
        width: 1px;
        height: 20px;
        background: color-mix(in oklch, var(--eb-color-on-inverse) 18%, transparent);
      }
      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: var(--eb-radius-md);
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      /* On a phone every target is 44 px, as the actions' buttons are. */
      @media (max-width: 640px) {
        button {
          width: var(--eb-size-target);
          height: var(--eb-size-target);
        }
      }
      button:hover {
        background: color-mix(in oklch, var(--eb-color-on-inverse) 14%, transparent);
      }
      svg {
        width: 16px;
        height: 16px;
      }
    `,
  ]

  declare count: number

  constructor() {
    super()
    this.count = 0
  }

  // Without a count the host leaves layout, so nothing in it can take focus.
  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('count')) this.toggleAttribute('empty', !(this.count > 0))
  }

  override render() {
    const lang = langOf(this)
    const t = words[lang]
    return html`<span role="status">${t.selected(digits(this.count, lang))}</span>
      <div class="actions"><slot></slot></div>
      <span class="rule"></span>
      <button type="button" aria-label=${t.clear} @click=${this.clear}>${close}</button>`
  }

  private clear(): void {
    this.dispatchEvent(new CustomEvent('eb-clear', { bubbles: true, composed: true }))
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-bulk-bar': EbBulkBar
  }
}
