import { LitElement, css, html, nothing } from 'lit'

import { icons, info, triangleAlert } from '../icons.ts'

const words = {
  bn: { danger: 'সতর্কতা', warning: 'লক্ষ্য করুন', success: 'সম্পন্ন', info: 'তথ্য', dismiss: 'বন্ধ করুন' },
  en: { danger: 'Warning', warning: 'Attention', success: 'Done', info: 'Note', dismiss: 'Dismiss' },
}

const focusable = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'

// Where the focus goes inside an element: itself, or the first focusable element in its shadow root,
// as for an eb-button, an eb-text-field or an eb-link.
function focusTarget(el: Element): HTMLElement | undefined {
  if (el instanceof HTMLElement && el.matches(focusable) && !el.matches(':disabled') && el.checkVisibility()) return el
  for (const inner of el.shadowRoot?.querySelectorAll('*') ?? []) {
    const target = focusTarget(inner)
    if (target) return target
  }
  return undefined
}

// The element that takes the focus when the banner goes: the next focusable one after it in document
// order, else the last one before it.
function successor(banner: HTMLElement): HTMLElement | undefined {
  let before: HTMLElement | undefined
  for (const el of document.querySelectorAll('*')) {
    if (banner.contains(el)) continue
    const target = focusTarget(el)
    if (!target) continue
    if (banner.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return target
    before = target
  }
  return before
}

/**
 * A message that is part of the page, in one of the shared tones: neutral a grey card, info the soft
 * accent fill, success a grey card with a green check, warning the amber fill of New, danger the soft red.
 *
 * The icon has a name in the banner's language and the banner has no live role, since it is not an
 * announcement. A heading sits above the words, an action child follows them, and dismissible adds a
 * close button that fires a cancelable eb-dismiss, then hides the banner.
 *
 * @slot - The words of the message.
 * @slot action - A link or button that follows the words.
 * @fires eb-dismiss - The close button was pressed. Cancelable: preventDefault keeps the banner.
 */
export class EbBanner extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
    heading: { type: String },
    dismissible: { type: Boolean, reflect: true },
  }

  static override styles = css`
    :host {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px;
      border-radius: var(--eb-radius-md);
      background: var(--eb-color-accent-soft);
      color: var(--eb-color-text-2);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-body);
      line-height: var(--eb-line-height-body);
    }
    :host([hidden]) {
      display: none;
    }
    :host([tone='neutral']),
    :host([tone='success']) {
      background: var(--eb-color-surface-2);
      box-shadow: inset 0 0 0 1px var(--eb-color-divider);
    }
    .body {
      flex: 1;
      min-width: 0;
    }
    .heading {
      color: var(--eb-color-text);
      font-weight: var(--eb-font-weight-semibold);
    }
    :host([tone='warning']) {
      background: var(--eb-color-new-bg);
      box-shadow: none;
      color: var(--eb-color-text);
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
    :host([tone='success']) .icon {
      color: var(--eb-color-paid);
    }
    :host([tone='warning']) .icon {
      color: var(--eb-color-new-fg);
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
  /** The tone every component shares: neutral, info, success, warning or danger. */
  declare tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'

  /** The title above the words. Not `title`, which would show a browser tooltip over the banner. */
  declare heading: string
  /** Adds a close button. */
  declare dismissible: boolean

  constructor() {
    super()
    this.tone = 'info'
    this.heading = ''
    this.dismissible = false
  }

  // Fires eb-dismiss; a listener that calls preventDefault keeps the banner. Hiding drops the pressed
  // button's focus to the body, so the banner hands it to its neighbour.
  // The next element is found first, since a listener may take the banner out of the page.
  #dismiss() {
    const next = successor(this)
    if (!this.dispatchEvent(new CustomEvent('eb-dismiss', { bubbles: true, composed: true, cancelable: true }))) return
    this.hidden = true
    next?.focus()
  }

  override render() {
    const lang = this.closest('[lang]')?.getAttribute('lang')?.startsWith('bn') ? 'bn' : 'en'
    const kind = this.tone === 'danger' || this.tone === 'warning' || this.tone === 'success' ? this.tone : 'info'
    const drawn = { danger: triangleAlert, warning: triangleAlert, success: icons['circle-check'], info }[kind]
    return html`<span class="icon" role="img" aria-label=${words[lang][kind]}>${drawn}</span>
      <div class="body">${this.heading ? html`<div class="heading">${this.heading}</div>` : nothing}<slot></slot></div>
      <slot name="action"></slot>${
        this.dismissible
          ? html`<eb-button
              variant="ghost"
              size="sm"
              icon-only
              label=${words[lang].dismiss}
              @click=${() => this.#dismiss()}
              ><eb-icon slot="icon" name="x"></eb-icon
            ></eb-button>`
          : nothing
      }`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-banner': EbBanner
  }
}
