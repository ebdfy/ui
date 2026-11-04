import { LitElement, css, html, nothing } from 'lit'
import type { PropertyValues } from 'lit'

import { digits } from '../format.ts'
import { close } from '../icons.ts'
import { langOf } from '../lang.ts'
import { focusRing } from '../tokens.ts'

const words = {
  bn: { selected: (count: string) => `${count}টি নির্বাচিত`, clear: 'নির্বাচন মুছুন', more: 'আরও কাজ' },
  en: { selected: (count: string) => `${count} selected`, clear: 'Clear selection', more: 'More actions' },
}

/**
 * What a person can do to the rows they have selected. The app sets count from the table's
 * selection and slots the actions in; the bar only reports a request to clear. It floats over the
 * list it ends, so place it after the list and its pagination.
 *
 * @slot - The actions for the selected rows, as buttons.
 * @csspart bar - The floating bar that holds the count, the actions and the clear button.
 * @fires eb-clear - The clear button was pressed; the app clears its selection.
 */
export class EbBulkBar extends LitElement {
  static override properties = {
    count: { type: Number },
  }

  static override styles = [
    focusRing,
    css`
      /* The host is a zero-height marker that is always laid out, so showing the bar moves nothing.
         Sticky at the bar's height plus 16 px, the bar below it floats 16 px above the screen's foot,
         and at the end of the scroll it hangs below the list, which extends the page to clear it. */
      :host {
        display: block;
        height: 0;
        position: sticky;
        bottom: calc(16px + var(--eb-size-control-lg));
      }
      /* Centred without a transform: a transform would make the bar the containing block of the
         menu's fixed panel. */
      [part='bar'] {
        position: absolute;
        top: 0;
        inset-inline: 0;
        margin-inline: auto;
        width: max-content;
        max-width: 100%;
        box-sizing: border-box;
        display: flex;
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
      }
      /* 16 px of page below the bar, so at the end of the scroll the host sits a full sticky offset
         above the screen's foot and the bar hangs below the list instead of sticking over its end. */
      [part='bar']::after {
        content: '';
        position: absolute;
        top: 100%;
        width: 1px;
        height: 16px;
      }
      :host([empty]) [part='bar'] {
        display: none;
      }
      /* The violet ring sits under 3:1 on the inverse surface in light, so the ring takes the inverse
         action colour. The ghost buttons draw their words, icons and hover from these inherited
         tokens, so on this surface they read as the inverse words. They are set on the buttons, not
         the bar, so the menu's panel keeps the page's colours. */
      ::slotted(*),
      .more,
      .clear {
        --eb-color-focus: var(--eb-color-inverse-act);
        --eb-color-text: var(--eb-color-on-inverse);
        --eb-color-text-2: var(--eb-color-on-inverse);
        --eb-color-surface-3: color-mix(in oklch, var(--eb-color-on-inverse) 14%, transparent);
      }
      [role='status'] {
        flex: none;
        font-weight: 600;
        white-space: nowrap;
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      ::slotted(*) {
        flex: none;
      }
      eb-menu {
        display: none;
      }
      /* On a phone or a narrow tablet, where three actions would run under Clear selection, the
         first action stays and the rest move into the More actions menu. */
      @media (max-width: 640px) {
        ::slotted(:nth-child(n + 2)) {
          display: none;
        }
        eb-menu {
          display: inline-block;
        }
      }
      .rule,
      .clear {
        flex: none;
      }
      .rule {
        width: 1px;
        height: 20px;
        background: color-mix(in oklch, var(--eb-color-on-inverse) 18%, transparent);
      }
      .clear {
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
        .clear {
          width: var(--eb-size-target);
          height: var(--eb-size-target);
        }
      }
      .clear:hover {
        background: color-mix(in oklch, var(--eb-color-on-inverse) 14%, transparent);
      }
      svg {
        width: 16px;
        height: 16px;
      }
    `,
  ]

  /** How many rows are selected, set from the table's selection. At zero the bar hides. */
  declare count: number

  // The app rewrites its actions' words on a language switch, so the menu's copies follow them.
  #observer = new MutationObserver(() => this.requestUpdate())

  constructor() {
    super()
    this.count = 0
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this.#observer.observe(this, { childList: true, characterData: true, subtree: true })
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.#observer.disconnect()
  }

  // Without a count the bar leaves layout, so nothing in it can take focus.
  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('count')) this.toggleAttribute('empty', !(this.count > 0))
  }

  override render() {
    const lang = langOf(this)
    const t = words[lang]
    const rest = [...this.querySelectorAll<HTMLElement>(':scope > *')].slice(1)
    // Each item presses the action it copies, so the app's own listeners run.
    const menu = rest.length
      ? html`<eb-menu label=${t.more}>
          <eb-button slot="trigger" class="more" variant="ghost" size="sm" icon-only label=${t.more}
            ><eb-icon slot="icon" name="more-horizontal"></eb-icon
          ></eb-button>
          ${rest.map((action) => {
            const icon = action.querySelector(':scope > eb-icon[slot="icon"]')?.getAttribute('name')
            return html`<eb-menu-item @click=${() => action.click()}
              >${icon ? html`<eb-icon slot="icon" name=${icon}></eb-icon>` : nothing}${action.textContent?.trim()}</eb-menu-item
            >`
          })}
        </eb-menu>`
      : nothing
    return html`<div part="bar">
      <span role="status">${t.selected(digits(this.count, lang))}</span>
      <div class="actions"><slot></slot>${menu}</div>
      <span class="rule"></span>
      <button type="button" class="clear" aria-label=${t.clear} @click=${this.clear}>${close}</button>
    </div>`
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
