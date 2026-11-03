import { LitElement, css, html } from 'lit'

export type Tone = 'attention' | 'info' | 'success' | 'shipped' | 'critical'

// A status as a dot and a word. The words carry the status; the tone only repeats it: New is a
// soft amber pill, Returned a filled red one, the rest a coloured dot.
export class EbBadge extends LitElement {
  static override properties = {
    tone: { type: String, reflect: true },
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
      /* As wide as its words, but never wider than its place: in a column too narrow for them,
         such as a 600 px table's, the words wrap inside the pill rather than spill out. */
      box-sizing: border-box;
      max-width: 100%;
    }
    .dot {
      flex: none;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--dot);
    }
    :host([tone='success']) {
      --dot: var(--eb-color-paid);
    }
    :host([tone='shipped']) {
      --dot: var(--eb-color-shipped);
    }
    :host([tone='attention']),
    :host([tone='critical']) {
      padding: 2px 8px;
      border-radius: var(--eb-radius-pill);
      font-weight: var(--eb-font-weight-semibold);
    }
    :host([tone='attention']) {
      --dot: var(--eb-color-new);
      background: var(--eb-color-new-bg);
      color: var(--eb-color-new-fg);
    }
    :host([tone='critical']) {
      background: var(--eb-color-danger);
      color: var(--eb-color-on-danger);
    }
    :host([tone='critical']) .dot {
      display: none;
    }
  `

  // Written out, not as Tone, so the manifest names the values.
  declare tone: 'attention' | 'info' | 'success' | 'shipped' | 'critical'

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
