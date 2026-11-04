import { LitElement, css, html, nothing, type PropertyValues } from 'lit'

/**
 * Keeps related buttons together in one row, wrapping when the row is too narrow.
 *
 * @slot - The buttons.
 */
export class EbButtonGroup extends LitElement {
  static override properties = {
    label: { type: String },
    segmented: { type: Boolean, reflect: true },
  }

  static override styles = css`
    :host {
      display: block;
      flex: var(--eb-bar-fill, 0 1 auto);
    }
    ::slotted(eb-button) {
      flex: var(--eb-bar-fill, 0 1 auto);
    }
    .group {
      display: flex;
      flex-flow: row wrap;
      gap: 8px;
    }
    /* Segmented: one track holding the choices, the pressed one raised on the surface, lighter than
       the track in both themes. */
    :host([segmented]) {
      display: inline-block;
    }
    :host([segmented]) .group {
      flex-wrap: nowrap;
      gap: 2px;
      padding: 2px;
      border-radius: var(--eb-radius-md);
      background: var(--eb-color-track);
    }
  `

  /** Names the group for a screen reader. */
  declare label: string
  /** One choice of a few, such as the language or the theme: each button sets pressed. */
  declare segmented: boolean

  constructor() {
    super()
    this.label = ''
    this.segmented = false
  }

  // The buttons draw their own look, so the group tells each one it is a segment.
  #mark() {
    for (const button of this.querySelectorAll(':scope > eb-button')) button.toggleAttribute('segment', this.segmented)
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('segmented')) this.#mark()
  }

  override render() {
    return html`<div class="group" role="group" aria-label=${this.label || nothing}>
      <slot @slotchange=${() => this.#mark()}></slot>
    </div>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'eb-button-group': EbButtonGroup
  }
}
