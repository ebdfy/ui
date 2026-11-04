import { LitElement, css, html } from 'lit'

// The tone every component shares; attention, critical and shipped are the 1.0.0 names, kept until
// 2.0 and drawn as warning, danger and the shipped status.
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'attention' | 'critical' | 'shipped'

// An order's state, drawn in its Ink status colour.
export type Status = 'new' | 'confirmed' | 'shipped' | 'paid' | 'returned'

/**
 * A status as a dot and a word. The words carry the status; the tone only repeats it: New is a
 * soft amber pill, Returned a filled red one, the rest a coloured dot. A status, when set, decides
 * the look over a tone beside it.
 *
 * @slot - The word of the status.
 */
export class EbBadge extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
    status: { type: String, reflect: true },
  }

  static override styles = css`
    :host {
      --dot: var(--eb-color-text-2);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--eb-color-text);
      font-family: var(--eb-font-family);
      font-size: var(--eb-font-size-meta);
      font-weight: var(--eb-font-weight-medium);
      line-height: var(--eb-line-height-meta);
      white-space: nowrap;
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--dot);
    }
    :host([tone='success']:not([status])),
    :host([status='paid']) {
      --dot: var(--eb-color-paid);
    }
    :host([tone='shipped']:not([status])),
    :host([status='shipped']) {
      --dot: var(--eb-color-shipped);
    }
    :host([tone='attention']:not([status])),
    :host([tone='warning']:not([status])),
    :host([status='new']),
    :host([tone='critical']:not([status])),
    :host([tone='danger']:not([status])),
    :host([status='returned']) {
      padding: 2px 8px;
      border-radius: var(--eb-radius-pill);
      font-weight: var(--eb-font-weight-semibold);
    }
    /* Noto Sans Bengali leaves more room above its letters than below, so Bangla words sat 1.5 to
       2.5 px low in a pill; they move up 2 px to sit in its middle, and the dot stays there too. */
    :host(:lang(bn)[tone='attention']:not([status])),
    :host(:lang(bn)[tone='warning']:not([status])),
    :host(:lang(bn)[status='new']),
    :host(:lang(bn)[tone='critical']:not([status])),
    :host(:lang(bn)[tone='danger']:not([status])),
    :host(:lang(bn)[status='returned']) {
      padding-block: 0 4px;
    }
    :host(:lang(bn)[tone='attention']:not([status])) .dot,
    :host(:lang(bn)[tone='warning']:not([status])) .dot,
    :host(:lang(bn)[status='new']) .dot {
      position: relative;
      top: 2px;
    }
    :host([tone='attention']:not([status])),
    :host([tone='warning']:not([status])),
    :host([status='new']) {
      --dot: var(--eb-color-new);
      background: var(--eb-color-new-bg);
      color: var(--eb-color-new-fg);
    }
    :host([tone='critical']:not([status])),
    :host([tone='danger']:not([status])),
    :host([status='returned']) {
      background: var(--eb-color-danger);
      color: var(--eb-color-on-danger);
    }
    :host([tone='critical']:not([status])) .dot,
    :host([tone='danger']:not([status])) .dot,
    :host([status='returned']) .dot {
      display: none;
    }
  `

  // Written out, not as Tone and Status, so the manifest names the values.
  /**
   * The tone every component shares: neutral, info, success, warning or danger. Deprecated until
   * 2.0: attention (use warning), critical (use danger) and shipped (use status="shipped").
   */
  declare tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'attention' | 'critical' | 'shipped'
  /** An order's state, drawn in its status colour; it decides the look over a tone. */
  declare status: 'new' | 'confirmed' | 'shipped' | 'paid' | 'returned' | undefined

  constructor() {
    super()
    this.tone = 'info'
  }

  override render() {
    return html`<span class="dot" aria-hidden="true"></span><slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-badge': EbBadge
  }
}
